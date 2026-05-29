import type { AppSnapshot, ReminderKind } from './types.js';

export interface FloatingAssistantStatus {
  kind: ReminderKind;
  label: string;
  remainingMs: number;
  isDue: boolean;
  tone: 'move' | 'water';
}

const labels: Record<ReminderKind, { due: string; next: string; tone: FloatingAssistantStatus['tone'] }> = {
  sit: {
    due: '该起身了',
    next: '下次起身',
    tone: 'move'
  },
  drink: {
    due: '该喝水了',
    next: '下次喝水',
    tone: 'water'
  }
};

export function getFloatingAssistantStatus(snapshot: AppSnapshot): FloatingAssistantStatus {
  const activeKind = snapshot.activeReminder;
  const nextKind =
    activeKind ??
    (snapshot.clocks.sit.dueAt <= snapshot.clocks.drink.dueAt ? 'sit' : 'drink');
  const remainingMs = snapshot.clocks[nextKind].dueAt - snapshot.now;
  const isDue = remainingMs <= 0 || snapshot.activeReminder === nextKind;
  const copy = labels[nextKind];

  return {
    kind: nextKind,
    label: isDue ? copy.due : copy.next,
    remainingMs,
    isDue,
    tone: copy.tone
  };
}
