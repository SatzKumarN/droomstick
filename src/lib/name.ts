import { colorForSlot } from "./palette";

export const NAME_LIMIT = 12;

/** Letters and numbers, one space between words, at most 12 characters. */
export function typeName(current: string, key: string): string {
  if (key === "backspace") return current.slice(0, -1);
  if (key === " ") {
    if (current.length === 0 || current.endsWith(" ") || current.length >= NAME_LIMIT) return current;
    return `${current} `;
  }
  if (key.length !== 1 || current.length >= NAME_LIMIT) return current;
  if (!/^[\p{L}\p{N}]$/u.test(key)) return current;
  return current + key;
}

export function clampName(nickname: string): string {
  let next = "";
  for (const key of nickname.trim()) next = typeName(next, key);
  return next.trim();
}

export function displayName(nickname: string, colorName: string): string {
  const trimmed = nickname.trim();
  return trimmed.length > 0 ? trimmed : colorName;
}

export function labelFor(names: Readonly<Record<number, string>>, slot: number): string {
  return displayName(names[slot] ?? "", colorForSlot(slot).name);
}
