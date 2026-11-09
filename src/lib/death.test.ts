import { describe, expect, it } from "vitest";
import { SIM } from "./constants";
import { DEATH, keepStains, startDeath, stepHead, type Stain } from "./death";

describe("death", () => {
  it("pops the head off and leaves stains in that color", () => {
    const red = startDeath({ x: 100, feetY: 200, facing: 1, slot: 1, seed: 8 });
    expect(red.head.y).toBeLessThan(200);
    expect(red.head.vy).toBe(-DEATH.popSpeed);
    expect(red.head.vx).toBeLessThan(0);
    expect(red.splash.big).toBe(true);
    expect(red.stains).toHaveLength(DEATH.stainCount);
    expect(red.stains.every((stain) => stain.slot === 1)).toBe(true);
    const blue = startDeath({ x: 100, feetY: 200, facing: -1, slot: 2, seed: 3 });
    expect(blue.head.vx).toBeGreaterThan(0);
    expect(blue.head.spin).toBeLessThan(0);
  });

  it("tumbles, lands, and then stays put", () => {
    const { head } = startDeath({ x: 40, feetY: 80, facing: 1, slot: 1, seed: 1 });
    const coast = stepHead({ ...head, vx: 0, vy: -1 }, SIM.dt);
    expect(coast.y).toBeLessThan(head.y);
    const rising = stepHead(head, SIM.dt);
    expect(rising.y).toBeLessThan(head.y);
    expect(rising.vy).toBeGreaterThan(head.vy);
    const low = stepHead({ ...head, y: head.floorY - 1, vy: 4, vx: 1 }, SIM.dt);
    expect(low.y).toBe(head.floorY);
    expect(low.vx).toBe(0);
    expect(low.vy).toBe(0);
    const hung = stepHead({ ...head, floorY: 10_000, age: DEATH.ragdollMs - 1 }, SIM.dt);
    expect(hung.vy).toBe(0);
    expect(hung.y).toBeLessThan(head.floorY);
    const still = stepHead(low, SIM.dt);
    expect(still.x).toBe(low.x);
    expect(still.age).toBeGreaterThan(low.age);
  });

  it("stops adding stains once the floor is covered", () => {
    const one = (seed: number): Stain => ({ x: seed, y: 1, slot: 1, seed });
    const few = [one(1)];
    expect(keepStains(few, [one(2)])).toHaveLength(2);
    const full = Array.from({ length: DEATH.maxStains }, (_, seed) => one(seed));
    expect(keepStains(full, [one(99)])).toHaveLength(DEATH.maxStains);
  });
});
