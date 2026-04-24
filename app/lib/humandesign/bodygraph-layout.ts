import type { CenterKey } from "./types";

export const VIEWBOX = { w: 800, h: 1200 };

// Center center-points (x, y) in viewBox units.
export const CENTER_POS: Record<CenterKey, { x: number; y: number }> = {
  head:        { x: 400, y: 110 },
  ajna:        { x: 400, y: 260 },
  throat:      { x: 400, y: 420 },
  g:           { x: 400, y: 600 },
  heart:       { x: 530, y: 660 },
  solarPlexus: { x: 640, y: 820 },
  sacral:      { x: 400, y: 820 },
  spleen:      { x: 160, y: 820 },
  root:        { x: 400, y: 1020 },
};

export type CenterShape = "triangleUp" | "triangleDown" | "square" | "diamond";
export const CENTER_SHAPE: Record<CenterKey, CenterShape> = {
  head: "triangleUp",
  ajna: "triangleDown",
  throat: "square",
  g: "diamond",
  heart: "triangleUp",
  solarPlexus: "triangleUp",
  sacral: "square",
  spleen: "triangleUp",
  root: "square",
};

export const CENTER_SIZE: Record<CenterKey, number> = {
  head: 110, ajna: 110, throat: 130, g: 130, heart: 90,
  solarPlexus: 130, sacral: 130, spleen: 130, root: 130,
};

// Gate → center mapping. Canonical Human Design assignment.
// Mirrors the GATE_TO_CENTER constant in app/lib/humandesign/normalize.ts.
// If you update one, update the other.
export const GATE_TO_CENTER: Record<number, CenterKey> = {
  64: "head", 61: "head", 63: "head",
  47: "ajna", 24: "ajna", 4: "ajna", 17: "ajna", 43: "ajna", 11: "ajna",
  62: "throat", 23: "throat", 56: "throat", 16: "throat", 20: "throat",
  31: "throat", 8: "throat", 33: "throat", 35: "throat", 12: "throat", 45: "throat",
  1: "g", 13: "g", 25: "g", 46: "g", 2: "g", 15: "g", 10: "g", 7: "g",
  21: "heart", 40: "heart", 26: "heart", 51: "heart",
  48: "spleen", 57: "spleen", 44: "spleen", 50: "spleen", 32: "spleen", 28: "spleen", 18: "spleen",
  6: "solarPlexus", 37: "solarPlexus", 22: "solarPlexus", 36: "solarPlexus",
  30: "solarPlexus", 55: "solarPlexus", 49: "solarPlexus",
  34: "sacral", 5: "sacral", 14: "sacral", 29: "sacral",
  59: "sacral", 9: "sacral", 3: "sacral", 42: "sacral", 27: "sacral",
  53: "root", 60: "root", 52: "root", 19: "root",
  39: "root", 41: "root", 58: "root", 38: "root", 54: "root",
};

// The 36 canonical channels of the Human Design bodygraph, each as an
// unordered pair of gate numbers. Names are the commonly-used English labels.
export const CANONICAL_CHANNELS: ReadonlyArray<{ gates: [number, number]; name: string }> = [
  { gates: [64, 47], name: "Abstraction" },
  { gates: [61, 24], name: "Awareness" },
  { gates: [63, 4],  name: "Logic" },
  { gates: [17, 62], name: "Acceptance" },
  { gates: [43, 23], name: "Structuring" },
  { gates: [11, 56], name: "Curiosity" },
  { gates: [16, 48], name: "Talent" },
  { gates: [20, 57], name: "Brainwave" },
  { gates: [20, 10], name: "Awakening" },
  { gates: [20, 34], name: "Charisma" },
  { gates: [31, 7],  name: "Alpha" },
  { gates: [8, 1],   name: "Inspiration" },
  { gates: [33, 13], name: "Prodigal" },
  { gates: [35, 36], name: "Transitoriness" },
  { gates: [12, 22], name: "Openness" },
  { gates: [45, 21], name: "Money" },
  { gates: [25, 51], name: "Initiation" },
  { gates: [46, 29], name: "Discovery" },
  { gates: [2, 14],  name: "Beat" },
  { gates: [15, 5],  name: "Rhythm" },
  { gates: [10, 57], name: "Perfected Form" },
  { gates: [10, 34], name: "Exploration" },
  { gates: [26, 44], name: "Surrender" },
  { gates: [40, 37], name: "Community" },
  { gates: [50, 27], name: "Preservation" },
  { gates: [32, 54], name: "Transformation" },
  { gates: [28, 38], name: "Struggle" },
  { gates: [18, 58], name: "Judgment" },
  { gates: [34, 57], name: "Power" },
  { gates: [6, 59],  name: "Mating" },
  { gates: [30, 41], name: "Recognition" },
  { gates: [55, 39], name: "Emoting" },
  { gates: [49, 19], name: "Synthesis" },
  { gates: [9, 52],  name: "Concentration" },
  { gates: [3, 60],  name: "Mutation" },
  { gates: [42, 53], name: "Maturation" },
];

/**
 * Anchor offset to place a gate dot near the edge of its center, facing its
 * connecting channel neighbor. v1 uses a deterministic pseudo-arc based on the
 * gate number so identical gates always render in the same spot within a center.
 * v2 can replace this with an exact per-gate anchor table (standard bodygraph layouts
 * assign each gate to a specific edge position).
 */
export function gateAnchor(gate: number, radius = 52): { dx: number; dy: number } {
  const seed = (gate * 2654435761) >>> 0; // Knuth multiplicative hash
  const angle = (seed % 360) * (Math.PI / 180);
  return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
}
