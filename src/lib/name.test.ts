import { describe, expect, it } from "vitest";
import { NAME_LIMIT, clampName, displayName, labelFor, typeName } from "./name";

describe("nicknames", () => {
  it("keeps letters and a single space, and stops at 12", () => {
    let name = "";
    name = typeName(name, " ");
    expect(name).toBe("");
    name = typeName("Sam", " ");
    name = typeName(name, " ");
    expect(name).toBe("Sam ");
    name = typeName(name, "K");
    expect(name).toBe("Sam K");
    name = typeName(name, "!");
    name = typeName(name, "Enter");
    expect(name).toBe("Sam K");
    name = typeName(name, "backspace");
    expect(name).toBe("Sam ");
    expect(typeName("", "backspace")).toBe("");
    const full = "a".repeat(NAME_LIMIT);
    expect(typeName(full, "b")).toBe(full);
    expect(typeName(full, " ")).toBe(full);
    expect(clampName("  Sam!! K  ")).toBe("Sam K");
  });

  it("falls back to the color when the nickname is blank", () => {
    expect(displayName("", "Red")).toBe("Red");
    expect(displayName("   ", "Red")).toBe("Red");
    expect(displayName(" Sam ", "Red")).toBe("Sam");
    expect(labelFor({}, 1)).toBe("Red");
    expect(labelFor({ 2: "" }, 2)).toBe("Blue");
    expect(labelFor({ 1: "Sam" }, 1)).toBe("Sam");
  });
});
