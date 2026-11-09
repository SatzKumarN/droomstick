export type BroomColor = {
  slot: number;
  name: string;
  fill: string;
  outline: string;
};

export const PALETTE: readonly BroomColor[] = [
  { slot: 1, name: "Red", fill: "#d7263d", outline: "#141414" },
  { slot: 2, name: "Blue", fill: "#1d4ed8", outline: "#141414" },
  { slot: 3, name: "Yellow", fill: "#f5c518", outline: "#141414" },
  { slot: 4, name: "Green", fill: "#1f9d55", outline: "#141414" },
  { slot: 5, name: "Orange", fill: "#f97316", outline: "#141414" },
  { slot: 6, name: "Purple", fill: "#7c3aed", outline: "#141414" },
  { slot: 7, name: "White", fill: "#f7f7f5", outline: "#141414" },
  { slot: 8, name: "Black", fill: "#161616", outline: "#f7f7f5" },
];

export function colorForSlot(slot: number): BroomColor {
  const color = PALETTE.find((entry) => entry.slot === slot);
  if (!color) {
    throw new Error(`No broom color for slot ${slot}`);
  }
  return color;
}
