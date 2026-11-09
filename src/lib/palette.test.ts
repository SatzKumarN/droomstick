import { describe, expect, it } from "vitest";
import { PALETTE, colorForSlot } from "./palette";

describe("palette", () => {
  it("assigns eight distinct colors and drops pink and cyan", () => {
    expect(PALETTE).toHaveLength(8);
    const names = PALETTE.map((color) => color.name);
    expect(names).toEqual([
      "Red",
      "Blue",
      "Yellow",
      "Green",
      "Orange",
      "Purple",
      "White",
      "Black",
    ]);
    expect(new Set(PALETTE.map((color) => color.fill)).size).toBe(8);
    expect(names.join(" ")).not.toMatch(/pink|cyan/i);
  });

  it("outlines white in dark and black in light", () => {
    expect(colorForSlot(7).outline).not.toBe(colorForSlot(8).outline);
    expect(colorForSlot(1).slot).toBe(1);
  });

  it("rejects a slot outside the roster", () => {
    expect(() => colorForSlot(0)).toThrow(/slot 0/);
    expect(() => colorForSlot(9)).toThrow(/slot 9/);
  });
});
