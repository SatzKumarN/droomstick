import { describe, expect, it } from "vitest";
import { SFX_KEEP, muteButton, pushCue, takeCues, toneFor, type SfxCue } from "./sfx";

describe("sound cues", () => {
  it("numbers cues and keeps the latest ones", () => {
    let cues: SfxCue[] = [];
    let nextId = 1;
    const first = pushCue(cues, nextId, "whoosh", 0);
    cues = first.cues;
    nextId = first.nextId;
    expect(cues).toEqual([{ id: 1, kind: "whoosh", weight: 0 }]);
    for (let i = cues.length; i < SFX_KEEP + 1; i += 1) {
      const pushed = pushCue(cues, nextId, "hit", 0);
      cues = pushed.cues;
      nextId = pushed.nextId;
    }
    expect(cues).toHaveLength(SFX_KEEP);
    expect(cues[0]?.id).toBe(2);
    expect(cues.at(-1)?.id).toBe(SFX_KEEP + 1);
    expect(nextId).toBe(SFX_KEEP + 2);
  });

  it("plays only new cues, and starts over when the series epoch changes", () => {
    const cues: SfxCue[] = [
      { id: 2, kind: "hit", weight: 0 },
      { id: 3, kind: "crumble", weight: 0 },
    ];
    expect(takeCues([], 4, 1, 1)).toEqual({ play: [], heard: 4, epoch: 1 });
    expect(takeCues(cues, 2, 1, 1)).toEqual({
      play: [{ id: 3, kind: "crumble", weight: 0 }],
      heard: 3,
      epoch: 1,
    });
    expect(takeCues(cues, 3, 1, 1)).toEqual({ play: [], heard: 3, epoch: 1 });
    expect(takeCues(cues, 9, 2, 1)).toEqual({ play: cues, heard: 3, epoch: 2 });
    expect(takeCues([], 9, 4, 3)).toEqual({ play: [], heard: 0, epoch: 4 });
  });

  it("gives each kind its own short tone", () => {
    const whoosh = toneFor({ id: 1, kind: "whoosh", weight: 0 });
    const dodge = toneFor({ id: 1, kind: "whoosh", weight: 1 });
    const crumble = toneFor({ id: 3, kind: "crumble", weight: 0 });
    const hit = toneFor({ id: 1, kind: "hit", weight: 0 });
    const kill = toneFor({ id: 1, kind: "hit", weight: 1 });
    expect(whoosh.filter).toBe("bandpass");
    expect(dodge.fromHz).toBeGreaterThan(whoosh.fromHz);
    expect(dodge.toHz).toBeLessThan(whoosh.toHz);
    expect(crumble.filter).toBe("lowpass");
    expect(crumble.ms).toBeGreaterThan(hit.ms);
    expect(kill.ms).toBeGreaterThan(hit.ms);
    expect(kill.fromHz).toBeLessThan(hit.fromHz);
    expect(toneFor({ id: 2, kind: "hit", weight: 0 }).fromHz).not.toBe(hit.fromHz);
    expect(whoosh.noise).toBeGreaterThan(0);
    expect(hit.gain).toBeGreaterThan(0);
  });

  it("labels the mute toggle", () => {
    expect(muteButton(false)).toMatchObject({ id: "mute", label: "Mute", x: 116 });
    expect(muteButton(true).label).toBe("Muted");
    expect(muteButton(false).w).toBeGreaterThanOrEqual(48);
    expect(muteButton(false).h).toBeGreaterThanOrEqual(36);
  });
});
