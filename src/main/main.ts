import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  Notification,
  dialog,
  shell,
  Tray,
  ipcMain
} from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import electronUpdater from 'electron-updater';
import { HealthStore } from './store.js';
import { createInitialClocks, resetClock, snoozeClock, updateEscalation } from '../shared/reminderEngine.js';
import type { AppSnapshot, ReminderClock, ReminderKind, ReminderSettings, UpdateCheckResult } from '../shared/types.js';

const { autoUpdater } = electronUpdater;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let strongWindow: BrowserWindow | null = null;
let store: HealthStore;
let settings: ReminderSettings;
let clocks: Record<ReminderKind, ReminderClock>;
let paused = false;
let activeReminder: ReminderKind | null = null;
let tickTimer: NodeJS.Timeout | null = null;
let workTimer: NodeJS.Timeout | null = null;
let isQuitting = false;
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
  tray.setToolTip('健康助手');
  updateTrayMenu();
  tray.on('click', () => showMainWindow());
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
    activeReminder
  };
}

function broadcast(): AppSnapshot {
  const snapshot = getSnapshot();
  mainWindow?.webContents.send('health:snapshot', snapshot);
  return snapshot;
}

function showNotification(kind: ReminderKind): void {
  const title = kind === 'sit' ? '该起身活动了' : '该喝水了';
  const body = kind === 'sit' ? '站起来走一走，伸展肩颈。' : '补一口水，让大脑继续清醒。';
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

function showStrongReminder(kind: ReminderKind): void {
  activeReminder = kind;
  showMainWindow();
  if (strongWindow && !strongWindow.isDestroyed()) {
    strongWindow.focus();
    return;
  }
  strongWindow = new BrowserWindow({
    width: 460,
    height: 310,
    resizable: false,
    alwaysOnTop: true,
    title: kind === 'sit' ? '起身提醒' : '喝水提醒',
    backgroundColor: '#090c10',
    icon: appIconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const hash = kind === 'sit' ? '#strong-sit' : '#strong-drink';
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void strongWindow.loadURL(`${devUrl}${hash}`);
  } else {
    void strongWindow.loadFile(join(dirname, '../../renderer/index.html'), { hash: hash.slice(1) });
  }
  strongWindow.on('closed', () => {
    strongWindow = null;
  });
}

function startLoops(): void {
  tickTimer = setInterval(() => {
    if (!paused) {
      const now = Date.now();
      for (const kind of ['sit', 'drink'] as ReminderKind[]) {
        const next = updateEscalation(clocks[kind], now, settings);
        clocks[kind] = next;
        const key = `${kind}:${next.escalationLevel}`;
        if (next.escalationLevel === 2 && !notifiedLevels.has(key)) {
          notifiedLevels.add(key);
          showNotification(kind);
        }
        if (next.escalationLevel === 3 && !notifiedLevels.has(key)) {
          notifiedLevels.add(key);
          showStrongReminder(kind);
        }
      }
    }
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
  activeReminder = null;
  notifiedLevels.clear();
  strongWindow?.close();
  return broadcast();
}

async function snoozeReminder(kind: ReminderKind): Promise<AppSnapshot> {
  await store.addRecord({ id: `${kind}-${Date.now()}`, kind, timestamp: Date.now(), action: 'snoozed' });
  clocks[kind] = snoozeClock(clocks[kind], settings);
  activeReminder = null;
  notifiedLevels.clear();
  strongWindow?.close();
  return broadcast();
}

async function resetAll(): Promise<AppSnapshot> {
  clocks = createInitialClocks(settings);
  activeReminder = null;
  notifiedLevels.clear();
  strongWindow?.close();
  return broadcast();
}

async function togglePaused(): Promise<AppSnapshot> {
  paused = !paused;
  updateTrayMenu();
  return broadcast();
}

async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!app.isPackaged) {
    return {
      configured: false,
      status: 'disabled',
      message: '开发模式不检查更新。打包安装后会从 GitHub Releases 检查 ydtname/health-assistant-desktop。'
    };
  }

  try {
    autoUpdater.autoDownload = false;
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'ydtname',
      repo: 'health-assistant-desktop'
    });

    const result = await autoUpdater.checkForUpdates();
    const updateInfo = result?.updateInfo;
    if (updateInfo?.version && updateInfo.version !== app.getVersion()) {
      return {
        configured: true,
        status: 'available',
        message: `发现新版本 ${updateInfo.version}，请前往 GitHub Releases 下载。`,
        url: 'https://github.com/ydtname/health-assistant-desktop/releases/latest'
      };
    }

    return {
      configured: true,
      status: 'none',
      message: `当前已是最新版本 ${app.getVersion()}。`
    };
  } catch (error) {
    return {
      configured: true,
      status: 'error',
      message: `检查更新失败：${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function showUpdateDialog(): Promise<void> {
  const result = await checkForUpdates();
  const buttons = result.url ? ['打开 GitHub Releases', '关闭'] : ['知道了'];
  const response = await dialog.showMessageBox({
    type: result.configured ? 'info' : 'warning',
    title: '检查更新',
    message: '检查更新',
    detail: result.message,
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1
  });

  if (result.url && response.response === 0) {
    await shell.openExternal(result.url);
  }
}

function registerIpc(): void {
  ipcMain.handle('health:getSnapshot', () => getSnapshot());
  ipcMain.handle('health:updateSettings', async (_event, patch: Partial<ReminderSettings>) => {
    settings = await store.updateSettings(patch);
    clocks = createInitialClocks(settings);
    return broadcast();
  });
  ipcMain.handle('health:confirm', (_event, kind: ReminderKind) => confirmReminder(kind));
  ipcMain.handle('health:snooze', (_event, kind: ReminderKind) => snoozeReminder(kind));
  ipcMain.handle('health:reset', () => resetAll());
  ipcMain.handle('health:togglePaused', () => togglePaused());
  ipcMain.handle('health:checkForUpdates', () => checkForUpdates());
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
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
