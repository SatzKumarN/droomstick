import { COMBAT, type Splash } from "./combat";
import { frameAccel } from "./layout";
import { SIM } from "./constants";
import type { Facing } from "./pose";

export const DEATH = {
  ragdollMs: 900,
  popSpeed: 6.5,
  stainCount: 4,
  maxStains: 24,
} as const;

export type PoppedHead = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  slot: number;
  age: number;
  floorY: number;
};

export type Stain = {
  x: number;
  y: number;
  slot: number;
  seed: number;
};

/** The bristle fan leaves the handle, and a few marks stay on the floor. */
export function startDeath(input: {
  x: number;
  feetY: number;
  facing: Facing;
  slot: number;
  seed: number;
}): { head: PoppedHead; stains: Stain[]; splash: Splash } {
  const stains: Stain[] = [];
  for (let i = 0; i < DEATH.stainCount; i += 1) {
    stains.push({
      x: input.x + (i - 1.5) * 14,
      y: input.feetY - 2,
      slot: input.slot,
      seed: input.seed + 1 + i,
    });
  }
  return {
    head: {
      x: input.x,
      y: input.feetY - 36,
      vx: -input.facing * 1.8,
      vy: -DEATH.popSpeed,
      angle: 0,
      spin: input.facing * 0.22,
      slot: input.slot,
      age: 0,
      floorY: input.feetY,
    },
    stains,
    splash: {
      x: input.x,
      y: input.feetY - 28,
      life: COMBAT.splashLifeMs,
      slot: input.slot,
      seed: input.seed,
      big: true,
    },
  };
}

export function stepHead(head: PoppedHead, dt: number): PoppedHead {
  const age = head.age + dt;
  if (head.vx === 0 && head.vy === 0) return { ...head, age };
  const frame = dt / SIM.dt;
  const vy = head.vy + frameAccel() * frame;
  const y = head.y + vy * frame;
  const x = head.x + head.vx * frame;
  const angle = head.angle + head.spin * frame;
  if (y >= head.floorY || age >= DEATH.ragdollMs) {
    return { ...head, x, y: Math.min(y, head.floorY), vx: 0, vy: 0, spin: 0, angle, age };
  }
  return { ...head, x, y, vy, angle, age };
}

export function keepStains(existing: readonly Stain[], next: readonly Stain[]): Stain[] {
  return [...existing, ...next].slice(0, DEATH.maxStains);
}
