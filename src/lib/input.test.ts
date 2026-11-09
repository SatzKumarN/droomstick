import { describe, expect, it } from "vitest";
import {
  controlLayout,
  frameFromKeys,
  frameFromTouches,
  mergeFrames,
  needsLandscape,
  noTouches,
} from "./input";

describe("keyboard", () => {
  it("maps arrows, letters, and space", () => {
    expect(frameFromKeys(new Set(["q", "a"]), new Set())).toMatchObject({ x: -1 });
    expect(frameFromKeys(new Set(["d"]), new Set())).toMatchObject({ x: 1 });
    expect(frameFromKeys(new Set(["arrowright"]), new Set())).toMatchObject({ x: 1 });
    expect(frameFromKeys(new Set(["a", "d"]), new Set())).toMatchObject({ x: 0 });
    const jump = frameFromKeys(new Set([" "]), new Set(["w"]));
    expect(jump.jumpHeld).toBe(true);
    expect(jump.jumpPressed).toBe(true);
    expect(frameFromKeys(new Set(), new Set(["f"])).punchPressed).toBe(true);
    expect(frameFromKeys(new Set(), new Set(["k"])).punchPressed).toBe(true);
    expect(frameFromKeys(new Set(), new Set(["shift"])).dodgePressed).toBe(true);
    expect(frameFromKeys(new Set(), new Set(["l"])).dodgePressed).toBe(true);
  });

  it("ignores unrelated keys", () => {
    expect(frameFromKeys(new Set(["q"]), new Set(["e"]))).toEqual({
      x: 0,
      jumpHeld: false,
      jumpPressed: false,
      punchPressed: false,
      dodgePressed: false,
    });
  });
});

describe("touch", () => {
  const layout = controlLayout(960, 540);

  it("gives the jump button a large target and treats a new touch as a press", () => {
    expect(layout.jump.w).toBeGreaterThanOrEqual(48);
    expect(layout.jump.h).toBeGreaterThanOrEqual(48);
    const point = {
      id: 4,
      x: layout.jump.x + 10,
      y: layout.jump.y + 10,
    };
    const first = frameFromTouches([point], layout, noTouches());
    expect(first.frame.jumpPressed).toBe(true);
    expect(first.frame.jumpHeld).toBe(true);
    const held = frameFromTouches([point], layout, first.held);
    expect(held.frame.jumpPressed).toBe(false);
    expect(held.frame.jumpHeld).toBe(true);
  });

  it("reads the stick direction and ignores a deadzone or a distant finger", () => {
    const left = frameFromTouches(
      [{ id: 1, x: layout.stick.cx - layout.stick.r, y: layout.stick.cy }],
      layout,
      noTouches(),
    );
    const right = frameFromTouches(
      [{ id: 1, x: layout.stick.cx + layout.stick.r, y: layout.stick.cy }],
      layout,
      noTouches(),
    );
    const still = frameFromTouches(
      [{ id: 1, x: layout.stick.cx + 2, y: layout.stick.cy }],
      layout,
      noTouches(),
    );
    const away = frameFromTouches([{ id: 1, x: 400, y: 100 }], layout, noTouches());
    expect(left.frame.x).toBe(-1);
    expect(right.frame.x).toBe(1);
    expect(still.frame.x).toBe(0);
    expect(away.frame.x).toBe(0);
    expect(frameFromTouches([], layout, noTouches()).frame).toEqual({
      x: 0,
      jumpHeld: false,
      jumpPressed: false,
      punchPressed: false,
      dodgePressed: false,
    });
  });

  it("presses punch and dodge once per new touch", () => {
    expect(layout.punch.w).toBeGreaterThanOrEqual(48);
    expect(layout.dodge.h).toBeGreaterThanOrEqual(48);
    const punch = { id: 2, x: layout.punch.x + 8, y: layout.punch.y + 8 };
    const dodge = { id: 3, x: layout.dodge.x + 8, y: layout.dodge.y + 8 };
    const first = frameFromTouches([punch, dodge], layout, noTouches());
    expect(first.frame.punchPressed).toBe(true);
    expect(first.frame.dodgePressed).toBe(true);
    const held = frameFromTouches([punch, dodge], layout, first.held);
    expect(held.frame.punchPressed).toBe(false);
    expect(held.frame.dodgePressed).toBe(false);
  });
});

describe("merge and orientation", () => {
  it("lets either device jump and cancels opposite directions", () => {
    const off = {
      x: 0 as const,
      jumpPressed: false,
      jumpHeld: false,
      punchPressed: false,
      dodgePressed: false,
    };
    const merged = mergeFrames(
      { ...off, x: -1, punchPressed: true },
      { ...off, x: 1, jumpPressed: true, jumpHeld: true, dodgePressed: true },
    );
    expect(merged).toEqual({
      x: 0,
      jumpPressed: true,
      jumpHeld: true,
      punchPressed: true,
      dodgePressed: true,
    });
    expect(mergeFrames({ ...off, x: 1 }, off).x).toBe(1);
  });

  it("keeps a single direction", () => {
    const off = {
      x: 0 as const,
      jumpPressed: false,
      jumpHeld: false,
      punchPressed: false,
      dodgePressed: false,
    };
    expect(mergeFrames({ ...off, x: -1 }, off).x).toBe(-1);
  });

  it("asks for landscape only when the screen is taller than it is wide", () => {
    expect(needsLandscape(400, 800)).toBe(true);
    expect(needsLandscape(800, 400)).toBe(false);
    expect(needsLandscape(600, 600)).toBe(false);
  });
});
