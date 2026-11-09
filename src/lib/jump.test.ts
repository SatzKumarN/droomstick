import { describe, expect, it } from "vitest";
import { SIM } from "./constants";
import { createJumpMemory, updateJump, type JumpMemory } from "./jump";

const dt = SIM.dt;

function air(
  memory: JumpMemory,
  extra: Partial<Parameters<typeof updateJump>[1]> = {},
) {
  return updateJump(memory, {
    grounded: false,
    jumpPressed: false,
    jumpHeld: false,
    verticalVelocity: 0.2,
    dt,
    ...extra,
  });
}

describe("updateJump", () => {
  it("jumps from the ground", () => {
    const result = updateJump(createJumpMemory(), {
      grounded: true,
      jumpPressed: true,
      jumpHeld: true,
      verticalVelocity: 0,
      dt,
    });
    expect(result.velocityY).toBe(-SIM.jumpSpeed);
    expect(result.memory.locked).toBe(true);
  });

  it("does not jump in the air once coyote time is gone", () => {
    const expired = air(createJumpMemory(), { dt: SIM.coyoteMs + 5, jumpPressed: true, jumpHeld: true });
    expect(expired.velocityY).toBe(0.2);
    expect(expired.memory.locked).toBe(false);
  });

  it("still jumps just after walking off a ledge", () => {
    const edged = updateJump(createJumpMemory(), {
      grounded: true,
      jumpPressed: false,
      jumpHeld: false,
      verticalVelocity: 0,
      dt,
    });
    const left = air(edged.memory);
    const hopped = air(left.memory, { jumpPressed: true, jumpHeld: true });
    expect(hopped.velocityY).toBe(-SIM.jumpSpeed);
  });

  it("stores a press and uses it on landing", () => {
    const pressed = air(createJumpMemory(), { jumpPressed: true, jumpHeld: true, dt: SIM.coyoteMs + 5 });
    const landed = updateJump(pressed.memory, {
      grounded: true,
      jumpPressed: false,
      jumpHeld: true,
      verticalVelocity: 0.4,
      dt,
    });
    expect(landed.velocityY).toBe(-SIM.jumpSpeed);
  });

  it("drops the buffered press if landing takes too long", () => {
    const pressed = air(createJumpMemory(), { jumpPressed: true, jumpHeld: true, dt: SIM.coyoteMs + 5 });
    const stale = air(pressed.memory, { dt: SIM.jumpBufferMs + 5 });
    const landed = updateJump(stale.memory, {
      grounded: true,
      jumpPressed: false,
      jumpHeld: false,
      verticalVelocity: 0.4,
      dt,
    });
    expect(landed.velocityY).toBe(0.4);
  });

  it("waits out the rearm time before jumping again", () => {
    const first = updateJump(createJumpMemory(), {
      grounded: true,
      jumpPressed: true,
      jumpHeld: true,
      verticalVelocity: 0,
      dt,
    });
    const landed = updateJump(first.memory, {
      grounded: true,
      jumpPressed: true,
      jumpHeld: true,
      verticalVelocity: 0.4,
      dt,
    });
    expect(landed.velocityY).toBe(0.4);
    const ready = updateJump(
      { ...landed.memory, sinceJumpMs: SIM.jumpRearmMs },
      {
        grounded: true,
        jumpPressed: true,
        jumpHeld: true,
        verticalVelocity: 0.4,
        dt: 0,
      },
    );
    expect(ready.velocityY).toBe(-SIM.jumpSpeed);
  });

  it("refuses a second jump before landing", () => {
    const first = updateJump(createJumpMemory(), {
      grounded: true,
      jumpPressed: true,
      jumpHeld: true,
      verticalVelocity: 0,
      dt,
    });
    const second = air(first.memory, { jumpPressed: true, jumpHeld: true, verticalVelocity: -0.1 });
    expect(second.velocityY).toBe(-0.1);
  });

  it("shortens the hop when jump is released while rising", () => {
    const rising = updateJump(createJumpMemory(), {
      grounded: true,
      jumpPressed: true,
      jumpHeld: true,
      verticalVelocity: 0,
      dt,
    });
    const cut = air(rising.memory, { verticalVelocity: -SIM.jumpSpeed });
    expect(cut.velocityY).toBeCloseTo(-SIM.jumpSpeed * SIM.jumpCut);
  });

  it("leaves a falling broom alone when jump is released", () => {
    const rising = updateJump(createJumpMemory(), {
      grounded: true,
      jumpPressed: true,
      jumpHeld: true,
      verticalVelocity: 0,
      dt,
    });
    const falling = air(rising.memory, { verticalVelocity: 0.3 });
    expect(falling.velocityY).toBe(0.3);
  });
});
