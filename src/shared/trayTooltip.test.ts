import { describe, expect, it } from 'vitest';
import { createInitialClocks } from './reminderEngine.js';
import { formatTrayTooltip } from './trayTooltip.js';
import { defaultSettings } from './defaults.js';

describe('tray tooltip', () => {
  it('shows the nearest upcoming reminder and both countdowns', () => {
    const clocks = createInitialClocks(defaultSettings, 0);

    expect(formatTrayTooltip({ clocks, paused: false, now: 30 * 60_000 })).toBe(
      ['健康助手', '下次提醒：喝水 剩余 15分钟', '起身：30分钟', '喝水：15分钟'].join('\n')
    );
  });

  it('shows paused state without counting down', () => {
    const clocks = createInitialClocks(defaultSettings, 0);

    expect(formatTrayTooltip({ clocks, paused: true, now: 30 * 60_000 })).toBe(
      ['健康助手', '提醒已暂停', '起身：30分钟', '喝水：15分钟'].join('\n')
    );
  });

  it('ignores disabled clocks when choosing the next reminder', () => {
    const clocks = createInitialClocks({ ...defaultSettings, drinkEnabled: false }, 0);

    expect(formatTrayTooltip({ clocks, paused: false, now: 30 * 60_000 })).toBe(
      ['健康助手', '下次提醒：起身 剩余 30分钟', '起身：30分钟', '喝水：已关闭'].join('\n')
    );
  });
});
