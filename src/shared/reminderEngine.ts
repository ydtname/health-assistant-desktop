import type { ReminderClock, ReminderKind, ReminderSettings } from './types.js';

const minute = 60_000;

export type ReminderEffect = 'notification';

export interface ReminderEffectRequest {
  key: string;
  kind: ReminderKind;
  effect: ReminderEffect;
}

export interface CombinedReminderEffectRequest {
  keys: string[];
  kinds: ReminderKind[];
  effect: ReminderEffect;
}

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

export function reminderEffectForEscalation(
  kind: ReminderKind,
  escalationLevel: ReminderClock['escalationLevel'],
  emittedKeys: ReadonlySet<string>
): ReminderEffectRequest | null {
  const key = `${kind}:${escalationLevel}`;
  if (escalationLevel === 0 || emittedKeys.has(key)) {
    return null;
  }

  if (escalationLevel === 1 || escalationLevel === 3) {
    return { key, kind, effect: 'notification' };
  }

  return null;
}

export function combineReminderEffectRequests(
  requests: ReminderEffectRequest[]
): CombinedReminderEffectRequest | null {
  if (requests.length === 0) {
    return null;
  }

  return {
    keys: requests.map(request => request.key),
    kinds: requests.map(request => request.kind),
    effect: 'notification'
  };
}

export function collectDueReminderKinds(clocks: Record<ReminderKind, ReminderClock>): ReminderKind[] {
  return (['sit', 'drink'] as ReminderKind[]).filter(kind => clocks[kind].enabled && clocks[kind].escalationLevel > 0);
}

export function clearReminderEffectKeys(kind: ReminderKind, emittedKeys: Set<string>): void {
  for (const key of emittedKeys) {
    if (key.startsWith(`${kind}:`)) {
      emittedKeys.delete(key);
    }
  }
}

export function shouldConfirmNotificationClick(clock: ReminderClock, now = Date.now()): boolean {
  return clock.enabled && now >= clock.dueAt;
}

export function snoozeClock(clock: ReminderClock, settings: ReminderSettings, now = Date.now()): ReminderClock {
  return {
    ...clock,
    startedAt: now,
    dueAt: now + settings.snoozeMinutes * minute,
    escalationLevel: 0
  };
}
