import { describe, expect, it } from "vitest";
import { HP } from "./constants";
import { applyDamage, canStart, startingHp } from "./rules";

describe("damage", () => {
  it("starts at 10 and lets punches stop at 1 HP", () => {
    expect(startingHp()).toBe(HP);
    expect(applyDamage(10, "punch")).toEqual({ hp: 9, dead: false });
    expect(applyDamage(1, "punch")).toEqual({ hp: 1, dead: false });
  });

  it("lets debris finish a broom and kills on a heavy hit, pit, or crush", () => {
    expect(applyDamage(5, "light")).toEqual({ hp: 4, dead: false });
    expect(applyDamage(1, "light")).toEqual({ hp: 0, dead: true });
    expect(applyDamage(3, "graze")).toEqual({ hp: 1, dead: false });
    expect(applyDamage(2, "graze")).toEqual({ hp: 0, dead: true });
    expect(applyDamage(10, "heavy").dead).toBe(true);
    expect(applyDamage(10, "pit").dead).toBe(true);
    expect(applyDamage(10, "crush").dead).toBe(true);
  });

  it("stays dead", () => {
    expect(applyDamage(0, "light")).toEqual({ hp: 0, dead: true });
  });
});

describe("starting a match", () => {
  it("allows a solo host only in a dev build", () => {
    expect(canStart(1, "dev")).toBe(true);
    expect(canStart(0, "dev")).toBe(false);
    expect(canStart(1, "public")).toBe(false);
    expect(canStart(2, "public")).toBe(true);
  });
});
