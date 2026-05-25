import { describe, expect, it } from 'vitest';
import { calculateHealthScore, healthRating, healthSuggestions } from './healthScore.js';

describe('health score', () => {
  it('rewards hourly movement, regular water, and balanced work time', () => {
    expect(calculateHealthScore({ sitCount: 6, drinkCount: 9, workMinutes: 360 })).toBe(100);
  });

  it('penalizes missed reminders and very long work sessions', () => {
    expect(calculateHealthScore({ sitCount: 1, drinkCount: 1, workMinutes: 600 })).toBeLessThan(45);
  });

  it('maps scores to clear ratings', () => {
    expect(healthRating(92).label).toBe('优秀');
    expect(healthRating(65).label).toBe('一般');
    expect(healthRating(40).label).toBe('需要改善');
  });

  it('creates practical suggestions from gaps', () => {
    const suggestions = healthSuggestions({ sitCount: 1, drinkCount: 1, workMinutes: 480 });

    expect(suggestions.join(' ')).toContain('起身');
    expect(suggestions.join(' ')).toContain('喝水');
  });
});
