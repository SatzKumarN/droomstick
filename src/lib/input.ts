export type InputFrame = {
  /** -1 left, 1 right, 0 neither or both. */
  x: -1 | 0 | 1;
  jumpPressed: boolean;
  jumpHeld: boolean;
  punchPressed: boolean;
  dodgePressed: boolean;
};

const LEFT = new Set(["a", "arrowleft"]);
const RIGHT = new Set(["d", "arrowright"]);
const JUMP = new Set(["w", "arrowup", " ", "space"]);
const PUNCH = new Set(["f", "j", "k"]);
const DODGE = new Set(["l", "shift"]);

function has(keys: ReadonlySet<string>, names: ReadonlySet<string>): boolean {
  for (const key of keys) {
    if (names.has(key)) return true;
  }
  return false;
}

export function frameFromKeys(
  down: ReadonlySet<string>,
  pressed: ReadonlySet<string>,
): InputFrame {
  const left = has(down, LEFT);
  const right = has(down, RIGHT);
  return {
    x: left === right ? 0 : left ? -1 : 1,
    jumpHeld: has(down, JUMP),
    jumpPressed: has(pressed, JUMP),
    punchPressed: has(pressed, PUNCH),
    dodgePressed: has(pressed, DODGE),
  };
}

export type ButtonBox = { x: number; y: number; w: number; h: number };

export type ControlLayout = {
  width: number;
  height: number;
  stick: { cx: number; cy: number; r: number };
  jump: ButtonBox;
  punch: ButtonBox;
  dodge: ButtonBox;
};

export function controlLayout(width: number, height: number): ControlLayout {
  const r = Math.max(48, Math.min(width, height) * 0.12);
  const button = { w: 84, h: 60 };
  const gap = 10;
  const right = width - 24 - button.w;
  const bottom = height - 24 - button.h;
  return {
    width,
    height,
    stick: { cx: r + 28, cy: height - r - 28, r },
    jump: { x: right, y: bottom, ...button },
    punch: { x: right - button.w - gap, y: bottom, ...button },
    dodge: { x: right, y: bottom - button.h - gap, ...button },
  };
}

export type TouchPoint = { id: number; x: number; y: number };

export type HeldTouches = {
  jump: readonly number[];
  punch: readonly number[];
  dodge: readonly number[];
};

export function noTouches(): HeldTouches {
  return { jump: [], punch: [], dodge: [] };
}

function inside(point: TouchPoint, box: ButtonBox): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.w &&
    point.y >= box.y &&
    point.y <= box.y + box.h
  );
}

function pressed(ids: readonly number[], prior: readonly number[]): boolean {
  return ids.some((id) => !prior.includes(id));
}

export function frameFromTouches(
  points: readonly TouchPoint[],
  layout: ControlLayout,
  prior: HeldTouches,
): { frame: InputFrame; held: HeldTouches } {
  const jump: number[] = [];
  const punch: number[] = [];
  const dodge: number[] = [];
  let x: -1 | 0 | 1 = 0;
  for (const point of points) {
    if (inside(point, layout.jump)) {
      jump.push(point.id);
      continue;
    }
    if (inside(point, layout.punch)) {
      punch.push(point.id);
      continue;
    }
    if (inside(point, layout.dodge)) {
      dodge.push(point.id);
      continue;
    }
    const dx = point.x - layout.stick.cx;
    const dy = point.y - layout.stick.cy;
    const reach = Math.hypot(dx, dy);
    if (reach > layout.stick.r * 1.35) continue;
    if (Math.abs(dx) < layout.stick.r * 0.35) continue;
    x = dx < 0 ? -1 : 1;
  }
  return {
    frame: {
      x,
      jumpHeld: jump.length > 0,
      jumpPressed: pressed(jump, prior.jump),
      punchPressed: pressed(punch, prior.punch),
      dodgePressed: pressed(dodge, prior.dodge),
    },
    held: { jump, punch, dodge },
  };
}

export function mergeFrames(a: InputFrame, b: InputFrame): InputFrame {
  const sum = a.x + b.x;
  const x: -1 | 0 | 1 = sum < 0 ? -1 : sum > 0 ? 1 : 0;
  return {
    x,
    jumpHeld: a.jumpHeld || b.jumpHeld,
    jumpPressed: a.jumpPressed || b.jumpPressed,
    punchPressed: a.punchPressed || b.punchPressed,
    dodgePressed: a.dodgePressed || b.dodgePressed,
  };
}

/** Portrait phones must rotate before a round runs. A square view is allowed. */
export function needsLandscape(width: number, height: number): boolean {
  return height > width;
}
