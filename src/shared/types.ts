export type ReminderKind = 'sit' | 'drink';

export interface ReminderSettings {
  sitEnabled: boolean;
  drinkEnabled: boolean;
  sitIntervalMinutes: number;
  drinkIntervalMinutes: number;
  levelOneMinutes: number;
  levelTwoMinutes: number;
  snoozeMinutes: number;
  launchHidden: boolean;
}

export interface ReminderRecord {
  id: string;
  kind: ReminderKind;
  timestamp: number;
  action: 'confirmed' | 'snoozed';
}

export interface DailyStats {
  date: string;
  sitCount: number;
  drinkCount: number;
  workMinutes: number;
  records: ReminderRecord[];
}

export interface ReminderClock {
  kind: ReminderKind;
  startedAt: number;
  dueAt: number;
  enabled: boolean;
  escalationLevel: 0 | 1 | 2 | 3;
}

export interface AppSnapshot {
  settings: ReminderSettings;
  stats: DailyStats;
  clocks: Record<ReminderKind, ReminderClock>;
  paused: boolean;
  now: number;
  activeReminder: ReminderKind | null;
}

export interface UpdateCheckResult {
  configured: boolean;
  message: string;
  url?: string;
  status?: 'disabled' | 'available' | 'none' | 'error';
}
