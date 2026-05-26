import type { ReminderKind } from './types.js';

export type ActionFeedback =
  | { kind: ReminderKind; status: 'loading' }
  | { kind: ReminderKind; status: 'done' }
  | null;

export function startActionFeedback(_current: ActionFeedback, kind: ReminderKind): ActionFeedback {
  return { kind, status: 'loading' };
}

export function completeActionFeedback(current: ActionFeedback): ActionFeedback {
  if (!current) {
    return null;
  }
  return { ...current, status: 'done' };
}

export function getActionFeedback(
  feedback: ActionFeedback,
  kind: ReminderKind,
  defaultLabel: string
): { label: string; disabled: boolean } {
  if (!feedback) {
    return { label: defaultLabel, disabled: false };
  }

  if (feedback.kind !== kind) {
    return { label: defaultLabel, disabled: true };
  }

  return {
    label: feedback.status === 'loading' ? '记录中...' : '已记录',
    disabled: true
  };
}
