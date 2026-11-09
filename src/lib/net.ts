import type { InputFrame } from "./input";
import { clampName } from "./name";
import type { Series } from "./series";
import type { Snap } from "./snap";

export function makeCode(random: () => number = Math.random): string {
  return String(Math.floor(100000 + random() * 900000));
}

export function anotherCode(previous: string, random: () => number = Math.random): string {
  const next = makeCode(random);
  return next === previous ? makeCode(random) : next;
}

export function peerIdFor(code: string): string {
  return `droom-${code}`;
}

export function codeFromPeer(id: string): string | null {
  const match = /^droom-(\d{6})$/.exec(id);
  return match?.[1] ?? null;
}

export function parseJoinCode(text: string): string | null {
  const digits = text.replace(/\D/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

/** This loft has the host and one friend. A third broom is turned away. */
export function openSlot(taken: readonly number[]): number | null {
  if (!taken.includes(1)) return 1;
  if (!taken.includes(2)) return 2;
  return null;
}

export function heldInput(frame: InputFrame): InputFrame {
  return { ...frame, jumpPressed: false, punchPressed: false, dodgePressed: false };
}

export type NetMessage =
  | { t: "welcome"; slot: number; roster: number[] }
  | { t: "hello"; name: string }
  | { t: "input"; frame: InputFrame }
  | { t: "start" }
  | { t: "snap"; snap: Snap; series: Series }
  | { t: "skip" }
  | { t: "kick" }
  | { t: "full" };

export function encode(message: NetMessage): string {
  return JSON.stringify(message);
}

export function decode(raw: string): NetMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || !("t" in value)) return null;
  const kind = (value as { t?: unknown }).t;
  if (kind === "start" || kind === "skip" || kind === "kick" || kind === "full") return { t: kind };
  if (kind === "welcome") return welcome(value);
  if (kind === "hello") return hello(value);
  if (kind === "input") return inputMessage(value);
  if (kind === "snap") return snapMessage(value);
  return null;
}

export type DoorView =
  | { kind: "pick" }
  | { kind: "host"; code: string; status: string; canStart: boolean }
  | { kind: "join"; digits: string; status: string }
  | { kind: "notice"; status: string }
  | { kind: "play" };

/** The match clock runs on the host, and it stops while that tab is hidden. */
export function clockRuns(role: "local" | "host" | "guest", hidden: boolean): boolean {
  if (role === "guest") return false;
  return !hidden;
}

export function copiedStatus(status: string): string {
  return status.startsWith("Code copied") ? status : `Code copied. ${status}`;
}

export type DoorButton = {
  id: "practice" | "host" | "join" | "start" | "cancel" | "copy" | "kick";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

export function kickButton(width: number): DoorButton {
  return { id: "kick", x: width - 124, y: 96, w: 96, h: 40, label: "Kick" };
}

export function doorButtons(
  view: "pick" | "host" | "join" | "notice",
  width: number,
  height: number,
  canStart: boolean,
  copy = false,
): DoorButton[] {
  const w = 180;
  const h = 52;
  const x = (width - w) / 2;
  const top = height / 2 - 10;
  const stack = (labels: { id: DoorButton["id"]; label: string }[]): DoorButton[] =>
    labels.map((button, index) => ({
      ...button,
      x,
      y: top + index * (h + 12),
      w,
      h,
    }));
  if (view === "pick") {
    return stack([
      { id: "practice", label: "Practice" },
      { id: "host", label: "Host" },
      { id: "join", label: "Join" },
    ]);
  }
  if (view === "host") {
    const buttons: { id: DoorButton["id"]; label: string }[] = [];
    if (copy) buttons.push({ id: "copy", label: "Copy" });
    if (canStart) {
      buttons.push({ id: "start", label: "Start" }, { id: "kick", label: "Kick" });
    }
    buttons.push({ id: "cancel", label: "Cancel" });
    return stack(buttons);
  }
  if (view === "notice") return stack([{ id: "cancel", label: "Back" }]);
  return stack([{ id: "cancel", label: "Cancel" }]);
}

function hello(value: object): NetMessage | null {
  if (!("name" in value) || typeof value.name !== "string") return null;
  return { t: "hello", name: clampName(value.name) };
}

function welcome(value: object): NetMessage | null {
  if (!("slot" in value) || !("roster" in value)) return null;
  const slot = value.slot;
  const roster = value.roster;
  if (typeof slot !== "number" || !Array.isArray(roster)) return null;
  if (!roster.every((entry) => typeof entry === "number")) return null;
  return { t: "welcome", slot, roster: roster as number[] };
}

function inputMessage(value: object): NetMessage | null {
  if (!("frame" in value)) return null;
  const frame = value.frame;
  if (!frame || typeof frame !== "object") return null;
  const input = frame as InputFrame;
  if (input.x !== -1 && input.x !== 0 && input.x !== 1) return null;
  if (typeof input.jumpPressed !== "boolean") return null;
  if (typeof input.jumpHeld !== "boolean") return null;
  if (typeof input.punchPressed !== "boolean") return null;
  if (typeof input.dodgePressed !== "boolean") return null;
  return { t: "input", frame: input };
}

function snapMessage(value: object): NetMessage | null {
  if (!("snap" in value) || !("series" in value)) return null;
  if (!value.snap || typeof value.snap !== "object") return null;
  if (!value.series || typeof value.series !== "object") return null;
  return value as NetMessage;
}
