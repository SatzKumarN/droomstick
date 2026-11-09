import Matter from "matter-js";
import { describe, expect, it } from "vitest";
import { MATCH_MS, SIM } from "./constants";
import { CRUMBLE, pieces } from "./crumble";
import type { InputFrame } from "./input";
import { jumpMetrics } from "./layout";
import { createSim, isGrounded, placePlayer, settle, step } from "./physics";

const rest = { punchPressed: false, dodgePressed: false };
const holdRight: InputFrame = { x: 1, jumpPressed: false, jumpHeld: true, ...rest };
const still: InputFrame = { x: 0, jumpPressed: false, jumpHeld: false, ...rest };

function gapPlatforms(gap: number) {
  const h = 40;
  const y = 300;
  const w = 220;
  const leftX = 160;
  return [
    { id: "a", x: leftX, y, w, h },
    { id: "b", x: leftX + w / 2 + gap + w / 2, y, w, h },
  ];
}

function runAndJump(gap: number): { landed: boolean; y: number } {
  const platforms = gapPlatforms(gap);
  const left = platforms[0]!;
  const right = platforms[1]!;
  const sim = createSim({
    platforms,
    spawn: {
      x: left.x + left.w / 2 - SIM.playerWidth / 2 - 1,
      y: left.y - left.h / 2 - SIM.playerHeight / 2 - 1,
    },
  });
  settle(sim, 20);
  expect(isGrounded(sim)).toBe(true);
  step(sim, { ...holdRight, jumpPressed: true });
  let landed = false;
  for (let i = 0; i < 180 && !landed; i += 1) {
    step(sim, holdRight);
    const overRight =
      sim.player.position.x > right.x - right.w / 2 + 8 &&
      sim.player.position.x < right.x + right.w / 2 - 8;
    if (overRight && isGrounded(sim)) landed = true;
  }
  return { landed, y: sim.player.position.y };
}

describe("Matter.js loft", () => {
  it("rests on the floor, hops higher than the beam, and cannot double jump", () => {
    const sim = createSim();
    settle(sim);
    expect(isGrounded(sim)).toBe(true);
    const startY = sim.player.position.y;
    step(sim, { x: 0, jumpPressed: true, jumpHeld: true, ...rest });
    let apex = sim.player.position.y;
    let leftGround = false;
    for (let i = 0; i < 80; i += 1) {
      step(sim, { x: 0, jumpPressed: i === 10, jumpHeld: true, ...rest });
      apex = Math.min(apex, sim.player.position.y);
      if (!isGrounded(sim)) leftGround = true;
    }
    const rise = startY - apex;
    expect(leftGround).toBe(true);
    expect(rise).toBeGreaterThan(jumpMetrics().climb);
    expect(rise).toBeLessThan(jumpMetrics().H * 1.15);
  });

  it("crosses the early gap and falls through the late gap", () => {
    const metrics = jumpMetrics();
    const early = runAndJump(metrics.earlyGap);
    const late = runAndJump(metrics.lateGap);
    expect(early.landed).toBe(true);
    expect(late.landed).toBe(false);
    expect(late.y).toBeGreaterThan(300);
  });

  it("runs across the floor while a jump is held", () => {
    const sim = createSim();
    settle(sim);
    const startX = sim.player.position.x;
    placePlayer(sim, startX, sim.player.position.y);
    for (let i = 0; i < 40; i += 1) step(sim, i === 0 ? { ...holdRight, jumpPressed: true } : holdRight);
    expect(sim.player.position.x).toBeGreaterThan(startX + 20);
    for (let i = 0; i < 20; i += 1) step(sim, still);
  });

  it("chips the dummy, splashes its color, and dodges farther than a run", () => {
    const sim = createSim({ withDummy: true });
    settle(sim);
    const dummy = sim.dummy;
    if (!dummy) throw new Error("dummy missing");
    const dummyX = dummy.position.x;
    step(sim, { ...still, punchPressed: true });
    expect(sim.dummyFighter.hp).toBe(10);
    for (let i = 0; i < 40; i += 1) step(sim, still);
    placePlayer(sim, dummyX - 36, dummy.position.y);
    step(sim, { ...still, punchPressed: true });
    expect(sim.dummyFighter.hp).toBe(9);
    expect(sim.splashes[0]?.slot).toBe(2);
    expect(sim.splashes[0]?.x).toBeLessThan(dummyX);
    expect(sim.splashes[0]?.seed).toBe(1);
    for (let i = 0; i < 40; i += 1) step(sim, still);
    placePlayer(sim, dummy.position.x - 36, dummy.position.y);
    step(sim, { ...still, punchPressed: true });
    const seeds = sim.splashes.map((splash) => splash.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
    expect(seeds).toContain(2);
    for (let i = 0; i < 6; i += 1) step(sim, still);
    expect(dummy.position.x).toBeGreaterThan(dummyX + 8);

    const dodge = createSim();
    settle(dodge);
    const dodgeStart = dodge.player.position.x;
    for (let i = 0; i < 8; i += 1) {
      step(dodge, i === 0 ? { ...still, dodgePressed: true } : still);
    }
    const run = createSim();
    settle(run);
    const runStart = run.player.position.x;
    for (let i = 0; i < 8; i += 1) step(run, holdRight);
    expect(dodge.player.position.x - dodgeStart).toBeGreaterThan(run.player.position.x - runStart);
  });

  it("breaks the loft, drops debris, and kills on a pit or a crush", () => {
    const quiet = createSim({ timed: true });
    step(quiet, still);
    expect(quiet.platforms).toHaveLength(pieces().length);
    expect(quiet.dust).toHaveLength(0);

    const sim = createSim({ timed: true, withDummy: true });
    sim.elapsed = CRUMBLE.dustStart - SIM.dt;
    step(sim, still);
    const dust = sim.dust[0];
    if (!dust || !sim.dummy) throw new Error("dust missing");
    Matter.Body.setPosition(dust, sim.player.position);
    step(sim, still);
    expect(sim.fighter.hp).toBe(9);
    Matter.Body.setPosition(dust, sim.dummy.position);
    step(sim, still);
    expect(sim.dummyFighter.hp).toBe(9);
    sim.elapsed = CRUMBLE.edge - SIM.dt;
    step(sim, still);
    expect(sim.chunks.length).toBeGreaterThan(0);

    const dodging = createSim({ timed: true });
    dodging.elapsed = CRUMBLE.dustStart - SIM.dt;
    step(dodging, { ...still, dodgePressed: true });
    const missed = dodging.dust[0];
    if (!missed) throw new Error("dust missing");
    Matter.Body.setPosition(missed, dodging.player.position);
    step(dodging, still);
    expect(dodging.fighter.hp).toBe(10);

    const crush = createSim({ timed: true });
    crush.elapsed = CRUMBLE.edge - SIM.dt;
    step(crush, { ...still, dodgePressed: true });
    const chunk = crush.chunks[0];
    if (!chunk) throw new Error("chunk missing");
    Matter.Body.setPosition(chunk, {
      x: crush.player.position.x,
      y: crush.player.position.y - 40,
    });
    Matter.Body.setVelocity(chunk, { x: 0, y: 3 });
    step(crush, still);
    expect(crush.fighter.hp).toBe(0);
    expect(crush.heads).toHaveLength(1);
    expect(crush.stains).toHaveLength(4);
    expect(crush.splashes.some((splash) => splash.big)).toBe(true);

    placePlayer(sim, sim.player.position.x, CRUMBLE.pitY + 30);
    Matter.Body.setPosition(sim.dummy, { x: sim.dummy.position.x, y: CRUMBLE.pitY + 30 });
    step(sim, holdRight);
    expect(sim.fighter.hp).toBe(0);
    expect(sim.dummyFighter.hp).toBe(0);
    expect(sim.heads.map((head) => head.slot).sort()).toEqual([1, 2]);
    expect(sim.stains).toHaveLength(8);
    const x = sim.player.position.x;
    step(sim, holdRight);
    expect(sim.player.position.x).toBeCloseTo(x, 0);

    const ended = createSim({ timed: true });
    ended.elapsed = MATCH_MS - 5;
    step(ended, still, 50);
    expect(ended.elapsed).toBe(MATCH_MS);
  });

  it("drives the joined broom and lets a dodge slip a punch", () => {
    const sim = createSim({ withDummy: true });
    settle(sim);
    const start = sim.dummy?.position.x ?? 0;
    const run = { ...still, x: -1 as const };
    for (let i = 0; i < 8; i += 1) step(sim, still, undefined, run);
    expect(sim.dummy?.position.x).toBeLessThan(start - 10);
    step(createSim(), still, undefined, still);

    const duel = createSim({ withDummy: true });
    settle(duel);
    const dummy = duel.dummy;
    if (!dummy) throw new Error("dummy missing");
    step(duel, still, undefined, { ...still, dodgePressed: true });
    placePlayer(duel, dummy.position.x - 36, dummy.position.y);
    step(duel, { ...still, punchPressed: true }, undefined, still);
    expect(duel.dummyFighter.hp).toBe(10);
    for (let i = 0; i < 40; i += 1) step(duel, still, undefined, still);
    placePlayer(duel, dummy.position.x - 36, dummy.position.y);
    step(duel, still, undefined, { ...still, punchPressed: true });
    expect(duel.fighter.hp).toBe(9);
  });

  it("cues a whoosh, a hit, and a crumble", () => {
    const whiff = createSim({ withDummy: true, timed: true });
    settle(whiff);
    step(whiff, { ...still, punchPressed: true });
    expect(whiff.cues.map((cue) => cue.kind)).toEqual(["whoosh"]);
    expect(whiff.cues[0]?.weight).toBe(0);
    step(whiff, still);
    expect(whiff.cues).toHaveLength(1);

    const dodge = createSim({ withDummy: true });
    settle(dodge);
    step(dodge, { ...still, dodgePressed: true });
    expect(dodge.cues[0]).toMatchObject({ kind: "whoosh", weight: 1 });

    const duel = createSim({ withDummy: true });
    settle(duel);
    const dummy = duel.dummy;
    if (!dummy) throw new Error("dummy missing");
    placePlayer(duel, dummy.position.x - 36, dummy.position.y);
    step(duel, { ...still, punchPressed: true });
    expect(duel.cues.map((cue) => cue.kind)).toEqual(["whoosh", "hit"]);
    expect(duel.cues[1]?.weight).toBe(0);

    const chip = createSim({ timed: true });
    chip.elapsed = CRUMBLE.dustStart - SIM.dt;
    step(chip, still);
    const dust = chip.dust[0];
    if (!dust) throw new Error("dust missing");
    Matter.Body.setPosition(dust, chip.player.position);
    step(chip, still);
    expect(chip.cues.some((cue) => cue.kind === "hit" && cue.weight === 0)).toBe(true);

    const slip = createSim({ timed: true });
    slip.elapsed = CRUMBLE.dustStart - SIM.dt;
    step(slip, { ...still, dodgePressed: true });
    const barrel = slip.dust[0];
    if (!barrel) throw new Error("dust missing");
    Matter.Body.setPosition(barrel, slip.player.position);
    const slipped = slip.cues.length;
    step(slip, still);
    expect(slip.cues.slice(slipped).some((cue) => cue.kind === "hit")).toBe(false);

    const loft = createSim({ timed: true });
    loft.elapsed = CRUMBLE.edge - SIM.dt;
    step(loft, still);
    expect(loft.cues.some((cue) => cue.kind === "crumble")).toBe(true);

    const crush = createSim({ timed: true });
    crush.elapsed = CRUMBLE.edge - SIM.dt;
    step(crush, still);
    const chunk = crush.chunks[0];
    if (!chunk) throw new Error("chunk missing");
    Matter.Body.setPosition(chunk, {
      x: crush.player.position.x,
      y: crush.player.position.y - 40,
    });
    Matter.Body.setVelocity(chunk, { x: 0, y: 3 });
    const before = crush.cues.length;
    step(crush, still);
    expect(crush.cues.slice(before).some((cue) => cue.kind === "hit" && cue.weight === 1)).toBe(true);

    const pit = createSim({ timed: true, withDummy: true });
    placePlayer(pit, pit.player.position.x, CRUMBLE.pitY + 30);
    step(pit, still);
    expect(pit.cues.some((cue) => cue.kind === "hit" && cue.weight === 1)).toBe(true);
  });
});
