import { SIM } from "./constants";

/** Downward speed added each 60fps step, in pixels. */
export function frameAccel(gravity: number = SIM.gravity, dt: number = SIM.dt): number {
  return gravity * dt * dt;
}

/** Hop size Matter produces from the tuned speeds. The loft is built from this. */
export function jumpMetrics(
  jumpSpeed: number = SIM.jumpSpeed,
  runSpeed: number = SIM.runSpeed,
  gravity: number = SIM.gravity,
): { H: number; D: number; climb: number; earlyGap: number; lateGap: number } {
  const accel = frameAccel(gravity);
  const H = (jumpSpeed * jumpSpeed) / (2 * accel);
  const D = runSpeed * ((2 * jumpSpeed) / accel);
  return {
    H,
    D,
    climb: H * 0.75,
    earlyGap: D * 0.8,
    lateGap: D * 1.15,
  };
}

export type Platform = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Loft = {
  platforms: Platform[];
  spawn: { x: number; y: number };
};

export function span(platform: Platform): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  return {
    left: platform.x - platform.w / 2,
    right: platform.x + platform.w / 2,
    top: platform.y - platform.h / 2,
    bottom: platform.y + platform.h / 2,
  };
}

/** Static first loft. Every intended climb and gap fits one jump. */
export function loft(): Loft {
  const { climb, earlyGap } = jumpMetrics();
  const thickness = 36;
  const floorTop = 460;
  const floorY = floorTop + thickness / 2;
  const leftW = 340;
  const leftX = 40 + leftW / 2;
  const leftRight = leftX + leftW / 2;
  const rightW = 300;
  const rightX = leftRight + earlyGap + rightW / 2;
  const beamW = 170;
  const beamH = 24;
  const beamLeft = leftRight + 12;
  const beamX = beamLeft + beamW / 2;
  const beamTop = floorTop - climb;
  return {
    platforms: [
      { id: "floor-left", x: leftX, y: floorY, w: leftW, h: thickness },
      { id: "floor-right", x: rightX, y: floorY, w: rightW, h: thickness },
      { id: "beam", x: beamX, y: beamTop + beamH / 2, w: beamW, h: beamH },
    ],
    spawn: {
      x: leftX - 60,
      y: floorTop - SIM.playerHeight / 2 - 1,
    },
  };
}
