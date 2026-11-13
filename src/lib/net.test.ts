import { describe, expect, it } from "vitest";
import { createSeries } from "./series";
import type { Snap } from "./snap";
import {
  anotherCode,
  codeFromPeer,
  decode,
  clockRuns,
  copiedStatus,
  doorButtons,
  encode,
  heldInput,
  kickButton,
  layoutDoor,
  makeCode,
  openSlot,
  parseJoinCode,
  peerIdFor,
  takeGuestInput,
} from "./net";

const frame = {
  x: 1 as const,
  jumpPressed: true,
  jumpHeld: true,
  punchPressed: false,
  dodgePressed: false,
};

describe("room codes", () => {
  it("builds a six-digit peer id and reads it back", () => {
    expect(makeCode(() => 0)).toBe("100000");
    expect(makeCode(() => 0.999999)).toBe("999999");
    expect(peerIdFor("123456")).toBe("droom-123456");
    expect(codeFromPeer("droom-123456")).toBe("123456");
    expect(codeFromPeer("room-123456")).toBeNull();
    expect(codeFromPeer("droom-12345")).toBeNull();
    expect(parseJoinCode("12-34 56")).toBe("123456");
    expect(parseJoinCode("12345")).toBeNull();
    expect(anotherCode("100000", () => 0.5)).toBe("550000");
    let flip = false;
    expect(
      anotherCode("100000", () => {
        flip = !flip;
        return flip ? 0 : 0.5;
      }),
    ).toBe("550000");
  });

  it("keeps the second broom for the friend who joins", () => {
    expect(openSlot([])).toBe(1);
    expect(openSlot([1])).toBe(2);
    expect(openSlot([1, 2])).toBeNull();
  });
});

describe("messages", () => {
  it("keeps held movement and drops the one-frame buttons", () => {
    expect(heldInput(frame)).toEqual({ ...frame, jumpPressed: false });
    const later = { ...frame, x: 0 as const, jumpPressed: false, punchPressed: true };
    expect(takeGuestInput(null, later)).toEqual(later);
    expect(takeGuestInput(frame, later)).toMatchObject({
      x: 0,
      jumpPressed: true,
      punchPressed: true,
      jumpHeld: true,
    });
  });

  it("round-trips known messages and drops junk", () => {
    const welcome = encode({ t: "welcome", slot: 2, roster: [1, 2] });
    expect(decode(welcome)).toEqual({ t: "welcome", slot: 2, roster: [1, 2] });
    expect(decode(encode({ t: "input", frame }))).toEqual({ t: "input", frame });
    expect(decode(encode({ t: "start" }))).toEqual({ t: "start" });
    expect(decode(encode({ t: "hello", name: "  Sam!! " }))).toEqual({ t: "hello", name: "Sam" });
    expect(decode(JSON.stringify({ t: "hello" }))).toBeNull();
    expect(decode(JSON.stringify({ t: "hello", name: 4 }))).toBeNull();
    expect(decode(encode({ t: "skip" }))).toEqual({ t: "skip" });
    expect(decode(encode({ t: "full" }))).toEqual({ t: "full" });
    expect(decode(encode({ t: "kick" }))).toEqual({ t: "kick" });
    const snap = { elapsed: 0 } as Snap;
    const series = createSeries([1, 2]);
    expect(decode(encode({ t: "snap", snap, series }))?.t).toBe("snap");
    expect(decode("nope")).toBeNull();
    expect(decode("null")).toBeNull();
    expect(decode("[]")).toBeNull();
    expect(decode(JSON.stringify({ t: "nope" }))).toBeNull();
    expect(decode(JSON.stringify({ t: "welcome", slot: "2" }))).toBeNull();
    expect(decode(JSON.stringify({ t: "welcome", slot: 2, roster: [1, "x"] }))).toBeNull();
    expect(decode(JSON.stringify({ t: "input", frame: { x: 2 } }))).toBeNull();
    expect(decode(JSON.stringify({ t: "input", frame: { ...frame, jumpHeld: "yes" } }))).toBeNull();
    expect(decode(JSON.stringify({ t: "snap" }))).toBeNull();
    expect(decode(JSON.stringify({ t: "snap", snap: null, series: {} }))).toBeNull();
    expect(decode(JSON.stringify({ t: "welcome" }))).toBeNull();
    expect(decode(JSON.stringify({ t: "input" }))).toBeNull();
    expect(decode(JSON.stringify({ t: "input", frame: null }))).toBeNull();
    expect(decode(JSON.stringify({ t: "input", frame: { ...frame, jumpPressed: "no" } }))).toBeNull();
    expect(decode(JSON.stringify({ t: "input", frame: { ...frame, punchPressed: "no" } }))).toBeNull();
    expect(decode(JSON.stringify({ t: "input", frame: { ...frame, dodgePressed: "no" } }))).toBeNull();
    expect(decode(JSON.stringify({ t: "snap", snap: {}, series: null }))).toBeNull();
    expect(decode(JSON.stringify({ t: "welcome", roster: [1] }))).toBeNull();
    expect(decode(JSON.stringify({ t: "welcome", slot: 2, roster: "nope" }))).toBeNull();
  });
});

describe("door buttons", () => {
  it("stacks practice, host, and join", () => {
    const pick = doorButtons("pick", 960, 540, false);
    expect(pick.map((button) => button.id)).toEqual(["practice", "host", "join"]);
    expect(pick[0]?.h).toBeGreaterThanOrEqual(48);
    expect(doorButtons("host", 960, 540, false).map((button) => button.id)).toEqual(["cancel"]);
    expect(doorButtons("host", 960, 540, false, true).map((button) => button.id)).toEqual(["copy", "cancel"]);
    expect(doorButtons("host", 960, 540, true, true).map((button) => button.id)).toEqual([
      "copy",
      "start",
      "kick",
      "cancel",
    ]);
    const join = doorButtons("join", 800, 500, false);
    expect(join.map((button) => button.id)).toEqual([
      "d1",
      "d2",
      "d3",
      "d4",
      "d5",
      "d6",
      "d7",
      "d8",
      "d9",
      "d0",
      "back",
      "cancel",
    ]);
    expect(doorButtons("notice", 800, 500, false)[0]?.label).toBe("Back");
    expect(kickButton(960).id).toBe("kick");
    expect(kickButton(960).y).toBe(120);
    expect(kickButton(400).y).toBeGreaterThan(120);
  });

  it("keeps the room code and the buttons on a short or portrait screen", () => {
    for (const [width, height] of [
      [960, 540],
      [568, 320],
      [390, 844],
      [844, 390],
    ] as const) {
      for (const view of ["pick", "host", "join", "notice"] as const) {
        const layout = layoutDoor(view, width, height, true, true);
        expect(layout.panel.y).toBeGreaterThanOrEqual(52);
        expect(layout.panel.y + layout.panel.h).toBeLessThanOrEqual(height + 1);
        expect(layout.titleY).toBeGreaterThan(layout.panel.y);
        expect(layout.titleY).toBeLessThan(layout.panel.y + layout.panel.h);
        for (const button of layout.buttons) {
          expect(button.x).toBeGreaterThanOrEqual(0);
          expect(button.y).toBeGreaterThanOrEqual(0);
          expect(button.x + button.w).toBeLessThanOrEqual(width + 1);
          expect(button.y + button.h).toBeLessThanOrEqual(height + 1);
          expect(button.h).toBeGreaterThanOrEqual(32);
        }
      }
    }
    const shortHost = layoutDoor("host", 568, 320, true, true);
    expect(shortHost.lineY - shortHost.titleY).toBeGreaterThanOrEqual(26);
    expect(layoutDoor("join", 568, 320, false).lineY - layoutDoor("join", 568, 320, false).titleY).toBeGreaterThanOrEqual(26);
    expect(layoutDoor("pick", 960, 540, false).field).not.toBeNull();
    expect(layoutDoor("host", 390, 844, true, true).buttons.map((button) => button.id)).toEqual([
      "copy",
      "start",
      "kick",
      "cancel",
    ]);
  });
});

describe("host clock", () => {
  it("stops while the tab that runs the match is hidden", () => {
    expect(clockRuns("host", false)).toBe(true);
    expect(clockRuns("local", false)).toBe(true);
    expect(clockRuns("host", true)).toBe(false);
    expect(clockRuns("guest", false)).toBe(false);
    expect(copiedStatus("Waiting for a friend")).toBe("Code copied. Waiting for a friend");
    expect(copiedStatus("Code copied. Waiting for a friend")).toBe("Code copied. Waiting for a friend");
  });
});
