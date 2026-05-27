import { describe, expect, it } from 'vitest';
import { defaultSettings } from './defaults.js';
import {
  combineReminderEffectRequests,
  collectDueReminderKinds,
  createInitialClocks,
  getClockStatus,
  reminderEffectForEscalation,
  clearReminderEffectKeys,
  resetClock,
  shouldConfirmNotificationClick,
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

  it('escalates through notification levels', () => {
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

  it('requests a desktop notification as soon as a reminder becomes due', () => {
    expect(reminderEffectForEscalation('sit', 1, new Set())).toEqual({
      key: 'sit:1',
      kind: 'sit',
      effect: 'notification'
    });
  });

  it('does not repeat an already emitted reminder effect', () => {
    expect(reminderEffectForEscalation('drink', 1, new Set(['drink:1']))).toBeNull();
  });

  it('clears emitted reminder effects only for the completed reminder kind', () => {
    const emittedKeys = new Set(['sit:1', 'drink:1', 'drink:3']);

    clearReminderEffectKeys('drink', emittedKeys);

    expect([...emittedKeys].sort()).toEqual(['sit:1']);
  });

  it('keeps escalated reminders on desktop notifications instead of strong windows', () => {
    expect(reminderEffectForEscalation('drink', 2, new Set())).toBeNull();
    expect(reminderEffectForEscalation('drink', 3, new Set())).toEqual({
      key: 'drink:3',
      kind: 'drink',
      effect: 'notification'
    });
  });

  it('combines simultaneous notification requests into one notification payload', () => {
    expect(
      combineReminderEffectRequests([
        { key: 'sit:1', kind: 'sit', effect: 'notification' },
        { key: 'drink:1', kind: 'drink', effect: 'notification' }
      ])
    ).toEqual({
      keys: ['sit:1', 'drink:1'],
      kinds: ['sit', 'drink'],
      effect: 'notification'
    });
  });

  it('collects every reminder that is already waiting for acknowledgement', () => {
    const clocks = createInitialClocks(defaultSettings, 0);
    clocks.sit = { ...clocks.sit, dueAt: 0, escalationLevel: 1 };
    clocks.drink = { ...clocks.drink, dueAt: 0, escalationLevel: 1 };

    expect(collectDueReminderKinds(clocks)).toEqual(['sit', 'drink']);
  });

  it('only confirms notification clicks while the reminder is still due', () => {
    expect(shouldConfirmNotificationClick({ ...resetClock('sit', defaultSettings, 0), dueAt: 0 }, 1)).toBe(true);
    expect(shouldConfirmNotificationClick(resetClock('sit', defaultSettings, 0), 1)).toBe(false);
  });
});
