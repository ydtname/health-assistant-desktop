import type { DailyStats, ReminderSettings } from './types.js';

export const defaultSettings: ReminderSettings = {
  sitEnabled: true,
  drinkEnabled: true,
  sitIntervalMinutes: 60,
  drinkIntervalMinutes: 45,
  levelOneMinutes: 5,
  levelTwoMinutes: 5,
  snoozeMinutes: 10,
  launchHidden: false
};

export function todayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function createEmptyDailyStats(now = Date.now()): DailyStats {
  return {
    date: todayKey(now),
    sitCount: 0,
    drinkCount: 0,
    workMinutes: 0,
    records: []
  };
}
