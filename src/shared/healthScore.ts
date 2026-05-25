export interface ScoreInput {
  sitCount: number;
  drinkCount: number;
  workMinutes: number;
}

export interface Rating {
  label: string;
  color: string;
}

export function calculateHealthScore(input: ScoreInput): number {
  const workHours = input.workMinutes / 60;
  if (workHours <= 0) {
    return 0;
  }

  const idealSitCount = Math.max(1, Math.floor(workHours));
  const idealDrinkCount = Math.max(1, Math.floor(workHours * 1.5));
  const sitScore = Math.min(40, (input.sitCount / idealSitCount) * 40);
  const drinkScore = Math.min(40, (input.drinkCount / idealDrinkCount) * 40);

  let workScore: number;
  if (workHours >= 4 && workHours <= 8) {
    workScore = 20;
  } else if (workHours < 4) {
    workScore = (workHours / 4) * 20;
  } else {
    workScore = Math.max(0, 20 - (workHours - 8) * 4);
  }

  return Math.max(0, Math.min(100, Math.round(sitScore + drinkScore + workScore)));
}

export function healthRating(score: number): Rating {
  if (score >= 90) {
    return { label: '优秀', color: '#22c55e' };
  }
  if (score >= 75) {
    return { label: '良好', color: '#38bdf8' };
  }
  if (score >= 60) {
    return { label: '一般', color: '#f59e0b' };
  }
  return { label: '需要改善', color: '#fb7185' };
}

export function healthSuggestions(input: ScoreInput): string[] {
  const workHours = input.workMinutes / 60;
  const suggestions: string[] = [];
  const idealSitCount = Math.max(1, Math.floor(workHours));
  const idealDrinkCount = Math.max(1, Math.floor(workHours * 1.5));

  if (input.sitCount < idealSitCount) {
    suggestions.push('建议每小时至少起身活动一次。');
  }
  if (input.drinkCount < idealDrinkCount) {
    suggestions.push('喝水次数偏少，可以把水杯放在手边。');
  }
  if (workHours > 8) {
    suggestions.push('今天工作时间较长，安排一次真正离屏休息。');
  }
  if (suggestions.length === 0) {
    suggestions.push('节奏不错，继续保持这些健康习惯。');
  }

  return suggestions;
}
