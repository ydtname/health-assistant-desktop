import { contextBridge, ipcRenderer } from 'electron';
import type { AppSnapshot, ReminderKind, ReminderSettings, UpdateCheckResult } from '../shared/types.js';

export interface HealthAssistantApi {
  getSnapshot: () => Promise<AppSnapshot>;
  updateSettings: (settings: Partial<ReminderSettings>) => Promise<AppSnapshot>;
  confirm: (kind: ReminderKind) => Promise<AppSnapshot>;
  snooze: (kind: ReminderKind) => Promise<AppSnapshot>;
  reset: () => Promise<AppSnapshot>;
  togglePaused: () => Promise<AppSnapshot>;
  checkForUpdates: () => Promise<UpdateCheckResult>;
  onSnapshot: (callback: (snapshot: AppSnapshot) => void) => () => void;
}

const api: HealthAssistantApi = {
  getSnapshot: () => ipcRenderer.invoke('health:getSnapshot'),
  updateSettings: settings => ipcRenderer.invoke('health:updateSettings', settings),
  confirm: kind => ipcRenderer.invoke('health:confirm', kind),
  snooze: kind => ipcRenderer.invoke('health:snooze', kind),
  reset: () => ipcRenderer.invoke('health:reset'),
  togglePaused: () => ipcRenderer.invoke('health:togglePaused'),
  checkForUpdates: () => ipcRenderer.invoke('health:checkForUpdates'),
  onSnapshot: callback => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: AppSnapshot) => callback(snapshot);
    ipcRenderer.on('health:snapshot', listener);
    return () => ipcRenderer.removeListener('health:snapshot', listener);
  }
};

contextBridge.exposeInMainWorld('healthAssistant', api);
