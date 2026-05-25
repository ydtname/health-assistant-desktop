import { describe, expect, it } from 'vitest';
import { defaultSettings } from './defaults.js';
import {
  createInitialClocks,
  getClockStatus,
  resetClock,
  snoozeClock,
  updateEscalation
} from './reminderEngine.js';

describe('reminder engine', () => {
  it('creates independent clocks from settings', () => {
    const clocks = createInitialClocks(defaultSettings, 1_000);

    expect(clocks.sit.dueAt).toBe(1_000 + 60 * 60_000);
    expect(clocks.drink.dueAt).toBe(1_000 + 45 * 60_000);
  });

  it('reports remaining time and due state', () => {
    const clock = resetClock('sit', defaultSettings, 0);

    expect(getClockStatus(clock, 59 * 60_000).remainingMs).toBe(60_000);
    expect(getClockStatus(clock, 61 * 60_000).isDue).toBe(true);
  });

  it('escalates through gentle, notification, and strong levels', () => {
    const dueClock = { ...resetClock('sit', defaultSettings, 0), dueAt: 0 };

    expect(updateEscalation(dueClock, 1, defaultSettings).escalationLevel).toBe(1);
    expect(updateEscalation(dueClock, 5 * 60_000 + 1, defaultSettings).escalationLevel).toBe(2);
    expect(updateEscalation(dueClock, 10 * 60_000 + 1, defaultSettings).escalationLevel).toBe(3);
  });

  it('snoozes from the current time and reset uses the configured interval', () => {
    expect(snoozeClock(resetClock('drink', defaultSettings, 0), defaultSettings, 5_000).dueAt).toBe(
      5_000 + 10 * 60_000
    );
    expect(resetClock('drink', defaultSettings, 5_000).dueAt).toBe(5_000 + 45 * 60_000);
  });
});
