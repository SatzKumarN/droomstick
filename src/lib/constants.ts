/**
 * Matter's gravity scale. Combined with a 60fps step, the body gains
 * `GRAVITY * dt * dt` pixels of downward speed each frame.
 */
export const GRAVITY = 0.001;

export const SIM = {
  dt: 1000 / 60,
  gravity: GRAVITY,
  /** Pixels per 60fps step. Matter stores velocity as that step's displacement. */
  runSpeed: 4.5,
  jumpSpeed: 8,
  /** Stick Fight accepts a jump for 0.2s after leaving the ground. */
  coyoteMs: 200,
  jumpBufferMs: 100,
  /** Stick Fight ignores another jump until 0.3s after the last one. */
  jumpRearmMs: 300,
  /** Upward speed kept when jump is released early. */
  jumpCut: 0.5,
  playerWidth: 26,
  playerHeight: 56,
} as const;

export const HP = 10;
export const MATCH_MS = 120_000;
export const SERIES_LENGTH = 5;
