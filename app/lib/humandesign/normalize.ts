import type {
  HumanDesignChartData,
  HdType,
  CenterKey,
  Planet,
  PlanetActivation,
} from "./types";
import { CENTER_KEYS, PLANET_KEYS } from "./types";

// API center names → internal CenterKey
const CENTER_NAME_MAP: Record<string, CenterKey> = {
  "Head": "head",
  "Ajna": "ajna",
  "Throat": "throat",
  "G": "g",
  "Heart": "heart",
  "Solar Plexus": "solarPlexus",
  "SolarPlexus": "solarPlexus",
  "Sacral": "sacral",
  "Spleen": "spleen",
  "Root": "root",
};

// API planet names → internal Planet
const PLANET_NAME_MAP: Record<string, Planet> = {
  "Sun": "sun",
  "Earth": "earth",
  "Moon": "moon",
  "NorthNode": "northNode",
  "North Node": "northNode",
  "SouthNode": "southNode",
  "South Node": "southNode",
  "Mercury": "mercury",
  "Venus": "venus",
  "Mars": "mars",
  "Jupiter": "jupiter",
  "Saturn": "saturn",
  "Uranus": "uranus",
  "Neptune": "neptune",
  "Pluto": "pluto",
  "Chiron": "chiron",
};

// Each of the 64 gates lives on exactly one of the 9 centers.
// Canonical Human Design assignment — used to route activatedGates from
// the flat `raw.gates` array to the correct center bucket.
const GATE_TO_CENTER: Record<number, CenterKey> = {
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

function asStr(v: unknown, field: string): string {
  if (typeof v !== "string" || !v) {
    throw new Error(`invalid response: missing ${field}`);
  }
  return v;
}

function blankActivation(): PlanetActivation {
  return { gate: 0, line: 0, color: 0, tone: 0, base: 0 };
}

function mapCenterName(name: string): CenterKey | undefined {
  return CENTER_NAME_MAP[name] ?? CENTER_NAME_MAP[name.replace(/\s+/g, "")];
}

function mapPlanetName(name: string): Planet | undefined {
  return PLANET_NAME_MAP[name] ?? PLANET_NAME_MAP[name.replace(/\s+/g, "")];
}

function normalizePlanetSide(
  r: Record<string, any>,
  side: "personality" | "design",
): Record<Planet, PlanetActivation> {
  const out = {} as Record<Planet, PlanetActivation>;
  for (const p of PLANET_KEYS) out[p] = blankActivation();

  const rich = r.gate_line_color_tone_base?.[side];
  if (rich && typeof rich === "object") {
    for (const [name, val] of Object.entries(rich)) {
      const key = mapPlanetName(name);
      if (!key) continue;
      const v = val as any;
      out[key] = {
        gate: Number(v.gate) || 0,
        line: Number(v.line) || 0,
        color: Number(v.color) || 0,
        tone: Number(v.tone) || 0,
        base: Number(v.base) || 0,
      };
    }
    return out;
  }

  const lean = r.gate_and_line?.[side];
  if (lean && typeof lean === "object") {
    for (const [name, val] of Object.entries(lean)) {
      const key = mapPlanetName(name);
      if (!key) continue;
      if (Array.isArray(val) && val.length >= 2) {
        out[key] = {
          gate: Number(val[0]) || 0,
          line: Number(val[1]) || 0,
          color: 0,
          tone: 0,
          base: 0,
        };
      }
    }
  }
  return out;
}

export function normalizeResponse(raw: unknown): HumanDesignChartData {
  if (!raw || typeof raw !== "object") {
    throw new Error("invalid response: not an object");
  }
  const r = raw as Record<string, any>;

  // --- Centers: start all as undefined, then mark defined ones + populate gates.
  const centers = {} as HumanDesignChartData["centers"];
  for (const k of CENTER_KEYS) {
    centers[k] = { defined: false, activatedGates: [] };
  }
  if (Array.isArray(r.centers)) {
    for (const name of r.centers) {
      if (typeof name !== "string") continue;
      const key = mapCenterName(name);
      if (key) centers[key].defined = true;
    }
  }
  if (Array.isArray(r.gates)) {
    for (const g of r.gates) {
      if (typeof g !== "number") continue;
      const center = GATE_TO_CENTER[g];
      if (center) centers[center].activatedGates.push(g);
    }
  }

  // --- Channels: API only returns active ones.
  const channels: HumanDesignChartData["channels"] = Array.isArray(r.channels)
    ? r.channels
        .filter(
          (c: any) =>
            c &&
            Array.isArray(c.gates) &&
            c.gates.length === 2 &&
            typeof c.gates[0] === "number" &&
            typeof c.gates[1] === "number",
        )
        .map((c: any) => ({
          gates: [Number(c.gates[0]), Number(c.gates[1])] as [number, number],
          label: String(c.name ?? ""),
          active: true,
        }))
    : [];

  // --- Planets: prefer gate_line_color_tone_base (rich) over gate_and_line (lean).
  const planets = {
    personality: normalizePlanetSide(r, "personality"),
    design: normalizePlanetSide(r, "design"),
  };

  // --- Gates: walk both sides' planet activations.
  const gates: HumanDesignChartData["gates"] = [];
  for (const side of ["personality", "design"] as const) {
    for (const [planet, act] of Object.entries(planets[side])) {
      if (act.gate) {
        gates.push({
          number: act.gate,
          line: act.line,
          source: side,
          planet: planet as Planet,
        });
      }
    }
  }

  return {
    meta: { fetchedAt: new Date().toISOString(), service: "humandesign" },
    summary: {
      type: asStr(r.type, "type") as HdType,
      strategy: asStr(r.strategy, "strategy"),
      authority: asStr(r.authority, "authority"),
      profile: asStr(r.profile, "profile"),
      definition: asStr(r.definition, "definition"),
      signature: String(r.signature ?? ""),
      notSelfTheme: String(r.not_self_theme ?? r.notSelf ?? r.notSelfTheme ?? ""),
    },
    centers,
    channels,
    gates,
    planets,
    raw,
  };
}
