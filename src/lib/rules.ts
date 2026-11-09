import { HP } from "./constants";

export type Hit = "punch" | "light" | "graze" | "heavy" | "pit" | "crush";
export type Build = "dev" | "public";

export function startingHp(): number {
  return HP;
}

/** Dev builds can start alone. The public build needs two players. */
export function canStart(playerCount: number, build: Build): boolean {
  const minimum = build === "public" ? 2 : 1;
  return playerCount >= minimum;
}

/**
 * Punches chip health and stop at 1 HP. Light debris and grazes can finish
 * a broom. A heavy landing, a pit, or a crush kills outright.
 */
export function applyDamage(
  hp: number,
  hit: Hit,
): { hp: number; dead: boolean } {
  if (hp <= 0) return { hp: 0, dead: true };
  if (hit === "heavy" || hit === "pit" || hit === "crush") {
    return { hp: 0, dead: true };
  }
  const loss = hit === "graze" ? 2 : 1;
  if (hit === "punch") {
    return { hp: Math.max(1, hp - loss), dead: false };
  }
  const next = hp - loss;
  return next <= 0 ? { hp: 0, dead: true } : { hp: next, dead: false };
}
