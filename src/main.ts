import { MATCH_MS, SIM } from "./lib/constants";
import {
  controlLayout,
  frameFromKeys,
  frameFromTouches,
  mergeFrames,
  needsLandscape,
  noTouches,
  type HeldTouches,
  type InputFrame,
  type TouchPoint,
} from "./lib/input";
import {
  clockRuns,
  copiedStatus,
  decode,
  doorButtons,
  encode,
  heldInput,
  kickButton,
  type DoorView,
  type NetMessage,
} from "./lib/net";
import { createSim, step, type Sim } from "./lib/physics";
import type { Facing } from "./lib/pose";
import {
  advance,
  buttonAt,
  callRound,
  createSeries,
  noteRound,
  quitSeries,
  seriesButtons,
  startSeries,
  tickIntermission,
  type Series,
  type SeriesButton,
} from "./lib/series";
import { displayName, typeName } from "./lib/name";
import { canStart } from "./lib/rules";
import { muteButton, takeCues } from "./lib/sfx";
import { applySnap, captureSnap } from "./lib/snap";
import { createVoice } from "./audio";
import { drawFrame } from "./render/draw";
import { openGuest, openHost, type RoomLink } from "./session";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const rotate = document.querySelector<HTMLElement>("#rotate");
if (!canvas || !rotate) throw new Error("missing game markup");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("missing canvas context");

const game = canvas;
const context = ctx;
let sim: Sim = createSim({ withDummy: true, timed: true });
let series: Series = createSeries([1, 2]);
let door: DoorView = { kind: "pick" };
let nickname = "";
let guestName = "";
let role: "local" | "host" | "guest" = "local";
let room: RoomLink | null = null;
let roomCode = "";
let guestOn = false;
let guestInput: InputFrame = {
  x: 0,
  jumpPressed: false,
  jumpHeld: false,
  punchPressed: false,
  dodgePressed: false,
};
let guestFresh = false;
let hostSkip = false;
let lastSnap = 0;
let facing: Facing = 1;
let menuAction: string | null = null;
const keys = new Set<string>();
const pressed = new Set<string>();
const typed: string[] = [];
const named: string[] = [];
const points = new Map<number, TouchPoint>();
let held: HeldTouches = noTouches();
let accumulator = 0;
let last = performance.now();
let muted = false;
let heardCue = 0;
let heardEpoch = 0;
const voice = createVoice();

function resize(): void {
  game.width = window.innerWidth;
  game.height = window.innerHeight;
}

resize();
window.addEventListener("resize", resize);

window.addEventListener("keydown", (event) => {
  voice.unlock();
  const key = event.key.toLowerCase();
  if (!keys.has(key)) pressed.add(key);
  keys.add(key);
  if (key >= "0" && key <= "9") typed.push(key);
  if (key === "backspace") typed.push("backspace");
  if (event.key === "Backspace") named.push("backspace");
  else if (event.key === " ") named.push(" ");
  else if (event.key.length === 1) named.push(event.key);
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)) {
    event.preventDefault();
  }
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

function localPoint(event: PointerEvent): TouchPoint {
  const rect = game.getBoundingClientRect();
  return {
    id: event.pointerId,
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function freshSim(): Sim {
  const next = createSim({ withDummy: true, timed: true });
  next.sfxId = sim.sfxId;
  next.sfxEpoch = sim.sfxEpoch;
  return next;
}

function beginPlay(next: "local" | "host" | "guest"): void {
  const carriedEpoch = sim.sfxEpoch;
  role = next;
  door = { kind: "play" };
  series = startSeries(createSeries([1, 2]));
  series = {
    ...series,
    names: role === "guest" ? { 1: "", 2: nickname } : { 1: nickname, 2: guestName },
  };
  sim = createSim({ withDummy: true, timed: true });
  // The host starts a new cue epoch. The guest keeps the previous one until a snapshot arrives.
  if (next === "guest") sim.sfxEpoch = carriedEpoch;
  else sim.sfxEpoch = carriedEpoch + 1;
  facing = 1;
  accumulator = 0;
}

function copyCode(code: string): boolean {
  const field = document.createElement("textarea");
  field.value = code;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.focus();
  field.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  field.remove();
  return copied;
}

function leaveRoom(): void {
  room?.close();
  room = null;
  roomCode = "";
  guestOn = false;
  role = "local";
  door = { kind: "pick" };
}

function returnToHost(status: string): void {
  role = "local";
  guestOn = false;
  guestName = "";
  series = quitSeries(series);
  door = {
    kind: "host",
    code: roomCode,
    status,
    canStart: false,
  };
}

function abandon(status: string): void {
  door = { kind: "notice", status };
  role = "local";
  guestOn = false;
  room?.close();
  room = null;
}

function receive(raw: unknown): void {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  const message = decode(text);
  if (!message) return;
  if (message.t === "input") {
    guestInput = message.frame;
    guestFresh = true;
  } else if (message.t === "snap" && role === "guest") {
    applySnap(sim, message.snap);
    series = message.series;
  } else if (message.t === "start") {
    beginPlay("guest");
  } else if (message.t === "skip") {
    hostSkip = true;
  } else if (message.t === "kick") {
    abandon("The host removed you.");
  } else if (message.t === "hello") {
    guestName = message.name;
    if (role === "host") series = { ...series, names: { ...series.names, 2: guestName } };
    if (door.kind === "host") {
      door = { ...door, status: `${displayName(guestName, "Blue")} joined` };
    }
  } else if (message.t === "welcome" && door.kind === "join") {
    door = { ...door, status: `You are ${displayName(nickname, "Blue")}. Waiting for the host.` };
  } else if (message.t === "full" && door.kind === "join") {
    door = { ...door, status: "That room is full." };
  }
}

function startHosting(): void {
  room?.close();
  guestOn = false;
  guestName = "";
  door = { kind: "host", code: "", status: "Opening room...", canStart: false };
  room = openHost({
    onReady: (code) => {
      roomCode = code;
      if (door.kind === "host") door = { ...door, code, status: "Waiting for a friend" };
    },
    onData: receive,
    onGuest: (connected) => {
      guestOn = connected;
      const allowed = canStart(connected ? 2 : 1, "public");
      if (!connected && role === "host" && door.kind === "play") {
        returnToHost("Your friend left");
        return;
      }
      if (door.kind === "host") {
        door = {
          ...door,
          canStart: allowed,
          status: connected ? "Blue joined" : "Waiting for a friend",
        };
      }
    },
    onError: (message) => {
      if (door.kind === "host") door = { ...door, status: message };
    },
  });
}

function connectGuest(code: string): void {
  room?.close();
  room = openGuest(code, {
    onOpen: () => {
      room?.send(encode({ t: "hello", name: nickname }));
      if (door.kind === "join") door = { ...door, status: "Connected. Waiting for the host." };
    },
    onData: receive,
    onClose: () => {
      if (door.kind === "notice") return;
      if (role === "guest") {
        abandon("The host left.");
        return;
      }
      if (door.kind === "join") door = { ...door, status: "The host left." };
    },
    onError: (message) => {
      if (door.kind === "join") door = { ...door, status: message };
    },
  });
}

function applyMenu(id: SeriesButton["id"]): void {
  if (role === "guest" && id === "next") {
    room?.send(encode({ t: "skip" }));
    return;
  }
  if (id === "quit") {
    leaveRoom();
    series = quitSeries(series);
    return;
  }
  if (id === "next") series = advance(series);
  else series = startSeries(series);
  if (series.phase === "fight") {
    sim = freshSim();
    facing = 1;
    if (role === "host") room?.send(encode({ t: "start" } satisfies NetMessage));
  }
}

function applyAction(id: string): void {
  if (id === "mute") {
    muted = !muted;
    voice.setMuted(muted);
    return;
  }
  if (id === "practice") {
    leaveRoom();
    beginPlay("local");
    return;
  }
  if (id === "host") {
    startHosting();
    return;
  }
  if (id === "join") {
    room?.close();
    room = null;
    door = { kind: "join", digits: "", status: "Enter the host code" };
    return;
  }
  if (id === "cancel") {
    leaveRoom();
    return;
  }
  if (id === "copy" && door.kind === "host" && door.code) {
    const code = door.code;
    const status = copiedStatus(door.status);
    if (copyCode(code)) {
      door = { ...door, status };
      return;
    }
    void navigator.clipboard?.writeText(code).then(
      () => {
        if (door.kind === "host" && door.code === code) door = { ...door, status };
      },
      () => {
        if (door.kind === "host" && door.code === code) door = { ...door, status: "Could not copy the code" };
      },
    );
    return;
  }
  if (id === "kick" && role === "host") {
    room?.send(encode({ t: "kick" } satisfies NetMessage));
    room?.dropGuest();
    returnToHost("Waiting for a friend");
    return;
  }
  if (id === "kick" && door.kind === "host") {
    room?.send(encode({ t: "kick" } satisfies NetMessage));
    room?.dropGuest();
    return;
  }
  if (id === "start" && door.kind === "host" && door.canStart) {
    room?.send(encode({ t: "start" } satisfies NetMessage));
    beginPlay("host");
    return;
  }
  if (id === "start" || id === "next" || id === "continue" || id === "quit") applyMenu(id);
}

game.addEventListener("pointerdown", (event) => {
  voice.unlock();
  const point = localPoint(event);
  const buttons: readonly { id: string; x: number; y: number; w: number; h: number }[] =
    door.kind === "play"
      ? [
          muteButton(muted),
          ...seriesButtons(series.phase, window.innerWidth, window.innerHeight),
          ...(role === "host" && guestOn ? [kickButton(window.innerWidth)] : []),
        ]
      : [
          muteButton(muted),
          ...doorButtons(
            door.kind,
            window.innerWidth,
            window.innerHeight,
            door.kind === "host" && door.canStart,
            door.kind === "host" && door.code.length === 6,
          ),
        ];
  const button = buttonAt(buttons, point.x, point.y);
  if (button && (button.id === "mute" || door.kind !== "play" || series.phase !== "fight" || button.id === "kick")) {
    menuAction = button.id;
    return;
  }
  game.setPointerCapture(event.pointerId);
  points.set(event.pointerId, point);
});
game.addEventListener("pointermove", (event) => {
  if (!points.has(event.pointerId)) return;
  points.set(event.pointerId, localPoint(event));
});
function forgetPointer(event: PointerEvent): void {
  points.delete(event.pointerId);
}
game.addEventListener("pointerup", forgetPointer);
game.addEventListener("pointercancel", forgetPointer);

function tick(now: number): void {
  const portrait = needsLandscape(window.innerWidth, window.innerHeight);
  document.body.classList.toggle("portrait", portrait);
  if (!portrait) {
    const touch = frameFromTouches(
      [...points.values()],
      controlLayout(window.innerWidth, window.innerHeight),
      held,
    );
    held = touch.held;
    const input = mergeFrames(frameFromKeys(keys, pressed), touch.frame);
    const enter = pressed.has("enter");
    const muteKey = pressed.has("m") && door.kind !== "pick";
    const chosen = menuAction;
    menuAction = null;
    const mutePressed = muteKey || chosen === "mute";
    const action = chosen === "mute" ? null : chosen;
    const frame = Math.min(50, now - last);
    if (door.kind === "pick") {
      for (const key of named) nickname = typeName(nickname, key);
    }
    named.length = 0;
    if (door.kind === "join") {
      let digits = door.digits;
      for (const key of typed) {
        if (key === "backspace") digits = digits.slice(0, -1);
        else if (digits.length < 6) digits += key;
      }
      if (digits !== door.digits) {
        room?.close();
        room = null;
        door = {
          kind: "join",
          digits,
          status: digits.length === 6 ? "Connecting..." : "Enter the host code",
        };
        if (digits.length === 6) connectGuest(digits);
      }
    }
    typed.length = 0;
    pressed.clear();
    if (mutePressed) applyAction("mute");
    if (door.kind !== "play") {
      if (action) applyAction(action);
      else if (enter && door.kind === "host" && door.canStart) applyAction("start");
      drawFrame(context, sim, window.innerWidth, window.innerHeight, facing, series, door, false, nickname, muted);
    } else if (action === "kick") {
      applyAction("kick");
    } else if (series.phase === "fight" && role === "guest") {
      room?.send(encode({ t: "input", frame: input }));
    } else if (series.phase === "fight" && clockRuns(role, document.hidden)) {
      if (input.x !== 0) facing = input.x;
      accumulator += frame;
      let first = true;
      while (accumulator >= SIM.dt) {
        const guest =
          role === "host" && guestOn ? (guestFresh ? guestInput : heldInput(guestInput)) : undefined;
        guestFresh = false;
        step(
          sim,
          first
            ? input
            : { ...input, jumpPressed: false, punchPressed: false, dodgePressed: false },
          SIM.dt,
          guest,
        );
        first = false;
        accumulator -= SIM.dt;
      }
      const fighters = [
        { slot: 1, hp: sim.fighter.hp },
        { slot: 2, hp: sim.dummy ? sim.dummyFighter.hp : 0 },
      ];
      series = noteRound(series, callRound(fighters, sim.elapsed >= MATCH_MS));
    } else if (role === "guest" && (action === "next" || (enter && series.phase === "intermission"))) {
      room?.send(encode({ t: "skip" }));
    } else if (action) {
      applyAction(action);
    } else if (enter && (series.phase === "lobby" || series.phase === "stats")) {
      applyAction(series.phase === "lobby" ? "start" : "continue");
    } else if (series.phase === "intermission" && clockRuns(role, document.hidden)) {
      const before = series.match;
      const replaying = series.replay;
      series = tickIntermission(series, frame, enter || hostSkip);
      hostSkip = false;
      if (series.phase === "fight" && (series.match !== before || replaying)) {
        sim = freshSim();
        facing = 1;
      }
    }
    if (role === "host" && door.kind === "play" && room && now - lastSnap >= 50) {
      room.send(encode({ t: "snap", snap: captureSnap(sim), series }));
      lastSnap = now;
    }
    if (door.kind === "play") {
      const taken = takeCues(sim.cues, heardCue, sim.sfxEpoch, heardEpoch);
      heardCue = taken.heard;
      heardEpoch = taken.epoch;
      for (const cue of taken.play) voice.play(cue);
      drawFrame(
        context,
        sim,
        window.innerWidth,
        window.innerHeight,
        facing,
        series,
        door,
        role === "host" && guestOn,
        nickname,
        muted,
      );
    }
  }
  last = now;
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
