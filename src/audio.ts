import { toneFor, type SfxCue } from "./lib/sfx";

export type Voice = {
  unlock(): void;
  play(cue: SfxCue): void;
  setMuted(muted: boolean): void;
};

/** Web Audio noises only. Nothing is loaded from a file, and nothing loops as music. */
export function createVoice(): Voice {
  let muted = false;
  let ctx: AudioContext | null = null;
  let noise: AudioBuffer | null = null;

  function ensure(): AudioContext | null {
    if (muted) return null;
    if (!ctx) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      try {
        ctx = new Ctx();
      } catch {
        return null;
      }
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  function noiseBuffer(audio: AudioContext): AudioBuffer {
    if (noise) return noise;
    const length = audio.sampleRate;
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    noise = buffer;
    return buffer;
  }

  return {
    unlock() {
      ensure();
    },
    setMuted(next) {
      muted = next;
    },
    play(cue) {
      const audio = ensure();
      if (!audio) return;
      const tone = toneFor(cue);
      const now = audio.currentTime;
      const dur = tone.ms / 1000;
      const osc = audio.createOscillator();
      const oscGain = audio.createGain();
      osc.type = tone.wave;
      osc.frequency.setValueAtTime(tone.fromHz, now);
      osc.frequency.exponentialRampToValueAtTime(tone.toHz, now + dur);
      oscGain.gain.setValueAtTime(tone.gain, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(oscGain);
      oscGain.connect(audio.destination);
      osc.start(now);
      osc.stop(now + dur);

      const source = audio.createBufferSource();
      source.buffer = noiseBuffer(audio);
      const filter = audio.createBiquadFilter();
      filter.type = tone.filter;
      filter.frequency.setValueAtTime(Math.max(40, tone.filterFrom), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, tone.filterTo), now + dur);
      filter.Q.value = tone.filter === "bandpass" ? 0.7 : 0.4;
      const noiseGain = audio.createGain();
      noiseGain.gain.setValueAtTime(tone.noise, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      source.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(audio.destination);
      const offset = ((cue.id % 13) / 13) * Math.max(0, source.buffer.duration - dur);
      source.start(now, offset);
      source.stop(now + dur);
    },
  };
}
