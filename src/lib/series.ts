import { SERIES_LENGTH } from "./constants";

export const INTERMISSION_MS = 8_000;

export type SeriesPhase = "lobby" | "fight" | "intermission" | "stats";

export type RoundResult =
  | { call: "play" }
  | { call: "replay" }
  | { call: "win"; slot: number };

export type Series = {
  phase: SeriesPhase;
  match: number;
  slots: readonly number[];
  wins: Readonly<Record<number, number>>;
  winner: number | null;
  replay: boolean;
  intermissionMs: number;
  names: Readonly<Record<number, string>>;
};

export type SeriesButton = {
  id: "start" | "next" | "continue" | "quit";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

export function createSeries(slots: readonly number[]): Series {
  return {
    phase: "lobby",
    match: 1,
    slots,
    wins: blankWins(slots),
    winner: null,
    replay: false,
    intermissionMs: 0,
    names: {},
  };
}

export function startSeries(series: Series): Series {
  if (series.slots.length === 0) return series;
  return {
    ...series,
    phase: "fight",
    match: 1,
    wins: blankWins(series.slots),
    winner: null,
    replay: false,
    intermissionMs: 0,
  };
}

export function quitSeries(series: Series): Series {
  return createSeries(series.slots);
}

/** Last broom alive wins. A same-frame wipe, or a tied clock, replays the match. */
export function callRound(
  fighters: readonly { slot: number; hp: number }[],
  timeUp: boolean,
): RoundResult {
  const alive = fighters.filter((fighter) => fighter.hp > 0);
  if (alive.length === 1) return { call: "win", slot: alive[0]!.slot };
  if (alive.length === 0) return { call: "replay" };
  if (!timeUp) return { call: "play" };
  const top = Math.max(...alive.map((fighter) => fighter.hp));
  const leaders = alive.filter((fighter) => fighter.hp === top);
  if (leaders.length === 1) return { call: "win", slot: leaders[0]!.slot };
  return { call: "replay" };
}

export function noteRound(series: Series, result: RoundResult): Series {
  if (series.phase !== "fight" || result.call === "play") return series;
  if (result.call === "replay") {
    return { ...series, phase: "intermission", winner: null, replay: true, intermissionMs: INTERMISSION_MS };
  }
  const wins = { ...series.wins, [result.slot]: (series.wins[result.slot] ?? 0) + 1 };
  if (series.match >= SERIES_LENGTH) {
    return { ...series, phase: "stats", wins, winner: result.slot, replay: false, intermissionMs: 0 };
  }
  return {
    ...series,
    phase: "intermission",
    wins,
    winner: result.slot,
    replay: false,
    intermissionMs: INTERMISSION_MS,
  };
}

export function tickIntermission(series: Series, dt: number, skip: boolean): Series {
  if (series.phase !== "intermission") return series;
  if (skip || series.intermissionMs - dt <= 0) return advance(series);
  return { ...series, intermissionMs: series.intermissionMs - dt };
}

export function advance(series: Series): Series {
  if (series.phase !== "intermission") return series;
  if (series.replay) {
    return { ...series, phase: "fight", winner: null, replay: false, intermissionMs: 0 };
  }
  return { ...series, phase: "fight", match: series.match + 1, winner: null, intermissionMs: 0 };
}

export function standings(series: Series): { slot: number; wins: number }[] {
  return series.slots
    .map((slot) => ({ slot, wins: series.wins[slot] ?? 0 }))
    .sort((a, b) => b.wins - a.wins || a.slot - b.slot);
}

export function seriesButtons(phase: SeriesPhase, width: number, height: number): SeriesButton[] {
  const w = 148;
  const h = 52;
  const y = height / 2 + 48;
  if (phase === "lobby") {
    return [{ id: "start", x: (width - w) / 2, y, w, h, label: "Start" }];
  }
  if (phase === "intermission") {
    return [{ id: "next", x: (width - w) / 2, y, w, h, label: "Next" }];
  }
  if (phase === "stats") {
    const gap = 16;
    const left = (width - (w * 2 + gap)) / 2;
    return [
      { id: "continue", x: left, y, w, h, label: "Continue" },
      { id: "quit", x: left + w + gap, y, w, h, label: "Quit" },
    ];
  }
  return [];
}

export function buttonAt<T extends { x: number; y: number; w: number; h: number }>(
  buttons: readonly T[],
  x: number,
  y: number,
): T | null {
  return (
    buttons.find((button) => x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h) ??
    null
  );
}

function blankWins(slots: readonly number[]): Record<number, number> {
  const wins: Record<number, number> = {};
  for (const slot of slots) wins[slot] = 0;
  return wins;
}
