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

/** Live editing keeps a trailing space so the next word can be typed. */
export function editName(value: string): string {
  let next = "";
  for (const key of value) next = typeName(next, key);
  return next;
}

export function clampName(nickname: string): string {
  return editName(nickname.trim()).trim();
}

export function displayName(nickname: string, colorName: string): string {
  const trimmed = nickname.trim();
  return trimmed.length > 0 ? trimmed : colorName;
}

export function labelFor(names: Readonly<Record<number, string>>, slot: number): string {
  return displayName(names[slot] ?? "", colorForSlot(slot).name);
}
