import { describe, expect, it } from "vitest";
import { MATCH_MS } from "./constants";
import {
  CRUMBLE,
  dustDue,
  dustOrigin,
  formatClock,
  overlapKind,
  pieces,
  resolveHit,
  standingGap,
  tickMatch,
} from "./crumble";
import { jumpMetrics } from "./layout";

describe("crumbling loft", () => {
  it("starts as one jump and opens past a jump at one minute", () => {
    expect(standingGap(0)).toBeCloseTo(jumpMetrics().earlyGap);
    expect(standingGap(CRUMBLE.gap)).toBeGreaterThan(jumpMetrics().D);
    expect(pieces().some((piece) => piece.breakAt === CRUMBLE.edge)).toBe(true);
    expect(new Set(pieces().map((piece) => piece.id)).size).toBe(pieces().length);
  });

  it("drops light debris on a timer", () => {
    expect(dustDue(CRUMBLE.dustStart - 1, 0)).toBe(false);
    expect(dustDue(CRUMBLE.dustStart, 0)).toBe(true);
    expect(dustDue(CRUMBLE.dustStart, 1)).toBe(false);
    expect(dustDue(CRUMBLE.dustStart + CRUMBLE.dustEvery, 1)).toBe(true);
    const spots = [0, 1, 2, 3, 4, 5, 6].map((index) => dustOrigin(index).x);
    expect(new Set(spots).size).toBe(spots.length);
    expect(Math.max(...spots) - Math.min(...spots)).toBeGreaterThan(500);
    expect(dustOrigin(0).y).toBeLessThan(0);
    expect(dustOrigin(7).x).toBe(dustOrigin(0).x);
  });
});

describe("hazard hits", () => {
  const body = { x: 0, y: 0, w: 20, h: 20 };
  const actor = { x: 10, y: 10, w: 20, h: 20 };
  const clear = { x: 40, y: 40, w: 10, h: 10 };
  const beside = { x: 22, y: 0, w: 10, h: 10 };

  it("tells a solid hit from a graze and a miss", () => {
    expect(overlapKind(actor, body)).toBe("solid");
    expect(overlapKind(actor, beside)).toBe("graze");
    expect(overlapKind(actor, clear)).toBe("none");
  });

  it("lets a dodge skip debris but not a crush from above", () => {
    expect(
      resolveHit({
        hp: 10,
        dodging: true,
        already: false,
        kind: "solid",
        heavy: false,
        falling: true,
        overhead: true,
      }),
    ).toEqual({ hp: 10, dead: false, mark: false });
    expect(
      resolveHit({
        hp: 10,
        dodging: true,
        already: false,
        kind: "solid",
        heavy: true,
        falling: true,
        overhead: true,
      }).hp,
    ).toBe(0);
    expect(
      resolveHit({
        hp: 4,
        dodging: false,
        already: false,
        kind: "graze",
        heavy: false,
        falling: true,
        overhead: true,
      }).hp,
    ).toBe(2);
    expect(
      resolveHit({
        hp: 10,
        dodging: false,
        already: false,
        kind: "solid",
        heavy: false,
        falling: true,
        overhead: true,
      }).hp,
    ).toBe(9);
  });

  it("ignores a floor you are standing on, a repeat hit, and a miss", () => {
    expect(
      resolveHit({
        hp: 10,
        dodging: false,
        already: false,
        kind: "solid",
        heavy: true,
        falling: true,
        overhead: false,
      }).mark,
    ).toBe(false);
    expect(
      resolveHit({
        hp: 8,
        dodging: false,
        already: false,
        kind: "graze",
        heavy: true,
        falling: true,
        overhead: true,
      }).hp,
    ).toBe(6);
    expect(
      resolveHit({
        hp: 8,
        dodging: false,
        already: false,
        kind: "solid",
        heavy: true,
        falling: false,
        overhead: true,
      }).mark,
    ).toBe(false);
    expect(
      resolveHit({
        hp: 3,
        dodging: false,
        already: true,
        kind: "solid",
        heavy: false,
        falling: true,
        overhead: true,
      }),
    ).toEqual({ hp: 3, dead: false, mark: false });
    expect(
      resolveHit({
        hp: 0,
        dodging: false,
        already: false,
        kind: "none",
        heavy: false,
        falling: true,
        overhead: true,
      }).dead,
    ).toBe(true);
    expect(
      resolveHit({
        hp: 0,
        dodging: false,
        already: false,
        kind: "solid",
        heavy: false,
        falling: true,
        overhead: true,
      }).mark,
    ).toBe(false);
  });
});

describe("match clock", () => {
  it("formats the remaining time and stops at the end", () => {
    expect(formatClock(MATCH_MS)).toBe("2:00");
    expect(formatClock(59_000)).toBe("0:59");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(-20)).toBe("0:00");
    expect(tickMatch(MATCH_MS - 10, 50)).toBe(MATCH_MS);
    expect(tickMatch(MATCH_MS, 50)).toBe(MATCH_MS);
    expect(tickMatch(0, 16)).toBe(16);
  });
});
