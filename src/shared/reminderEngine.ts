import type { ReminderClock, ReminderKind, ReminderSettings } from './types.js';

const minute = 60_000;

function intervalFor(kind: ReminderKind, settings: ReminderSettings): number {
  return kind === 'sit' ? settings.sitIntervalMinutes : settings.drinkIntervalMinutes;
}

function enabledFor(kind: ReminderKind, settings: ReminderSettings): boolean {
  return kind === 'sit' ? settings.sitEnabled : settings.drinkEnabled;
}

export function resetClock(kind: ReminderKind, settings: ReminderSettings, now = Date.now()): ReminderClock {
  return {
    kind,
    startedAt: now,
    dueAt: now + intervalFor(kind, settings) * minute,
    enabled: enabledFor(kind, settings),
    escalationLevel: 0
  };
}

export function createInitialClocks(
  settings: ReminderSettings,
  now = Date.now()
): Record<ReminderKind, ReminderClock> {
  return {
    sit: resetClock('sit', settings, now),
    drink: resetClock('drink', settings, now)
  };
}

export function getClockStatus(clock: ReminderClock, now = Date.now()): { remainingMs: number; isDue: boolean } {
  const remainingMs = Math.max(0, clock.dueAt - now);
  return {
    remainingMs,
    isDue: clock.enabled && remainingMs === 0
  };
}

export function updateEscalation(
  clock: ReminderClock,
  now: number,
  settings: ReminderSettings
): ReminderClock {
  if (!clock.enabled || now < clock.dueAt) {
    return { ...clock, escalationLevel: 0 };
  }

  const overdueMs = now - clock.dueAt;
  const levelTwoAt = settings.levelOneMinutes * minute;
  const levelThreeAt = (settings.levelOneMinutes + settings.levelTwoMinutes) * minute;
  const escalationLevel = overdueMs > levelThreeAt ? 3 : overdueMs > levelTwoAt ? 2 : 1;

  return { ...clock, escalationLevel };
}

export function snoozeClock(clock: ReminderClock, settings: ReminderSettings, now = Date.now()): ReminderClock {
  return {
    ...clock,
    startedAt: now,
    dueAt: now + settings.snoozeMinutes * minute,
    escalationLevel: 0
  };
}
