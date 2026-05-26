type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Size = {
  width: number;
  height: number;
};

export function placeInBottomRight(options: {
  workArea: Bounds;
  window: Size;
  margin: number;
}): { x: number; y: number } {
  return {
    x: options.workArea.x + options.workArea.width - options.window.width - options.margin,
    y: options.workArea.y + options.workArea.height - options.window.height - options.margin
  };
}
