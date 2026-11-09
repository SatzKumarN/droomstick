import { SIM } from "./constants";

export type JumpMemory = {
  coyoteMs: number;
  bufferMs: number;
  locked: boolean;
  sinceJumpMs: number;
};

export function createJumpMemory(): JumpMemory {
  return { coyoteMs: 0, bufferMs: 0, locked: false, sinceJumpMs: SIM.jumpRearmMs };
}

export function updateJump(
  memory: JumpMemory,
  input: {
    grounded: boolean;
    jumpPressed: boolean;
    jumpHeld: boolean;
    verticalVelocity: number;
    dt: number;
  },
): { memory: JumpMemory; velocityY: number } {
  const coyoteMs = input.grounded
    ? SIM.coyoteMs
    : Math.max(0, memory.coyoteMs - input.dt);
  const bufferMs = input.jumpPressed
    ? SIM.jumpBufferMs
    : Math.max(0, memory.bufferMs - input.dt);
  const locked = input.grounded ? false : memory.locked;
  const sinceJumpMs = memory.sinceJumpMs + input.dt;
  let velocityY = input.verticalVelocity;

  if (bufferMs > 0 && coyoteMs > 0 && !locked && sinceJumpMs >= SIM.jumpRearmMs) {
    return {
      memory: { coyoteMs: 0, bufferMs: 0, locked: true, sinceJumpMs: 0 },
      velocityY: -SIM.jumpSpeed,
    };
  }

  if (locked && !input.jumpHeld && velocityY < 0) {
    velocityY *= SIM.jumpCut;
  }

  return {
    memory: { coyoteMs, bufferMs, locked, sinceJumpMs },
    velocityY,
  };
}
