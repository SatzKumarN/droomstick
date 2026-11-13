/** Short synthesized cues. The match has no music. */

export type SfxKind = "hit" | "whoosh" | "crumble";
export type SfxWeight = 0 | 1;

export type SfxCue = {
  id: number;
  kind: SfxKind;
  /** 0 is a light cue. 1 is a dodge whoosh or a killing hit. */
  weight: SfxWeight;
};

export type Tone = {
  wave: OscillatorType;
  fromHz: number;
  toHz: number;
  ms: number;
  gain: number;
  noise: number;
  filter: BiquadFilterType;
  filterFrom: number;
  filterTo: number;
};

/** Recent cues travel in the snapshot. Older ones fall off. */
export const SFX_KEEP = 24;

export function pushCue(
  cues: readonly SfxCue[],
  nextId: number,
  kind: SfxKind,
  weight: SfxWeight,
): { cues: SfxCue[]; nextId: number } {
  const next = [...cues, { id: nextId, kind, weight }];
  return {
    cues: next.length > SFX_KEEP ? next.slice(-SFX_KEEP) : next,
    nextId: nextId + 1,
  };
}

/**
 * Cues the listener has not played yet.
 * A new epoch is a new series: ids start over, and the old cursor is dropped.
 */
export function takeCues(
  cues: readonly SfxCue[],
  heard: number,
  epoch: number,
  heardEpoch: number,
): { play: SfxCue[]; heard: number; epoch: number } {
  if (epoch !== heardEpoch) {
    const last = cues[cues.length - 1];
    return { play: [...cues], heard: last ? last.id : 0, epoch };
  }
  const play = cues.filter((cue) => cue.id > heard);
  const last = play[play.length - 1];
  return { play, heard: last ? last.id : heard, epoch };
}

export function toneFor(cue: SfxCue): Tone {
  const wobble = (cue.id % 5) * 12;
  if (cue.kind === "whoosh") {
    const dodge = cue.weight === 1;
    return {
      wave: "sawtooth",
      fromHz: (dodge ? 880 : 420) + wobble,
      toHz: dodge ? 240 : 1400,
      ms: dodge ? 160 : 110,
      gain: 0.04,
      noise: 0.16,
      filter: "bandpass",
      filterFrom: (dodge ? 1400 : 500) + wobble,
      filterTo: dodge ? 280 : 1600,
    };
  }
  if (cue.kind === "crumble") {
    return {
      wave: "triangle",
      fromHz: 120 + wobble,
      toHz: 36,
      ms: 320,
      gain: 0.22,
      noise: 0.28,
      filter: "lowpass",
      filterFrom: 400,
      filterTo: 80,
    };
  }
  if (cue.weight === 1) {
    return {
      wave: "square",
      fromHz: 130 + wobble,
      toHz: 42,
      ms: 220,
      gain: 0.3,
      noise: 0.22,
      filter: "lowpass",
      filterFrom: 900,
      filterTo: 140,
    };
  }
  return {
    wave: "square",
    fromHz: 340 + wobble,
    toHz: 110,
    ms: 70,
    gain: 0.2,
    noise: 0.18,
    filter: "highpass",
    filterFrom: 700 + wobble,
    filterTo: 1800,
  };
}

export type MuteButton = {
  id: "mute";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

/**
 * Sits to the right of the match clock, clear of the health rings.
 * A narrow door puts it in the corner so it doesn't cover the title.
 */
export function muteButton(muted: boolean, width = 0): MuteButton {
  const corner = width > 0 && width < 800;
  return {
    id: "mute",
    x: corner ? 8 : 116,
    y: 8,
    w: corner ? 96 : 104,
    h: 40,
    label: muted ? "Muted" : "Mute",
  };
}
