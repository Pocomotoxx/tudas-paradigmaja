// europe.ts — a sample "alternative Europe" scenario built from typed locations.
//
// Content, not engine: the names are FICTIONAL and the layout is invented. The
// map is recognisable in feel (universities, laboratories, observatories,
// fortresses) but is not the real political map. Knowledge-bearing locations
// become KnowledgeCenters via the core's knowledgeCentersFromLocations bridge.

import {
  Game,
  LocationType,
  Subject,
  DifficultyTier,
  knowledgeCentersFromLocations,
  type WorldLocation,
  type ScenarioDef,
} from "@tudas-paradigmaja/core";
import { scientistsPack } from "./scientistsPack.js";
import { coreQuestionBank } from "./questionBank.js";

/** Fictional alternative-Europe locations on a small hex map. */
export function europeLocations(): WorldLocation[] {
  return [
    { id: "aurelia", type: LocationType.CITY, hex: { q: 0, r: 0 }, label: "Aurelia (capital)" },
    { id: "mathis-obs", type: LocationType.OBSERVATORY, hex: { q: 1, r: 0 }, label: "Mathis Observatory", requiresCapture: true, stability: 100 },
    { id: "kemia-lab", type: LocationType.LABORATORY, hex: { q: 0, r: 1 }, label: "Kemia Laboratory", stability: 60 },
    { id: "chronos", type: LocationType.HISTORICAL_SITE, hex: { q: -1, r: 1 }, label: "Chronos Ruins", requiresCapture: true, stability: 100 },
    { id: "vesta", type: LocationType.FORTRESS, hex: { q: 1, r: -1 }, label: "Vesta Fortress" },
    { id: "bioterra", type: LocationType.UNIVERSITY, hex: { q: -1, r: 0 }, label: "Bioterra University", subject: Subject.BIOLOGIA, stability: 60 },
  ];
}

// The real, content-rich multiple-choice bank (I50) — all 9 subjects, enough
// distractors for the hardest difficulty's 7-option questions.
function questions() {
  return coreQuestionBank();
}

export interface EuropeScenario {
  readonly scenario: ScenarioDef;
  readonly locations: WorldLocation[];
}

export function europeScenario(): EuropeScenario {
  const locations = europeLocations();
  const tiles = [];
  for (let qc = -2; qc <= 2; qc++) {
    for (let r = -2; r <= 2; r++) {
      if (Math.abs(-qc - r) <= 2) tiles.push({ q: qc, r });
    }
  }
  const scenario: ScenarioDef = {
    id: "europe-01",
    tiles,
    heroStart: { q: 0, r: 0 },
    tokenBuilding: { q: 0, r: 0 }, // legacy field; centers drive the economy here
    tokensPerTurn: 2,
    tokenCap: 50,
    tokenCostPerTest: 1,
    playerSubject: Subject.MATEMATIKA,
    playerUnit: {
      id: "golem",
      name: "Kalkulus-gólem",
      subject: Subject.MATEMATIKA,
      base: { attack: 6, defense: 10, health: 50, speed: 3, initiative: 5 },
    },
    enemy: { id: "guard", stats: { attack: 5, defense: 4, health: 30, speed: 2, initiative: 3 } },
    techNodes: [],
    questions: questions(),
    knowledgeCenters: knowledgeCentersFromLocations(locations),
  };
  return { scenario, locations };
}

const GLYPH: Readonly<Record<LocationType, string>> = {
  [LocationType.CITY]: "C",
  [LocationType.FORTRESS]: "F",
  [LocationType.UNIVERSITY]: "U",
  [LocationType.LABORATORY]: "L",
  [LocationType.OBSERVATORY]: "O",
  [LocationType.HISTORICAL_SITE]: "H",
  [LocationType.INDUSTRIAL]: "I",
  [LocationType.PORT]: "P",
  [LocationType.RESEARCH_CENTER]: "R",
  [LocationType.LIBRARY]: "B",
  [LocationType.DATA_CENTER]: "D",
  [LocationType.EMBASSY]: "E",
};

/** ASCII map with a glyph per location type; the hero (@) overrides its tile. */
export function renderWorldMap(locations: readonly WorldLocation[], game: Game): string {
  const tiles = game.mapTiles();
  const hero = game.heroAt();
  const locAt = new Map(locations.map((l) => [`${l.hex.q},${l.hex.r}`, l]));
  const qs = tiles.map((t) => t.q), rs = tiles.map((t) => t.r);
  const minQ = Math.min(...qs), maxQ = Math.max(...qs);
  const minR = Math.min(...rs), maxR = Math.max(...rs);
  const present = new Set(tiles.map((t) => `${t.q},${t.r}`));

  const lines: string[] = [];
  for (let r = minR; r <= maxR; r++) {
    let row = " ".repeat(r - minR);
    for (let q = minQ; q <= maxQ; q++) {
      const key = `${q},${r}`;
      if (!present.has(key)) { row += "  "; continue; }
      let cell = ".";
      const loc = locAt.get(key);
      if (loc) cell = GLYPH[loc.type];
      if (q === hero.q && r === hero.r) cell = "@";
      row += cell + " ";
    }
    lines.push(row.replace(/\s+$/, ""));
  }
  return lines.join("\n");
}

/**
 * A heroes-enabled alternative-Europe scenario: four owned discipline-city
 * centers (so their scientists are hireable and produce tokens) plus one famous
 * scientist per city from the content pack.
 */
export function europeHeroesScenario(): ScenarioDef {
  const tiles = [];
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      if (Math.abs(-q - r) <= 2) tiles.push({ q, r });
    }
  }
  const q = (id: string, subject: Subject, b: number) => ({ id, subject, topic: "t", b, tier: DifficultyTier.SZAKERTO });
  const picks = new Set(["newton", "curie", "euler", "szentgyorgyi"]);
  return {
    id: "europe-heroes-01",
    tiles,
    heroStart: { q: 0, r: 0 },
    tokenBuilding: { q: 0, r: 0 },
    tokensPerTurn: 2,
    tokenCap: 50,
    tokenCostPerTest: 1,
    playerSubject: Subject.MATEMATIKA,
    playerUnit: {
      id: "golem",
      name: "Kalkulus-gólem",
      subject: Subject.MATEMATIKA,
      base: { attack: 6, defense: 10, health: 50, speed: 3, initiative: 5 },
    },
    enemy: { id: "guard", stats: { attack: 5, defense: 4, health: 40, speed: 2, initiative: 3 } },
    techNodes: [],
    questions: [
      q("mat1", Subject.MATEMATIKA, 0), q("mat2", Subject.MATEMATIKA, 1), q("mat3", Subject.MATEMATIKA, 2),
      q("fiz1", Subject.FIZIKA, 0), q("kem1", Subject.KEMIA, 0), q("bio1", Subject.BIOLOGIA, 0),
    ],
    // Owned discipline-city centers (ids match the pack's birthplace city ids).
    knowledgeCenters: [
      { id: "numeris", subject: Subject.MATEMATIKA, hex: { q: 0, r: 0 }, stability: 100 },
      { id: "dynamis", subject: Subject.FIZIKA, hex: { q: 1, r: 0 }, stability: 100 },
      { id: "catalyss", subject: Subject.KEMIA, hex: { q: 0, r: 1 }, stability: 100 },
      { id: "viridia", subject: Subject.BIOLOGIA, hex: { q: -1, r: 1 }, stability: 100 },
    ],
    scientists: scientistsPack().filter((s) => picks.has(s.id)),
  };
}
