import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createEmptyDailyStats, defaultSettings, todayKey } from '../shared/defaults.js';
import type { DailyStats, ReminderRecord, ReminderSettings } from '../shared/types.js';

interface StoreShape {
  settings: ReminderSettings;
  statsByDate: Record<string, DailyStats>;
}

const fileName = 'health-assistant-data.json';

function mergeSettings(settings?: Partial<ReminderSettings>): ReminderSettings {
  return { ...defaultSettings, ...settings };
}

export class HealthStore {
  private data: StoreShape = {
    settings: defaultSettings,
    statsByDate: {}
  };

  private get filePath(): string {
    return join(app.getPath('userData'), fileName);
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoreShape>;
      this.data = {
        settings: mergeSettings(parsed.settings),
        statsByDate: parsed.statsByDate ?? {}
      };
    } catch {
      this.data = {
        settings: defaultSettings,
        statsByDate: {}
      };
      await this.save();
    }
  }

  getSettings(): ReminderSettings {
    return { ...this.data.settings };
  }

  async updateSettings(patch: Partial<ReminderSettings>): Promise<ReminderSettings> {
    this.data.settings = mergeSettings({ ...this.data.settings, ...patch });
    await this.save();
    return this.getSettings();
  }

  getToday(now = Date.now()): DailyStats {
    const key = todayKey(now);
    if (!this.data.statsByDate[key]) {
      this.data.statsByDate[key] = createEmptyDailyStats(now);
    }
    const stats = this.data.statsByDate[key];
    return {
      ...stats,
      records: [...stats.records]
    };
  }

  async addRecord(record: ReminderRecord, now = Date.now()): Promise<DailyStats> {
    const key = todayKey(now);
    if (!this.data.statsByDate[key]) {
      this.data.statsByDate[key] = createEmptyDailyStats(now);
    }

    const stats = this.data.statsByDate[key];
    stats.records.push(record);
    if (record.action === 'confirmed') {
      if (record.kind === 'sit') {
        stats.sitCount += 1;
      } else {
        stats.drinkCount += 1;
      }
    }
    await this.save();
    return this.getToday(now);
  }

  async addWorkMinutes(minutes: number, now = Date.now()): Promise<DailyStats> {
    if (minutes <= 0) {
      return this.getToday(now);
    }
    const key = todayKey(now);
    if (!this.data.statsByDate[key]) {
      this.data.statsByDate[key] = createEmptyDailyStats(now);
    }
    this.data.statsByDate[key].workMinutes += minutes;
    await this.save();
    return this.getToday(now);
  }

  private async save(): Promise<void> {
    await mkdir(app.getPath('userData'), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }
}
