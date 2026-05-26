import { describe, expect, it } from 'vitest';
import { placeInBottomRight } from './windowPlacement.js';

describe('window placement', () => {
  it('places a window in the bottom-right corner with margin', () => {
    expect(
      placeInBottomRight({
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
        window: { width: 460, height: 310 },
        margin: 24
      })
    ).toEqual({ x: 1436, y: 706 });
  });
});
