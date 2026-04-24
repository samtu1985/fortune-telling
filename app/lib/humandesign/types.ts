export type HdType =
  | "Manifestor" | "Generator" | "Manifesting Generator" | "Projector" | "Reflector";

export type CenterKey =
  | "head" | "ajna" | "throat" | "g" | "heart"
  | "solarPlexus" | "sacral" | "spleen" | "root";

export type Planet =
  | "sun" | "earth" | "moon" | "northNode" | "southNode"
  | "mercury" | "venus" | "mars" | "jupiter" | "saturn"
  | "uranus" | "neptune" | "pluto" | "chiron";

export interface HumanDesignInput {
  date: string;         // "YYYY-MM-DD" (Gregorian)
  time: string;         // "HH:mm"
  city: string;
  /**
   * IANA timezone. If omitted, v1 defaults to Asia/Taipei (offset +08:00)
   * to match existing bazi/ziwei Taipei-first convention. Future versions
   * may add a city→tz lookup or explicit picker.
   */
  timezone?: string;
}

export interface HumanDesignSummary {
  type: HdType;
  strategy: string;
  authority: string;
  profile: string;        // e.g. "1/3"
  definition: string;     // "Single" | "Split" | etc.
  signature: string;
  notSelfTheme: string;
}

export interface PlanetActivation {
  gate: number;
  line: number;
  color: number;
  tone: number;
  base: number;
}

export interface HumanDesignChartData {
  meta: { fetchedAt: string; service: "humandesign" };
  summary: HumanDesignSummary;
  centers: Record<CenterKey, { defined: boolean; activatedGates: number[] }>;
  channels: Array<{ gates: [number, number]; label: string; active: boolean }>;
  gates: Array<{ number: number; line: number; source: "personality" | "design"; planet: Planet }>;
  planets: {
    personality: Record<Planet, PlanetActivation>;
    design: Record<Planet, PlanetActivation>;
  };
  raw?: unknown;
}

export const CENTER_KEYS: CenterKey[] = [
  "head", "ajna", "throat", "g", "heart",
  "solarPlexus", "sacral", "spleen", "root",
];

export const PLANET_KEYS: Planet[] = [
  "sun", "earth", "moon", "northNode", "southNode",
  "mercury", "venus", "mars", "jupiter", "saturn",
  "uranus", "neptune", "pluto", "chiron",
];
