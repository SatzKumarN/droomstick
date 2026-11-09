import Matter from "matter-js";
import { BARREL } from "./crumble";
import type { PoppedHead, Stain } from "./death";
import type { Facing } from "./pose";
import type { Sim } from "./physics";
import type { Splash } from "./combat";
import type { SfxCue } from "./sfx";

export type BodySnap = { x: number; y: number; angle: number };

export type ActorSnap = BodySnap & {
  vx: number;
  vy: number;
  hp: number;
  facing: Facing;
};

export type Snap = {
  elapsed: number;
  player: ActorSnap;
  dummy: ActorSnap | null;
  platforms: string[];
  barrels: BodySnap[];
  chunks: (BodySnap & { w: number; h: number })[];
  splashes: Splash[];
  heads: PoppedHead[];
  stains: Stain[];
  cues: SfxCue[];
  sfxEpoch: number;
};

export function captureSnap(sim: Sim): Snap {
  return {
    elapsed: sim.elapsed,
    player: actorSnap(sim.player, sim.fighter.hp, sim.facing),
    dummy: sim.dummy ? actorSnap(sim.dummy, sim.dummyFighter.hp, sim.dummyFacing) : null,
    platforms: sim.platforms.map((body) => body.label),
    barrels: sim.dust.map(bodySnap),
    chunks: sim.chunks.map((body) => ({
      ...bodySnap(body),
      w: body.bounds.max.x - body.bounds.min.x,
      h: body.bounds.max.y - body.bounds.min.y,
    })),
    splashes: sim.splashes.map((splash) => ({ ...splash })),
    heads: sim.heads.map((head) => ({ ...head })),
    stains: sim.stains.map((stain) => ({ ...stain })),
    cues: sim.cues.map((cue) => ({ ...cue })),
    sfxEpoch: sim.sfxEpoch,
  };
}

export function applySnap(sim: Sim, snap: Snap): void {
  placeActor(sim.player, snap.player);
  sim.fighter = { ...sim.fighter, hp: snap.player.hp };
  sim.facing = snap.player.facing;
  sim.elapsed = snap.elapsed;
  sim.splashes = snap.splashes.map((splash) => ({ ...splash }));
  sim.heads = snap.heads.map((head) => ({ ...head }));
  sim.stains = snap.stains.map((stain) => ({ ...stain }));
  sim.cues = (snap.cues ?? []).map((cue) => ({ ...cue }));
  sim.sfxEpoch = snap.sfxEpoch ?? sim.sfxEpoch;
  if (sim.dummy && snap.dummy) {
    placeActor(sim.dummy, snap.dummy);
    sim.dummyFighter = { ...sim.dummyFighter, hp: snap.dummy.hp };
    sim.dummyFacing = snap.dummy.facing;
  }
  sim.platforms = sim.platforms.filter((body) => {
    if (snap.platforms.includes(body.label)) return true;
    Matter.Composite.remove(sim.engine.world, body);
    return false;
  });
  for (const piece of sim.breaks) {
    if (!snap.platforms.includes(piece.id)) piece.released = true;
  }
  syncBodies(sim, sim.dust, snap.barrels, (item) =>
    Matter.Bodies.rectangle(item.x, item.y, BARREL.w, BARREL.h, {
      chamfer: { radius: 10 },
      label: "barrel",
    }),
  );
  syncBodies(sim, sim.chunks, snap.chunks, (item) =>
    Matter.Bodies.rectangle(item.x, item.y, item.w, item.h, { label: "chunk" }),
  );
}

function actorSnap(body: Matter.Body, hp: number, facing: Facing): ActorSnap {
  return { ...bodySnap(body), vx: body.velocity.x, vy: body.velocity.y, hp, facing };
}

function bodySnap(body: Matter.Body): BodySnap {
  return { x: body.position.x, y: body.position.y, angle: body.angle };
}

function placeActor(body: Matter.Body, snap: ActorSnap): void {
  Matter.Body.setPosition(body, { x: snap.x, y: snap.y });
  Matter.Body.setVelocity(body, { x: snap.vx, y: snap.vy });
  Matter.Body.setAngle(body, snap.angle);
}

function syncBodies<T extends BodySnap>(
  sim: Sim,
  current: Matter.Body[],
  snaps: readonly T[],
  make: (snap: T) => Matter.Body,
): void {
  while (current.length > snaps.length) {
    Matter.Composite.remove(sim.engine.world, current.pop()!);
  }
  snaps.forEach((item, index) => {
    const existing = current[index];
    if (!existing) {
      const body = make(item);
      Matter.Body.setAngle(body, item.angle);
      current.push(body);
      Matter.Composite.add(sim.engine.world, body);
      return;
    }
    Matter.Body.setPosition(existing, { x: item.x, y: item.y });
    Matter.Body.setAngle(existing, item.angle);
    Matter.Body.setVelocity(existing, { x: 0, y: 0 });
  });
}
