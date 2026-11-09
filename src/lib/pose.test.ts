import { describe, expect, it } from "vitest";
import { limbPose, ragdollPose, ragdollTilt } from "./pose";

describe("limbPose", () => {
  it("swings the arms opposite the legs while running", () => {
    const pose = limbPose({
      vx: 4.5,
      vy: 0,
      grounded: true,
      timeMs: 126,
      facing: 1,
    });
    expect(pose.airborne).toBe(false);
    expect(pose.frontLeg).toBeGreaterThan(0.5);
    expect(pose.frontArm).toBeLessThan(-0.5);
    expect(pose.backLeg).toBeLessThan(-0.5);
    expect(pose.backArm).toBeGreaterThan(0.5);
    expect(pose.knee).toBeGreaterThan(0.4);
    expect(pose.facing).toBe(1);
  });

  it("keeps a small idle sway when the broom is standing", () => {
    const still = limbPose({
      vx: 0,
      vy: 0,
      grounded: true,
      timeMs: 0,
      facing: -1,
    });
    const running = limbPose({
      vx: -4.5,
      vy: 0,
      grounded: true,
      timeMs: 126,
      facing: -1,
    });
    expect(still.airborne).toBe(false);
    expect(still.facing).toBe(-1);
    expect(Math.abs(still.frontArm)).toBeLessThan(Math.abs(running.frontArm));
    expect(still.frontLeg).toBeGreaterThan(0);
    expect(still.backLeg).toBeLessThan(0);
  });

  it("tucks the legs on the way up and kicks them on the way down", () => {
    const rising = limbPose({
      vx: 4.5,
      vy: -8,
      grounded: false,
      timeMs: 126,
      facing: 1,
    });
    const falling = limbPose({
      vx: 0,
      vy: 4,
      grounded: false,
      timeMs: 126,
      facing: 1,
    });
    expect(rising.airborne).toBe(true);
    expect(falling.airborne).toBe(true);
    expect(rising.frontLeg).toBeLessThan(0);
    expect(falling.frontLeg).toBeGreaterThan(0);
    expect(rising.knee).toBeGreaterThan(falling.knee);
    expect(rising.frontArm).not.toBeCloseTo(falling.frontArm);
  });

  it("reaches the front arm on a punch and tucks on a dodge", () => {
    const punch = limbPose({
      vx: 0,
      vy: 0,
      grounded: true,
      timeMs: 0,
      facing: 1,
      acting: "punch",
    });
    const punchAir = limbPose({
      vx: 0,
      vy: -4,
      grounded: false,
      timeMs: 0,
      facing: 1,
      acting: "punch",
    });
    const dodge = limbPose({
      vx: 8,
      vy: 0,
      grounded: true,
      timeMs: 0,
      facing: -1,
      acting: "dodge",
    });
    const dodgeAir = limbPose({
      vx: 8,
      vy: 2,
      grounded: false,
      timeMs: 0,
      facing: -1,
      acting: "dodge",
    });
    expect(punch.frontArm).toBeGreaterThan(1);
    expect(punch.airborne).toBe(false);
    expect(punchAir.airborne).toBe(true);
    expect(dodge.frontLeg).toBeGreaterThan(0.5);
    expect(dodge.facing).toBe(-1);
    expect(dodge.airborne).toBe(false);
    expect(dodgeAir.airborne).toBe(true);
  });

  it("flops and then lies down", () => {
    const fresh = ragdollPose(1, 0);
    const done = ragdollPose(-1, 900);
    const later = ragdollPose(-1, 2000);
    expect(fresh.airborne).toBe(true);
    expect(done.airborne).toBe(false);
    expect(done.bob).toBe(6);
    expect(later.frontLeg).toBe(done.frontLeg);
    expect(ragdollTilt(1, 0)).toBe(0);
    expect(ragdollTilt(1, 900)).toBeCloseTo(1.15);
    expect(ragdollTilt(-1, 900)).toBeCloseTo(-1.15);
  });
});
