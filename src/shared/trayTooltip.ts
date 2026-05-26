import type { ReminderClock, ReminderKind } from './types.js';

const reminderLabels: Record<ReminderKind, string> = {
  sit: '起身',
  drink: '喝水'
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes <= 0) {
    return '现在';
  }
  if (totalMinutes < 60) {
    return `${totalMinutes}分钟`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}小时` : `${hours}小时${minutes}分钟`;
}

function formatClockLine(clock: ReminderClock, now: number): string {
  const label = reminderLabels[clock.kind];
  if (!clock.enabled) {
    return `${label}：已关闭`;
  }
  return `${label}：${formatDuration(clock.dueAt - now)}`;
}

export function formatTrayTooltip({
  clocks,
  paused,
  now
}: {
  clocks: Record<ReminderKind, ReminderClock>;
  paused: boolean;
  now: number;
}): string {
  const enabledClocks = Object.values(clocks).filter(clock => clock.enabled);
  const nextClock = enabledClocks.sort((left, right) => left.dueAt - right.dueAt)[0];
  const status = paused
    ? '提醒已暂停'
    : nextClock
      ? `下次提醒：${reminderLabels[nextClock.kind]} 剩余 ${formatDuration(nextClock.dueAt - now)}`
      : '提醒已关闭';

  return ['健康助手', status, formatClockLine(clocks.sit, now), formatClockLine(clocks.drink, now)].join('\n');
}
