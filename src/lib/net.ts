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

/**
 * Several input packets can arrive before the host steps.
 * Keep the latest stick, and don't drop a jump or punch that arrived earlier.
 */
export function takeGuestInput(pending: InputFrame | null, frame: InputFrame): InputFrame {
  if (!pending) return frame;
  return {
    x: frame.x,
    jumpHeld: frame.jumpHeld,
    jumpPressed: pending.jumpPressed || frame.jumpPressed,
    punchPressed: pending.punchPressed || frame.punchPressed,
    dodgePressed: pending.dodgePressed || frame.dodgePressed,
  };
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
  id:
    | "practice"
    | "host"
    | "join"
    | "start"
    | "cancel"
    | "copy"
    | "kick"
    | "back"
    | "d0"
    | "d1"
    | "d2"
    | "d3"
    | "d4"
    | "d5"
    | "d6"
    | "d7"
    | "d8"
    | "d9";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

export type DoorBox = { x: number; y: number; w: number; h: number };

export type DoorLayout = {
  panel: DoorBox;
  titleY: number;
  lineY: number;
  detailY: number;
  nameY: number;
  /** Where the player types the name that shows up as the host. */
  field: DoorBox | null;
  codeSize: number;
  buttons: DoorButton[];
};

export function kickButton(width: number): DoorButton {
  const narrow = width < 720;
  return { id: "kick", x: width - (narrow ? 104 : 124), y: narrow ? 156 : 120, w: 96, h: 40, label: "Kick" };
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

function actionSpecs(
  view: "pick" | "host" | "join" | "notice",
  canStart: boolean,
  copy: boolean,
): { id: DoorButton["id"]; label: string }[] {
  if (view === "pick") {
    return [
      { id: "practice", label: "Practice" },
      { id: "host", label: "Host" },
      { id: "join", label: "Join" },
    ];
  }
  if (view === "host") {
    const buttons: { id: DoorButton["id"]; label: string }[] = [];
    if (copy) buttons.push({ id: "copy", label: "Copy" });
    if (canStart) buttons.push({ id: "start", label: "Start" }, { id: "kick", label: "Kick" });
    buttons.push({ id: "cancel", label: "Cancel" });
    return buttons;
  }
  if (view === "notice") return [{ id: "cancel", label: "Back" }];
  return [{ id: "back", label: "Del" }, { id: "cancel", label: "Cancel" }];
}

/**
 * The door has to fit a portrait phone and a short landscape phone.
 * The room code, the name, and every button stay on screen.
 */
export function layoutDoor(
  view: "pick" | "host" | "join" | "notice",
  width: number,
  height: number,
  canStart: boolean,
  copy = false,
): DoorLayout {
  const margin = 8;
  const topLimit = 52;
  const panelW = Math.min(460, Math.max(200, width - margin * 2));
  const actions = actionSpecs(view, canStart, copy);
  const keypad = view === "join";
  const columns = 5;
  const keyRows = keypad ? 2 : 0;
  const gap = 8;
  const fieldExtra = view === "pick" ? 8 : 0;

  const place = (buttonH: number, lineGap: number, titlePad: number): DoorLayout => {
    const panelX = Math.max(margin, (width - panelW) / 2);
    const panelY = topLimit;
    const titleY = panelY + titlePad;
    const lineY = titleY + lineGap;
    const detailY = lineY + lineGap;
    const named = view === "host" && height >= 420;
    const nameY = named ? detailY + lineGap : detailY;
    const textBottom = view === "notice" ? lineY : view === "pick" ? detailY + fieldExtra : named ? nameY : detailY;
    const innerX = panelX + 20;
    const innerW = panelW - 40;
    const buttons: DoorButton[] = [];
    let cursor = textBottom + 12;

    if (keypad) {
      const keyW = (innerW - gap * (columns - 1)) / columns;
      DIGITS.forEach((digit, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        buttons.push({
          id: `d${digit}` as DoorButton["id"],
          label: digit,
          x: innerX + col * (keyW + gap),
          y: cursor + row * (buttonH + gap),
          w: keyW,
          h: buttonH,
        });
      });
      cursor += keyRows * buttonH + keyRows * gap;
    }

    const actionW = Math.min(180, innerW);
    const actionX = panelX + (panelW - actionW) / 2;
    actions.forEach((action, index) => {
      buttons.push({
        ...action,
        x: actionX,
        y: cursor + index * (buttonH + gap),
        w: actionW,
        h: buttonH,
      });
    });

    const field =
      view === "pick"
        ? { x: actionX, y: detailY - 14, w: actionW, h: Math.min(40, Math.max(30, buttonH - 8)) }
        : null;
    const last = buttons[buttons.length - 1];
    const bottom = (last ? last.y + last.h : textBottom) + 12;
    const panelH = bottom - panelY;
    const centered = Math.max(topLimit, Math.min((height - panelH) / 2, height - margin - panelH));
    const shift = centered - panelY;
    if (shift !== 0) {
      for (const button of buttons) button.y += shift;
      if (field) field.y += shift;
    }
    return {
      panel: { x: panelX, y: panelY + shift, w: panelW, h: panelH },
      titleY: titleY + shift,
      lineY: lineY + shift,
      detailY: detailY + shift,
      nameY: nameY + shift,
      field,
      codeSize: height < 420 ? 32 : 42,
      buttons,
    };
  };

  let buttonH = 52;
  const codeLine = view === "host" || view === "join";
  let lineGap = codeLine ? 36 : 30;
  let titlePad = 34;
  const minGap = codeLine ? 28 : 22;
  let layout = place(buttonH, lineGap, titlePad);
  const fits = (door: DoorLayout): boolean => {
    const last = door.buttons[door.buttons.length - 1];
    const bottom = last ? last.y + last.h : door.panel.y + door.panel.h;
    return bottom <= height - margin && door.panel.y + door.panel.h <= height - margin + 1;
  };
  while (!fits(layout) && (buttonH > 32 || lineGap > minGap || titlePad > 24)) {
    if (buttonH > 32) buttonH -= 2;
    else if (lineGap > minGap) lineGap -= 2;
    else titlePad -= 2;
    layout = place(buttonH, lineGap, titlePad);
  }
  return layout;
}

export function doorButtons(
  view: "pick" | "host" | "join" | "notice",
  width: number,
  height: number,
  canStart: boolean,
  copy = false,
): DoorButton[] {
  return layoutDoor(view, width, height, canStart, copy).buttons;
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
