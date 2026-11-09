export type Facing = -1 | 1;

export type LimbPose = {
  facing: Facing;
  bob: number;
  frontLeg: number;
  backLeg: number;
  frontArm: number;
  backArm: number;
  knee: number;
  airborne: boolean;
};

/** A dead broom flops, then lies still. */
export function ragdollPose(facing: Facing, ageMs: number): LimbPose {
  const t = Math.min(1, ageMs / 900);
  const flop = Math.sin(ageMs / 80) * (1 - t);
  return {
    facing,
    bob: 6 * t,
    frontLeg: 0.6 + flop,
    backLeg: -1.1 - flop * 0.4,
    frontArm: -1.3 + flop,
    backArm: 1.2 - flop,
    knee: 1.15,
    airborne: t < 0.5,
  };
}

/** Tip from upright to lying on the side the broom faced. */
export function ragdollTilt(facing: Facing, ageMs: number): number {
  const t = Math.min(1, ageMs / 900);
  return facing * (0.45 * Math.sin(ageMs / 90) * (1 - t) + 1.15 * t);
}

export function limbPose(input: {
  vx: number;
  vy: number;
  grounded: boolean;
  timeMs: number;
  facing: Facing;
  acting?: "punch" | "dodge";
}): LimbPose {
  if (input.acting === "punch" || input.acting === "dodge") {
    const punching = input.acting === "punch";
    return {
      facing: input.facing,
      bob: punching ? 0 : -2,
      frontLeg: punching ? 0.2 : 0.9,
      backLeg: punching ? -0.15 : 0.2,
      frontArm: punching ? 1.2 : -0.3,
      backArm: punching ? -0.9 : 0.5,
      knee: punching ? 0.15 : 0.35,
      airborne: !input.grounded,
    };
  }
  if (!input.grounded) {
    const rising = input.vy < 0;
    return {
      facing: input.facing,
      bob: 0,
      frontLeg: rising ? -0.95 : 0.55,
      backLeg: rising ? -0.4 : 1.05,
      frontArm: rising ? -1.35 : -0.35,
      backArm: rising ? -0.75 : 0.85,
      knee: rising ? 1.1 : 0.3,
      airborne: true,
    };
  }

  if (Math.abs(input.vx) <= 0.5) {
    const idle = Math.sin(input.timeMs / 320);
    return {
      facing: input.facing,
      bob: idle * 1.2,
      frontLeg: 0.28,
      backLeg: -0.22,
      frontArm: 0.32 + idle * 0.12,
      backArm: -0.4 - idle * 0.1,
      knee: 0.12,
      airborne: false,
    };
  }

  const swing = Math.sin(input.timeMs / 80);
  return {
    facing: input.facing,
    bob: -Math.abs(Math.cos(input.timeMs / 80)) * 2,
    frontLeg: swing * 0.75,
    backLeg: -swing * 0.75,
    frontArm: -swing * 0.9,
    backArm: swing * 0.9,
    knee: 0.4 + Math.abs(swing) * 0.55,
    airborne: false,
  };
}
