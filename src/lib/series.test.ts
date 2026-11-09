import { describe, expect, it } from "vitest";
import { SERIES_LENGTH } from "./constants";
import {
  INTERMISSION_MS,
  advance,
  buttonAt,
  callRound,
  createSeries,
  noteRound,
  quitSeries,
  seriesButtons,
  standings,
  startSeries,
  tickIntermission,
} from "./series";

const both = [
  { slot: 1, hp: 10 },
  { slot: 2, hp: 8 },
];

describe("callRound", () => {
  it("keeps playing until one broom is left", () => {
    expect(callRound(both, false)).toEqual({ call: "play" });
    expect(callRound([{ slot: 1, hp: 4 }, { slot: 2, hp: 0 }], false)).toEqual({ call: "win", slot: 1 });
    expect(callRound([{ slot: 1, hp: 0 }, { slot: 2, hp: 0 }], false)).toEqual({ call: "replay" });
  });

  it("uses health when the clock runs out and replays a tie", () => {
    expect(callRound(both, true)).toEqual({ call: "win", slot: 1 });
    expect(callRound([{ slot: 1, hp: 3 }, { slot: 2, hp: 3 }], true)).toEqual({ call: "replay" });
  });
});

describe("series flow", () => {
  it("starts from the lobby and returns there on quit", () => {
    const lobby = createSeries([1, 2]);
    expect(lobby.phase).toBe("lobby");
    expect(lobby.wins).toEqual({ 1: 0, 2: 0 });
    expect(startSeries(createSeries([])).phase).toBe("lobby");
    const fight = startSeries(lobby);
    expect(fight.phase).toBe("fight");
    expect(quitSeries({ ...fight, phase: "stats", wins: { 1: 3, 2: 2 } }).phase).toBe("lobby");
  });

  it("counts a win, replays a wipe, and opens stats after five", () => {
    let series = startSeries(createSeries([1, 2]));
    series = noteRound(series, { call: "play" });
    expect(series.phase).toBe("fight");
    series = noteRound(series, { call: "replay" });
    expect(series.replay).toBe(true);
    expect(series.match).toBe(1);
    expect(series.wins[1]).toBe(0);
    series = advance(series);
    expect(series.phase).toBe("fight");
    expect(series.match).toBe(1);
    series = noteRound(series, { call: "win", slot: 2 });
    expect(series.phase).toBe("intermission");
    expect(series.wins[2]).toBe(1);
    expect(series.intermissionMs).toBe(INTERMISSION_MS);
    series = advance(series);
    expect(series.match).toBe(2);
    series = { ...series, match: SERIES_LENGTH };
    series = noteRound(series, { call: "win", slot: 1 });
    expect(series.phase).toBe("stats");
    expect(series.wins).toEqual({ 1: 1, 2: 1 });
    expect(noteRound(series, { call: "win", slot: 1 }).phase).toBe("stats");
    expect(advance(series).phase).toBe("stats");
  });

  it("auto-advances the intermission and skips on request", () => {
    const waiting = noteRound(startSeries(createSeries([1, 2])), { call: "win", slot: 1 });
    const ticking = tickIntermission(waiting, 1000, false);
    expect(ticking.phase).toBe("intermission");
    expect(ticking.intermissionMs).toBe(INTERMISSION_MS - 1000);
    expect(tickIntermission(ticking, INTERMISSION_MS, false).phase).toBe("fight");
    expect(tickIntermission(waiting, 10, true).match).toBe(2);
    expect(tickIntermission(startSeries(createSeries([1])), 10, true).phase).toBe("fight");
  });

  it("ranks brooms by wins", () => {
    const series = startSeries(createSeries([1, 2]));
    const ranked = standings({ ...series, wins: { 1: 1, 2: 3 } });
    expect(ranked.map((row) => row.slot)).toEqual([2, 1]);
    expect(standings({ ...series, wins: { 1: 2, 2: 2 } }).map((row) => row.slot)).toEqual([1, 2]);
    const outsider = noteRound(startSeries(createSeries([1])), { call: "win", slot: 2 });
    expect(outsider.wins[2]).toBe(1);
    expect(standings({ ...series, slots: [2], wins: {} })).toEqual([{ slot: 2, wins: 0 }]);
  });
});

describe("series buttons", () => {
  it("offers a large target for the action on screen", () => {
    const start = seriesButtons("lobby", 960, 540);
    const next = seriesButtons("intermission", 960, 540);
    const done = seriesButtons("stats", 800, 600);
    expect(seriesButtons("fight", 960, 540)).toEqual([]);
    expect(start[0]?.h).toBeGreaterThanOrEqual(48);
    expect(buttonAt(start, start[0]!.x + 4, start[0]!.y + 4)?.id).toBe("start");
    expect(buttonAt(start, 0, 0)).toBeNull();
    expect(buttonAt([], 10, 10)).toBeNull();
    expect(next[0]?.id).toBe("next");
    expect(done.map((button) => button.id)).toEqual(["continue", "quit"]);
  });
});
