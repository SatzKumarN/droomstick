import Matter from "matter-js";
import { describe, expect, it } from "vitest";
import { createSim } from "./physics";
import { applySnap, captureSnap, type Snap } from "./snap";

describe("snapshots", () => {
  it("copies the host world onto a guest", () => {
    const host = createSim({ withDummy: true, timed: true });
    host.player.position.x = 40;
    host.fighter = { ...host.fighter, hp: 7 };
    host.elapsed = 1200;
    host.splashes = [{ x: 1, y: 2, life: 10, slot: 2, seed: 3 }];
    host.dust.push(Matter.Bodies.rectangle(12, 14, 10, 10));
    host.chunks.push(Matter.Bodies.rectangle(18, 22, 30, 12));
    host.platforms.pop();
    host.heads = [
      { x: 3, y: 4, vx: 0, vy: 0, angle: 0.2, spin: 0, slot: 1, age: 10, floorY: 20 },
    ];
    host.stains = [{ x: 1, y: 2, slot: 1, seed: 5 }];
    host.cues = [{ id: 3, kind: "crumble", weight: 0 }];
    host.sfxEpoch = 2;
    const snap = captureSnap(host);
    const guest = createSim({ withDummy: true, timed: true });
    applySnap(guest, snap);
    expect(guest.player.position.x).toBe(40);
    expect(guest.fighter.hp).toBe(7);
    expect(guest.elapsed).toBe(1200);
    expect(guest.splashes).toEqual(host.splashes);
    expect(guest.heads).toEqual(host.heads);
    expect(guest.stains).toEqual(host.stains);
    expect(guest.cues).toEqual(host.cues);
    expect(guest.sfxEpoch).toBe(2);
    expect(guest.platforms).toHaveLength(host.platforms.length);
    applySnap(guest, { ...snap, barrels: [{ x: 300, y: 20, angle: 0.2 }], chunks: [{ x: 80, y: 90, angle: 0, w: 40, h: 20 }] });
    applySnap(guest, { ...snap, barrels: [{ x: 310, y: 24, angle: 0 }], chunks: [{ x: 88, y: 90, angle: 0, w: 40, h: 20 }] });
    expect(guest.dust[0]?.position.x).toBe(310);
    expect(guest.chunks).toHaveLength(1);
    applySnap(guest, { ...snap, barrels: [], chunks: [] });
    expect(guest.dust).toHaveLength(0);
    expect(guest.chunks).toHaveLength(0);
    const solo = createSim();
    applySnap(solo, { ...captureSnap(solo), dummy: null });
    expect(solo.dummy).toBeNull();
    solo.sfxEpoch = 4;
    solo.cues = [{ id: 1, kind: "hit", weight: 0 }];
    const { cues: _cues, sfxEpoch: _epoch, ...older } = captureSnap(solo);
    applySnap(solo, older as Snap);
    expect(solo.cues).toEqual([]);
    expect(solo.sfxEpoch).toBe(4);
  });
});