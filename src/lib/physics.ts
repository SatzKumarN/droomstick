import Matter from "matter-js";
import {
  COMBAT,
  ageSplashes,
  boxesOverlap,
  createFighter,
  isDodging,
  isPunching,
  impactPoint,
  punchBox,
  stepFighter,
  strike,
  type Fighter,
  type Splash,
} from "./combat";
import { SIM } from "./constants";
import {
  BARREL,
  CRUMBLE,
  dustDue,
  dustOrigin,
  overlapKind,
  pieces,
  resolveHit,
  tickMatch,
  type Piece,
} from "./crumble";
import type { InputFrame } from "./input";
import { createJumpMemory, updateJump, type JumpMemory } from "./jump";
import { keepStains, startDeath, stepHead, type PoppedHead, type Stain } from "./death";
import { loft, type Platform } from "./layout";
import type { Facing } from "./pose";
import { pushCue, type SfxCue, type SfxKind, type SfxWeight } from "./sfx";

export type Sim = {
  engine: Matter.Engine;
  player: Matter.Body;
  dummy: Matter.Body | null;
  platforms: Matter.Body[];
  jump: JumpMemory;
  fighter: Fighter;
  dummyFighter: Fighter;
  facing: Facing;
  dummyFacing: Facing;
  dummyJump: JumpMemory;
  dummyPunchSpent: boolean;
  punchSpent: boolean;
  splashSeed: number;
  splashes: Splash[];
  timed: boolean;
  elapsed: number;
  breaks: { body: Matter.Body; at: number; id: string; released: boolean }[];
  chunks: Matter.Body[];
  dust: Matter.Body[];
  dustSpawned: number;
  hurt: Set<string>;
  heads: PoppedHead[];
  stains: Stain[];
  sfxId: number;
  sfxEpoch: number;
  cues: SfxCue[];
};

function actor(x: number, y: number, label: string, frictionAir = 0): Matter.Body {
  return Matter.Bodies.rectangle(x, y, SIM.playerWidth, SIM.playerHeight, {
    friction: 0,
    frictionAir,
    frictionStatic: 0,
    restitution: 0,
    inertia: Infinity,
    label,
  });
}

function block(platform: Platform, isStatic: boolean): Matter.Body {
  return Matter.Bodies.rectangle(platform.x, platform.y, platform.w, platform.h, {
    isStatic,
    friction: 0.05,
    restitution: 0,
    label: platform.id,
  });
}

export function createSim(options?: {
  platforms?: Platform[];
  spawn?: { x: number; y: number };
  withDummy?: boolean;
  timed?: boolean;
}): Sim {
  const stage = loft();
  const timed = options?.timed === true;
  const layout = timed ? pieces() : (options?.platforms ?? stage.platforms);
  const spawn = options?.spawn ?? stage.spawn;
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: SIM.gravity } });
  engine.enableSleeping = false;
  const player = actor(spawn.x, spawn.y, "player");
  const dummy = options?.withDummy ? actor(spawn.x + 170, spawn.y, "dummy", 0.15) : null;
  const bodies = layout.map((platform) => block(platform, true));
  const breaks = timed
    ? bodies.map((body, index) => ({
        body,
        at: (layout[index] as Piece).breakAt,
        id: layout[index]!.id,
        released: false,
      }))
    : [];
  Matter.Composite.add(engine.world, dummy ? [player, dummy, ...bodies] : [player, ...bodies]);
  return {
    engine,
    player,
    dummy,
    platforms: bodies,
    jump: createJumpMemory(),
    fighter: createFighter(),
    dummyFighter: createFighter(),
    facing: 1,
    dummyFacing: -1,
    dummyJump: createJumpMemory(),
    dummyPunchSpent: false,
    punchSpent: false,
    splashSeed: 1,
    splashes: [],
    timed,
    elapsed: 0,
    breaks,
    chunks: [],
    dust: [],
    dustSpawned: 0,
    hurt: new Set(),
    heads: [],
    stains: [],
    sfxId: 1,
    sfxEpoch: 1,
    cues: [],
  };
}

function hear(sim: Sim, kind: SfxKind, weight: SfxWeight): void {
  const next = pushCue(sim.cues, sim.sfxId, kind, weight);
  sim.cues = next.cues;
  sim.sfxId = next.nextId;
}

export function placePlayer(sim: Sim, x: number, y: number): void {
  Matter.Body.setPosition(sim.player, { x, y });
  Matter.Body.setVelocity(sim.player, { x: 0, y: 0 });
  Matter.Body.setAngle(sim.player, 0);
  sim.player.force.x = 0;
  sim.player.force.y = 0;
  sim.jump = createJumpMemory();
}

function onGround(sim: Sim, body: Matter.Body): boolean {
  const bottom = body.bounds.max.y;
  return sim.platforms.some((platform) => {
    const overlapX =
      body.bounds.max.x > platform.bounds.min.x + 1 && body.bounds.min.x < platform.bounds.max.x - 1;
    const gap = bottom - platform.bounds.min.y;
    return overlapX && gap >= -2 && gap <= 14 && body.velocity.y >= -0.5;
  });
}

export function isGrounded(sim: Sim): boolean {
  return onGround(sim, sim.player);
}

function boundsBox(body: Matter.Body): { x: number; y: number; w: number; h: number } {
  return {
    x: body.bounds.min.x,
    y: body.bounds.min.y,
    w: body.bounds.max.x - body.bounds.min.x,
    h: body.bounds.max.y - body.bounds.min.y,
  };
}

function harm(
  sim: Sim,
  who: "player" | "dummy",
  actor: Matter.Body,
  hazard: Matter.Body,
  heavy: boolean,
  dodging: boolean,
): void {
  const fighter = who === "player" ? sim.fighter : sim.dummyFighter;
  const kind = overlapKind(boundsBox(actor), boundsBox(hazard));
  const result = resolveHit({
    hp: fighter.hp,
    dodging,
    already: sim.hurt.has(`${hazard.id}:${who}`),
    kind,
    heavy,
    falling: hazard.velocity.y > 0.4,
    overhead: hazard.position.y < actor.position.y,
  });
  if (who === "player") sim.fighter = { ...sim.fighter, hp: result.hp };
  else sim.dummyFighter = { ...sim.dummyFighter, hp: result.hp };
  if (!result.mark) return;
  sim.hurt.add(`${hazard.id}:${who}`);
  if (result.dead) {
    pop(sim, who, actor);
    return;
  }
  hear(sim, "hit", 0);
  sim.splashes.push({
    x: actor.position.x,
    y: actor.position.y,
    life: COMBAT.splashLifeMs,
    slot: who === "player" ? 1 : 2,
    seed: sim.splashSeed,
  });
  sim.splashSeed += 1;
}

function releasePiece(sim: Sim, piece: Sim["breaks"][number]): void {
  const { body } = piece;
  const chunk = block(
    {
      id: `chunk-${piece.id}`,
      x: body.position.x,
      y: body.position.y,
      w: body.bounds.max.x - body.bounds.min.x,
      h: body.bounds.max.y - body.bounds.min.y,
    },
    false,
  );
  Matter.Body.setVelocity(chunk, { x: 0, y: 2 });
  Matter.Composite.remove(sim.engine.world, body);
  Matter.Composite.add(sim.engine.world, chunk);
  sim.platforms = sim.platforms.filter((platform) => platform !== body);
  sim.chunks.push(chunk);
  piece.released = true;
  hear(sim, "crumble", 0);
}

function spawnDust(sim: Sim): void {
  const origin = dustOrigin(sim.dustSpawned);
  const dust = Matter.Bodies.rectangle(origin.x, origin.y, BARREL.w, BARREL.h, {
    chamfer: { radius: 10 },
    friction: 0.2,
    restitution: 0.12,
    label: `barrel-${sim.dustSpawned}`,
  });
  Matter.Composite.add(sim.engine.world, dust);
  sim.dust.push(dust);
  sim.dustSpawned += 1;
}

function fallInPit(sim: Sim, who: "player" | "dummy"): void {
  const actor = who === "player" ? sim.player : sim.dummy;
  const fighter = who === "player" ? sim.fighter : sim.dummyFighter;
  if (!actor || actor.position.y < CRUMBLE.pitY || fighter.hp <= 0) return;
  if (who === "player") sim.fighter = { ...sim.fighter, hp: 0 };
  else sim.dummyFighter = { ...sim.dummyFighter, hp: 0 };
  pop(sim, who, actor);
}

function pop(sim: Sim, who: "player" | "dummy", actor: Matter.Body): void {
  const slot = who === "player" ? 1 : 2;
  const facing = who === "player" ? sim.facing : sim.dummyFacing;
  const death = startDeath({
    x: actor.position.x,
    feetY: actor.bounds.max.y,
    facing,
    slot,
    seed: sim.splashSeed,
  });
  sim.splashSeed += 1 + death.stains.length;
  sim.heads.push(death.head);
  sim.stains = keepStains(sim.stains, death.stains);
  sim.splashes.push(death.splash);
  hear(sim, "hit", 1);
}

function hazards(sim: Sim): void {
  if (!sim.timed) return;
  for (const piece of sim.breaks) {
    if (!piece.released && sim.elapsed >= piece.at) releasePiece(sim, piece);
  }
  if (dustDue(sim.elapsed, sim.dustSpawned)) spawnDust(sim);
  fallInPit(sim, "player");
  fallInPit(sim, "dummy");
  for (const chunk of sim.chunks) {
    harm(sim, "player", sim.player, chunk, true, isDodging(sim.fighter));
    if (sim.dummy) harm(sim, "dummy", sim.dummy, chunk, true, isDodging(sim.dummyFighter));
  }
  for (const dust of sim.dust) {
    harm(sim, "player", sim.player, dust, false, isDodging(sim.fighter));
    if (sim.dummy) harm(sim, "dummy", sim.dummy, dust, false, isDodging(sim.dummyFighter));
  }
}

function steer(
  sim: Sim,
  who: "player" | "dummy",
  input: InputFrame,
  dt: number,
): void {
  const body = who === "player" ? sim.player : sim.dummy;
  if (!body) return;
  const fighter = who === "player" ? sim.fighter : sim.dummyFighter;
  const alive = fighter.hp > 0;
  if (alive && input.x !== 0) {
    if (who === "player") sim.facing = input.x;
    else sim.dummyFacing = input.x;
  }
  const next = stepFighter(fighter, alive ? input : { punchPressed: false, dodgePressed: false }, dt);
  if (who === "player") sim.fighter = next;
  else sim.dummyFighter = next;
  const startedDodge = fighter.dodgeMs === 0 && next.dodgeMs > 0;
  const startedPunch = fighter.punchMs === 0 && next.punchMs > 0;
  if (startedDodge) hear(sim, "whoosh", 1);
  else if (startedPunch) hear(sim, "whoosh", 0);
  const memory = who === "player" ? sim.jump : sim.dummyJump;
  const jumped = updateJump(memory, {
    grounded: onGround(sim, body),
    jumpPressed: alive && input.jumpPressed,
    jumpHeld: alive && input.jumpHeld,
    verticalVelocity: body.velocity.y,
    dt,
  });
  if (who === "player") sim.jump = jumped.memory;
  else sim.dummyJump = jumped.memory;
  const current = who === "player" ? sim.fighter : sim.dummyFighter;
  const facing = who === "player" ? sim.facing : sim.dummyFacing;
  const speed = isDodging(current) ? COMBAT.dodgeSpeed : SIM.runSpeed;
  const vx = !alive ? 0 : isDodging(current) ? facing * speed : input.x * speed;
  Matter.Body.setVelocity(body, { x: vx, y: jumped.velocityY });
  Matter.Body.setAngle(body, 0);
  if (who === "dummy") body.frictionAir = 0;
}

function swing(sim: Sim, who: "player" | "dummy"): void {
  const attacker = who === "player" ? sim.player : sim.dummy;
  const victim = who === "player" ? sim.dummy : sim.player;
  const fighter = who === "player" ? sim.fighter : sim.dummyFighter;
  const victimFighter = who === "player" ? sim.dummyFighter : sim.fighter;
  if (!attacker || !victim) return;
  const punching = isPunching(fighter);
  const spent = who === "player" ? sim.punchSpent : sim.dummyPunchSpent;
  if (!punching) {
    if (who === "player") sim.punchSpent = false;
    else sim.dummyPunchSpent = false;
    return;
  }
  if (spent) return;
  const facing = who === "player" ? sim.facing : sim.dummyFacing;
  const hit = punchBox(attacker.position.x, attacker.position.y, facing);
  const bounds = victim.bounds;
  const box = {
    x: bounds.min.x,
    y: bounds.min.y,
    w: bounds.max.x - bounds.min.x,
    h: bounds.max.y - bounds.min.y,
  };
  if (!boxesOverlap(hit, box)) return;
  const result = strike(victimFighter.hp, isDodging(victimFighter));
  if (who === "player") {
    sim.dummyFighter = { ...sim.dummyFighter, hp: result.hp };
    sim.punchSpent = true;
  } else {
    sim.fighter = { ...sim.fighter, hp: result.hp };
    sim.dummyPunchSpent = true;
  }
  if (!result.knocked) return;
  Matter.Body.setVelocity(victim, { x: facing * COMBAT.knockback, y: victim.velocity.y });
  const impact = impactPoint(hit, box);
  sim.splashes.push({
    x: impact.x,
    y: impact.y,
    life: COMBAT.splashLifeMs,
    slot: who === "player" ? 2 : 1,
    seed: sim.splashSeed,
  });
  sim.splashSeed += 1;
  hear(sim, "hit", 0);
}

export function step(sim: Sim, input: InputFrame, dt = SIM.dt, guest?: InputFrame): void {
  steer(sim, "player", input, dt);
  if (guest) steer(sim, "dummy", guest, dt);
  else if (sim.dummy) Matter.Body.setAngle(sim.dummy, 0);
  swing(sim, "player");
  if (guest) swing(sim, "dummy");
  sim.splashes = ageSplashes(sim.splashes, dt);
  if (sim.timed) sim.elapsed = tickMatch(sim.elapsed, dt);
  hazards(sim);
  sim.heads = sim.heads.map((head) => stepHead(head, dt));
  Matter.Engine.update(sim.engine, dt);
}

export function settle(sim: Sim, frames = 30): void {
  const still: InputFrame = {
    x: 0,
    jumpPressed: false,
    jumpHeld: false,
    punchPressed: false,
    dodgePressed: false,
  };
  for (let i = 0; i < frames; i += 1) step(sim, still);
}
