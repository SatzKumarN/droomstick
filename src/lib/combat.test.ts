import { describe, expect, it } from "vitest";
import {
  COMBAT,
  ageSplashes,
  boxesOverlap,
  createFighter,
  impactPoint,
  isDodging,
  isPunching,
  punchBox,
  stepFighter,
  strike,
} from "./combat";
import { HP } from "./constants";

const idle = { punchPressed: false, dodgePressed: false };

describe("stepFighter", () => {
  it("starts a punch and ignores another until it finishes", () => {
    const started = stepFighter(createFighter(), { ...idle, punchPressed: true }, 16);
    expect(isPunching(started)).toBe(true);
    expect(started.hp).toBe(HP);
    const again = stepFighter(started, { ...idle, punchPressed: true }, 16);
    expect(again.punchMs).toBeLessThan(started.punchMs);
    const recovering = stepFighter(
      { ...createFighter(), punchMs: COMBAT.punchRecoverMs },
      { ...idle, punchPressed: true },
      0,
    );
    expect(isPunching(recovering)).toBe(false);
    expect(recovering.punchMs).toBe(COMBAT.punchRecoverMs);
  });

  it("dodges, then waits out the cooldown", () => {
    const dodging = stepFighter(createFighter(), { ...idle, dodgePressed: true }, 16);
    expect(isDodging(dodging)).toBe(true);
    const blocked = stepFighter(dodging, { ...idle, dodgePressed: true, punchPressed: true }, 16);
    expect(blocked.dodgeMs).toBeLessThan(dodging.dodgeMs);
    expect(isPunching(blocked)).toBe(false);
    const cooling = stepFighter(
      { ...createFighter(), dodgeCooldownMs: 400 },
      { ...idle, dodgePressed: true },
      16,
    );
    expect(isDodging(cooling)).toBe(false);
    expect(cooling.dodgeCooldownMs).toBeLessThan(400);
  });

  it("does not dodge during a punch", () => {
    const punching = stepFighter(createFighter(), { ...idle, punchPressed: true }, 0);
    const stayed = stepFighter(punching, { ...idle, dodgePressed: true }, 0);
    expect(isPunching(stayed)).toBe(true);
    expect(isDodging(stayed)).toBe(false);
  });
});

describe("punch hit", () => {
  it("reaches forward and knocks a broom that is not dodging", () => {
    const right = punchBox(100, 200, 1);
    const left = punchBox(100, 200, -1);
    expect(right.x).toBe(100);
    expect(left.x).toBe(100 - COMBAT.reach);
    const body = { x: 120, y: 180, w: 26, h: 56 };
    expect(boxesOverlap(right, body)).toBe(true);
    expect(boxesOverlap(left, body)).toBe(false);
    expect(boxesOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(impactPoint(right, body)).toEqual({ x: 128, y: 202 });
    const hit = strike(HP, false);
    expect(hit).toEqual({ hp: 9, knocked: true, splash: true });
    expect(strike(1, false).hp).toBe(1);
    expect(strike(4, true)).toEqual({ hp: 4, knocked: false, splash: false });
  });

  it("drops splashes after they fade", () => {
    const live = ageSplashes([{ x: 1, y: 2, life: 30, slot: 2, seed: 7 }], 16);
    expect(live).toEqual([{ x: 1, y: 2, life: 14, slot: 2, seed: 7 }]);
    expect(ageSplashes(live, 14)).toEqual([]);
  });
});
