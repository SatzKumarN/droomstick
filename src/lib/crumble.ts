import { MATCH_MS } from "./constants";
import { loft, type Platform } from "./layout";
import { applyDamage, type Hit } from "./rules";

export const CRUMBLE = {
  edge: 30_000,
  beamTip: 45_000,
  gap: 60_000,
  mid: 80_000,
  right: 90_000,
  beam: 105_000,
  last: 110_000,
  dustStart: 20_000,
  dustEvery: 4_000,
  pitY: 560,
} as const;

export const BARREL = { w: 28, h: 36 } as const;

export type PieceGroup = "left" | "right" | "beam";

export type Piece = Platform & {
  breakAt: number;
  group: PieceGroup;
};

export type OverlapKind = "none" | "graze" | "solid";

export function pieces(): Piece[] {
  const stage = loft();
  const [left, right, beam] = stage.platforms;
  return [
    ...split(left!, 4, "left", [CRUMBLE.edge, CRUMBLE.last, CRUMBLE.mid, CRUMBLE.gap]),
    ...split(right!, 3, "right", [CRUMBLE.gap, CRUMBLE.right, CRUMBLE.last]),
    ...split(beam!, 2, "beam", [CRUMBLE.beam, CRUMBLE.beamTip]),
  ];
}

function split(platform: Platform, parts: number, group: PieceGroup, breaks: number[]): Piece[] {
  const left = platform.x - platform.w / 2;
  const width = platform.w / parts;
  return breaks.map((breakAt, index) => ({
    id: `${platform.id}-${index}`,
    x: left + width * index + width / 2,
    y: platform.y,
    w: width,
    h: platform.h,
    breakAt,
    group,
  }));
}

export function standingGap(elapsed: number): number {
  const up = pieces().filter((piece) => piece.breakAt > elapsed && piece.group !== "beam");
  const leftEdge = Math.max(...up.filter((piece) => piece.group === "left").map((piece) => piece.x + piece.w / 2));
  const rightEdge = Math.min(...up.filter((piece) => piece.group === "right").map((piece) => piece.x - piece.w / 2));
  return rightEdge - leftEdge;
}

export function dustDue(elapsed: number, spawned: number): boolean {
  if (elapsed < CRUMBLE.dustStart) return false;
  const count = 1 + Math.floor((elapsed - CRUMBLE.dustStart) / CRUMBLE.dustEvery);
  return spawned < count;
}

const BARREL_LANES = [110, 250, 390, 520, 650, 790, 900];

export function dustOrigin(index: number): { x: number; y: number } {
  const lane = (index * 3) % BARREL_LANES.length;
  return { x: BARREL_LANES[lane]!, y: -30 };
}

export function overlapKind(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  pad = 8,
): OverlapKind {
  const solid =
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  if (solid) return "solid";
  const grown = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
  const graze =
    a.x < grown.x + grown.w &&
    a.x + a.w > grown.x &&
    a.y < grown.y + grown.h &&
    a.y + a.h > grown.y;
  return graze ? "graze" : "none";
}

export function resolveHit(input: {
  hp: number;
  dodging: boolean;
  already: boolean;
  kind: OverlapKind;
  heavy: boolean;
  falling: boolean;
  overhead: boolean;
}): { hp: number; dead: boolean; mark: boolean } {
  if (input.already || input.kind === "none") {
    return { hp: input.hp, dead: input.hp <= 0, mark: false };
  }
  if (input.hp <= 0) return { hp: 0, dead: true, mark: false };
  if (input.heavy && !(input.falling && input.overhead)) {
    return { hp: input.hp, dead: false, mark: false };
  }
  const crush = input.heavy && input.kind === "solid";
  if (input.dodging && !crush) return { hp: input.hp, dead: false, mark: false };
  const hit: Hit = crush ? "crush" : input.kind === "graze" ? "graze" : "light";
  const next = applyDamage(input.hp, hit);
  return { hp: next.hp, dead: next.dead, mark: true };
}

export function formatClock(remainingMs: number): string {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export function tickMatch(elapsed: number, dt: number): number {
  if (elapsed >= MATCH_MS) return MATCH_MS;
  return Math.min(MATCH_MS, elapsed + dt);
}
