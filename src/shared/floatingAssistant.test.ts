import { describe, expect, it } from 'vitest';
import { getFloatingAssistantStatus } from './floatingAssistant.js';
import type { AppSnapshot } from './types.js';

const baseSnapshot: AppSnapshot = {
  settings: {
    sitEnabled: true,
    drinkEnabled: true,
    sitIntervalMinutes: 45,
    drinkIntervalMinutes: 30,
    levelOneMinutes: 5,
    levelTwoMinutes: 10,
    snoozeMinutes: 5,
    launchHidden: false
  },
  stats: {
    date: '2026-05-28',
    sitCount: 2,
    drinkCount: 4,
    workMinutes: 180,
    records: []
  },
  clocks: {
    sit: {
      kind: 'sit',
      startedAt: 0,
      dueAt: 3_000_000,
      enabled: true,
      escalationLevel: 0
    },
    drink: {
      kind: 'drink',
      startedAt: 0,
      dueAt: 1_200_000,
      enabled: true,
      escalationLevel: 0
    }
  },
  paused: false,
  now: 600_000,
  activeReminder: null
};

describe('floating assistant status', () => {
  it('uses the active reminder as the main status', () => {
    const status = getFloatingAssistantStatus({
      ...baseSnapshot,
      activeReminder: 'sit',
      clocks: {
        ...baseSnapshot.clocks,
        sit: { ...baseSnapshot.clocks.sit, dueAt: 300_000, escalationLevel: 2 }
      }
    });

    expect(status.kind).toBe('sit');
    expect(status.label).toBe('该起身了');
    expect(status.tone).toBe('move');
    expect(status.isDue).toBe(true);
  });

  it('falls back to the next due reminder when nothing is active', () => {
    const status = getFloatingAssistantStatus(baseSnapshot);

    expect(status.kind).toBe('drink');
    expect(status.label).toBe('下次喝水');
    expect(status.remainingMs).toBe(600_000);
    expect(status.tone).toBe('water');
  });
});
