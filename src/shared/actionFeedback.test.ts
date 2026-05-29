import { describe, expect, it } from 'vitest';
import { completeActionFeedback, getActionFeedback, startActionFeedback } from './actionFeedback.js';

describe('action feedback', () => {
  it('shows progress and completion labels for the clicked reminder action', () => {
    const loading = startActionFeedback(null, 'sit');
    expect(getActionFeedback(loading, 'sit', '已起身')).toEqual({
      label: '记录中...',
      disabled: true
    });
    expect(getActionFeedback(loading, 'drink', '已喝水')).toEqual({
      label: '已喝水',
      disabled: true
    });

    const completed = completeActionFeedback(loading);
    expect(getActionFeedback(completed, 'sit', '已起身')).toEqual({
      label: '已记录',
      disabled: true
    });
  });
});
