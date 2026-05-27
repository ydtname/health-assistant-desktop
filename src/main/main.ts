import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  Notification,
  dialog,
  Tray,
  ipcMain,
  type MessageBoxOptions
} from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import electronUpdater from 'electron-updater';
import { HealthStore } from './store.js';
import {
  clearReminderEffectKeys,
  collectDueReminderKinds,
  combineReminderEffectRequests,
  createInitialClocks,
  reminderEffectForEscalation,
  resetClock,
  shouldConfirmNotificationClick,
  snoozeClock,
  updateEscalation,
  type ReminderEffectRequest
} from '../shared/reminderEngine.js';
import { formatTrayTooltip } from '../shared/trayTooltip.js';
import type {
  AppSnapshot,
  ReminderClock,
  ReminderKind,
  ReminderSettings,
  UpdateCheckResult,
  UpdateStatus
} from '../shared/types.js';

const { autoUpdater } = electronUpdater;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let store: HealthStore;
let settings: ReminderSettings;
let clocks: Record<ReminderKind, ReminderClock>;
let paused = false;
let tickTimer: NodeJS.Timeout | null = null;
let workTimer: NodeJS.Timeout | null = null;
let isQuitting = false;
let updateStatus: UpdateStatus = {
  configured: true,
  status: 'idle',
  message: '尚未检查更新。'
};
const notifiedLevels = new Set<string>();
const dirname = fileURLToPath(new URL('.', import.meta.url));
const preloadPath = join(dirname, '../../../dist-preload/preload/preload.js');
const appIconPath = join(dirname, '../../../assets/icons/health-256.png');
const trayIconPath = join(dirname, '../../../assets/icons/health-tray.png');

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 860,
    minHeight: 620,
    show: !settings.launchHidden,
    backgroundColor: '#090c10',
    title: '健康助手',
    icon: appIconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(join(dirname, '../../renderer/index.html'));
  }

  mainWindow.on('close', event => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray(): void {
  const image = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(image);
  updateTrayTooltip();
  updateTrayMenu();
  tray.on('click', () => showMainWindow());
}

function updateTrayTooltip(now = Date.now()): void {
  tray?.setToolTip(formatTrayTooltip({ clocks, paused, now }));
}

function updateTrayMenu(): void {
  tray?.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开健康助手', click: () => showMainWindow() },
      { label: paused ? '继续提醒' : '暂停提醒', click: () => void togglePaused() },
      { label: '重置计时器', click: () => void resetAll() },
      { label: '检查更新', click: () => void showUpdateDialog() },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
}

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow();
  }
  mainWindow?.show();
  mainWindow?.focus();
}

function getSnapshot(now = Date.now()): AppSnapshot {
  return {
    settings,
    stats: store.getToday(now),
    clocks,
    paused,
    now,
    activeReminder: null
  };
}

function broadcast(): AppSnapshot {
  const snapshot = getSnapshot();
  mainWindow?.webContents.send('health:snapshot', snapshot);
  return snapshot;
}

function setUpdateStatus(next: UpdateStatus): UpdateStatus {
  updateStatus = next;
  mainWindow?.webContents.send('health:updateStatus', updateStatus);
  return updateStatus;
}

function configureUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'ydtname',
    repo: 'health-assistant-desktop'
  });
}

function formatBytesPerSecond(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytesPerSecond / 1024))} KB/s`;
  }
  return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
}

function registerUpdaterEvents(): void {
  autoUpdater.on('download-progress', progress => {
    const percent = Math.max(0, Math.min(100, progress.percent || 0));
    setUpdateStatus({
      configured: true,
      status: 'downloading',
      message: `正在下载更新 ${percent.toFixed(1)}%，速度 ${formatBytesPerSecond(progress.bytesPerSecond || 0)}。`,
      version: updateStatus.version,
      progress: {
        percent,
        bytesPerSecond: progress.bytesPerSecond || 0,
        transferred: progress.transferred || 0,
        total: progress.total || 0
      }
    });
  });

  autoUpdater.on('update-downloaded', info => {
    setUpdateStatus({
      configured: true,
      status: 'downloaded',
      message: `更新 ${info.version} 已下载完成，重启后即可安装。`,
      version: info.version
    });
    mainWindow?.focus();
    const messageBoxOptions: MessageBoxOptions = {
      type: 'info',
      title: '更新已下载完成',
      message: `新版本 ${info.version} 已下载完成。`,
      detail: '是否现在退出并安装更新？',
      buttons: ['立即安装', '稍后'],
      defaultId: 0,
      cancelId: 1
    };
    const messageBoxPromise = mainWindow
      ? dialog.showMessageBox(mainWindow, messageBoxOptions)
      : dialog.showMessageBox(messageBoxOptions);
    void messageBoxPromise.then(response => {
      if (response.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', error => {
    setUpdateStatus({
      configured: true,
      status: 'error',
      message: `更新失败：${error instanceof Error ? error.message : String(error)}`
    });
  });
}

function showNotification(kind: ReminderKind): void {
  const title = kind === 'sit' ? '该起身活动了' : '该喝水了';
  const body = kind === 'sit' ? '站起来走一走，伸展肩颈。' : '补一口水，让大脑继续清醒。';
  if (Notification.isSupported()) {
    const notification = new Notification({ title, body });
    notification.on('click', () => {
      if (shouldConfirmNotificationClick(clocks[kind])) {
        void confirmReminder(kind);
      }
    });
    notification.show();
  }
}

function combinedNotificationText(kinds: ReminderKind[]): { title: string; body: string } {
  if (kinds.includes('sit') && kinds.includes('drink')) {
    return {
      title: '该起身并喝水了',
      body: '起来走一走，顺便补一口水。'
    };
  }

  const kind = kinds[0];
  return {
    title: kind === 'sit' ? '该起身活动了' : '该喝水了',
    body: kind === 'sit' ? '站起来走一走，伸展肩颈。' : '补一口水，让大脑继续清醒。'
  };
}

function showCombinedNotification(kinds: ReminderKind[]): void {
  if (kinds.length === 0 || !Notification.isSupported()) {
    return;
  }

  const { title, body } = combinedNotificationText(kinds);
  const notification = new Notification({ title, body });
  notification.on('click', () => {
    void confirmReminderKinds(kinds.filter(kind => shouldConfirmNotificationClick(clocks[kind])));
  });
  notification.show();
}

function startLoops(): void {
  tickTimer = setInterval(() => {
    if (!paused) {
      const now = Date.now();
      const requests: ReminderEffectRequest[] = [];
      for (const kind of ['sit', 'drink'] as ReminderKind[]) {
        const next = updateEscalation(clocks[kind], now, settings);
        clocks[kind] = next;
        const request = reminderEffectForEscalation(kind, next.escalationLevel, notifiedLevels);
        if (request?.effect === 'notification') {
          requests.push(request);
        }
      }
      const combinedRequest = combineReminderEffectRequests(requests);
      if (combinedRequest?.effect === 'notification') {
        for (const key of combinedRequest.keys) {
          notifiedLevels.add(key);
        }
        showCombinedNotification(collectDueReminderKinds(clocks));
      }
    }
    updateTrayTooltip();
    broadcast();
  }, 1000);

  workTimer = setInterval(() => {
    if (!paused) {
      void store.addWorkMinutes(1).then(() => broadcast());
    }
  }, 60_000);
}

function stopLoops(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
  }
  if (workTimer) {
    clearInterval(workTimer);
  }
}

async function confirmReminder(kind: ReminderKind): Promise<AppSnapshot> {
  await store.addRecord({ id: `${kind}-${Date.now()}`, kind, timestamp: Date.now(), action: 'confirmed' });
  clocks[kind] = resetClock(kind, settings);
  clearReminderEffectKeys(kind, notifiedLevels);
  updateTrayTooltip();
  return broadcast();
}

async function confirmReminderKinds(kinds: ReminderKind[]): Promise<AppSnapshot> {
  const uniqueKinds = [...new Set(kinds)];
  if (uniqueKinds.length === 0) {
    return getSnapshot();
  }

  const now = Date.now();
  for (const kind of uniqueKinds) {
    await store.addRecord({ id: `${kind}-${now}`, kind, timestamp: now, action: 'confirmed' });
    clocks[kind] = resetClock(kind, settings, now);
    clearReminderEffectKeys(kind, notifiedLevels);
  }
  updateTrayTooltip();
  return broadcast();
}

async function snoozeReminder(kind: ReminderKind): Promise<AppSnapshot> {
  await store.addRecord({ id: `${kind}-${Date.now()}`, kind, timestamp: Date.now(), action: 'snoozed' });
  clocks[kind] = snoozeClock(clocks[kind], settings);
  clearReminderEffectKeys(kind, notifiedLevels);
  updateTrayTooltip();
  return broadcast();
}

async function resetAll(): Promise<AppSnapshot> {
  clocks = createInitialClocks(settings);
  notifiedLevels.clear();
  updateTrayTooltip();
  return broadcast();
}

async function togglePaused(): Promise<AppSnapshot> {
  paused = !paused;
  updateTrayTooltip();
  updateTrayMenu();
  return broadcast();
}

async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!app.isPackaged) {
    return setUpdateStatus({
      configured: false,
      status: 'disabled',
      message: '开发模式不检查更新。打包安装后会从 GitHub Releases 检查 ydtname/health-assistant-desktop。'
    });
  }

  try {
    configureUpdater();
    setUpdateStatus({
      configured: true,
      status: 'checking',
      message: '正在检查更新...'
    });

    const result = await autoUpdater.checkForUpdates();
    const updateInfo = result?.updateInfo;
    if (updateInfo?.version && updateInfo.version !== app.getVersion()) {
      return setUpdateStatus({
        configured: true,
        status: 'available',
        message: `发现新版本 ${updateInfo.version}，可以在软件内下载并安装。`,
        version: updateInfo.version
      });
    }

    return setUpdateStatus({
      configured: true,
      status: 'none',
      message: `当前已经是最新版本 ${app.getVersion()}。`
    });
  } catch (error) {
    return setUpdateStatus({
      configured: true,
      status: 'error',
      message: `检查更新失败：${error instanceof Error ? error.message : String(error)}`
    });
  }
}

async function downloadUpdate(): Promise<UpdateStatus> {
  if (!app.isPackaged) {
    return setUpdateStatus({
      configured: false,
      status: 'disabled',
      message: '开发模式不能下载更新。请安装打包版本后再试。'
    });
  }

  if (updateStatus.status !== 'available' && updateStatus.status !== 'error') {
    return updateStatus;
  }

  try {
    configureUpdater();
    setUpdateStatus({
      configured: true,
      status: 'downloading',
      message: '正在准备下载更新...',
      version: updateStatus.version,
      progress: {
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0
      }
    });
    await autoUpdater.downloadUpdate();
    return updateStatus;
  } catch (error) {
    return setUpdateStatus({
      configured: true,
      status: 'error',
      message: `下载更新失败：${error instanceof Error ? error.message : String(error)}`
    });
  }
}

async function installUpdate(): Promise<UpdateStatus> {
  if (updateStatus.status !== 'downloaded') {
    return updateStatus;
  }
  setUpdateStatus({
    ...updateStatus,
    message: '正在退出并安装更新...'
  });
  autoUpdater.quitAndInstall();
  return updateStatus;
}

async function showUpdateDialog(): Promise<void> {
  const result = await checkForUpdates();
  const buttons = result.status === 'available' ? ['下载更新', '关闭'] : ['知道了'];
  const response = await dialog.showMessageBox({
    type: result.configured ? 'info' : 'warning',
    title: '检查更新',
    message: '检查更新',
    detail: result.message,
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1
  });

  if (result.status === 'available' && response.response === 0) {
    await downloadUpdate();
  }
}

function registerIpc(): void {
  ipcMain.handle('health:getSnapshot', () => getSnapshot());
  ipcMain.handle('health:updateSettings', async (_event, patch: Partial<ReminderSettings>) => {
    settings = await store.updateSettings(patch);
    clocks = createInitialClocks(settings);
    updateTrayTooltip();
    return broadcast();
  });
  ipcMain.handle('health:confirm', (_event, kind: ReminderKind) => confirmReminder(kind));
  ipcMain.handle('health:snooze', (_event, kind: ReminderKind) => snoozeReminder(kind));
  ipcMain.handle('health:reset', () => resetAll());
  ipcMain.handle('health:togglePaused', () => togglePaused());
  ipcMain.handle('health:checkForUpdates', () => checkForUpdates());
  ipcMain.handle('health:downloadUpdate', () => downloadUpdate());
  ipcMain.handle('health:installUpdate', () => installUpdate());
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  registerUpdaterEvents();
  store = new HealthStore();
  await store.load();
  settings = store.getSettings();
  clocks = createInitialClocks(settings);
  registerIpc();
  createTray();
  createWindow();
  startLoops();
});

app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  isQuitting = true;
  stopLoops();
});
