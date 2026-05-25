import type { HealthAssistantApi } from '../preload/preload.js';

declare global {
  interface Window {
    healthAssistant: HealthAssistantApi;
  }
}

export {};
