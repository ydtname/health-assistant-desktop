import { contextBridge, ipcRenderer } from 'electron';
import type { AppSnapshot, ReminderKind, ReminderSettings, UpdateCheckResult, UpdateStatus } from '../shared/types.js';

export type FloatingDockSide = 'left' | 'right';

export interface HealthAssistantApi {
  getSnapshot: () => Promise<AppSnapshot>;
  updateSettings: (settings: Partial<ReminderSettings>) => Promise<AppSnapshot>;
  confirm: (kind: ReminderKind) => Promise<AppSnapshot>;
  snooze: (kind: ReminderKind) => Promise<AppSnapshot>;
  reset: () => Promise<AppSnapshot>;
  togglePaused: () => Promise<AppSnapshot>;
  checkForUpdates: () => Promise<UpdateCheckResult>;
  downloadUpdate: () => Promise<UpdateStatus>;
  installUpdate: () => Promise<UpdateStatus>;
  setFloatingExpanded: (expanded: boolean) => Promise<void>;
  dragFloatingBy: (delta: { x: number; y: number }) => Promise<void>;
  finishFloatingDrag: () => Promise<FloatingDockSide | null>;
  undockFloating: () => Promise<void>;
  onSnapshot: (callback: (snapshot: AppSnapshot) => void) => () => void;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
}

const api: HealthAssistantApi = {
  getSnapshot: () => ipcRenderer.invoke('health:getSnapshot'),
  updateSettings: settings => ipcRenderer.invoke('health:updateSettings', settings),
  confirm: kind => ipcRenderer.invoke('health:confirm', kind),
  snooze: kind => ipcRenderer.invoke('health:snooze', kind),
  reset: () => ipcRenderer.invoke('health:reset'),
  togglePaused: () => ipcRenderer.invoke('health:togglePaused'),
  checkForUpdates: () => ipcRenderer.invoke('health:checkForUpdates'),
  downloadUpdate: () => ipcRenderer.invoke('health:downloadUpdate'),
  installUpdate: () => ipcRenderer.invoke('health:installUpdate'),
  setFloatingExpanded: expanded => ipcRenderer.invoke('health:setFloatingExpanded', expanded),
  dragFloatingBy: delta => ipcRenderer.invoke('health:dragFloatingBy', delta),
  finishFloatingDrag: () => ipcRenderer.invoke('health:finishFloatingDrag'),
  undockFloating: () => ipcRenderer.invoke('health:undockFloating'),
  onSnapshot: callback => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: AppSnapshot) => callback(snapshot);
    ipcRenderer.on('health:snapshot', listener);
    return () => ipcRenderer.removeListener('health:snapshot', listener);
  },
  onUpdateStatus: callback => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => callback(status);
    ipcRenderer.on('health:updateStatus', listener);
    return () => ipcRenderer.removeListener('health:updateStatus', listener);
  }
};

contextBridge.exposeInMainWorld('healthAssistant', api);
