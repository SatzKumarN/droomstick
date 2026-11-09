import { HP } from "./constants";
import { applyDamage } from "./rules";
import type { Facing } from "./pose";

export const COMBAT = {
  /** Stick Fight punches only connect during the first 0.2s of the swing. */
  punchActiveMs: 200,
  punchRecoverMs: 350,
  dodgeMs: 350,
  dodgeCooldownMs: 1200,
  dodgeSpeed: 8,
  knockback: 7,
  reach: 36,
  hitHeight: 48,
  splashLifeMs: 1000,
} as const;

export type Fighter = {
  hp: number;
  punchMs: number;
  dodgeMs: number;
  dodgeCooldownMs: number;
};

export type Box = { x: number; y: number; w: number; h: number };

export type Splash = {
  x: number;
  y: number;
  life: number;
  slot: number;
  seed: number;
  big?: boolean;
};

/** Center of the overlapping area, which is where the punch meets the broom. */
export function impactPoint(a: Box, b: Box): { x: number; y: number } {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

export function createFighter(): Fighter {
  return { hp: HP, punchMs: 0, dodgeMs: 0, dodgeCooldownMs: 0 };
}

export function isPunching(fighter: Fighter): boolean {
  return fighter.punchMs > COMBAT.punchRecoverMs;
}

export function isDodging(fighter: Fighter): boolean {
  return fighter.dodgeMs > 0;
}

export function stepFighter(
  fighter: Fighter,
  input: { punchPressed: boolean; dodgePressed: boolean },
  dt: number,
): Fighter {
  let punchMs = Math.max(0, fighter.punchMs - dt);
  let dodgeMs = Math.max(0, fighter.dodgeMs - dt);
  let dodgeCooldownMs = Math.max(0, fighter.dodgeCooldownMs - dt);
  const busy = punchMs > 0 || dodgeMs > 0;
  if (input.dodgePressed && dodgeCooldownMs === 0 && !busy) {
    dodgeMs = COMBAT.dodgeMs;
    dodgeCooldownMs = COMBAT.dodgeCooldownMs;
  } else if (input.punchPressed && !busy) {
    punchMs = COMBAT.punchActiveMs + COMBAT.punchRecoverMs;
  }
  return { hp: fighter.hp, punchMs, dodgeMs, dodgeCooldownMs };
}

export function punchBox(x: number, y: number, facing: Facing): Box {
  return {
    x: facing === 1 ? x : x - COMBAT.reach,
    y: y - COMBAT.hitHeight / 2,
    w: COMBAT.reach,
    h: COMBAT.hitHeight,
  };
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function strike(
  hp: number,
  dodging: boolean,
): { hp: number; knocked: boolean; splash: boolean } {
  if (dodging) return { hp, knocked: false, splash: false };
  const next = applyDamage(hp, "punch");
  return { hp: next.hp, knocked: true, splash: true };
}

export function ageSplashes(splashes: readonly Splash[], dt: number): Splash[] {
  return splashes
    .map((splash) => ({ ...splash, life: splash.life - dt }))
    .filter((splash) => splash.life > 0);
}
