// demoScenario — a single playable slice used by the CLI demo and tests.
// Pure data (G1: one scripted scenario).

import { Subject, BonusOp, DifficultyTier, type ScenarioDef } from "@tudas-paradigmaja/core";

export function demoScenario(): ScenarioDef {
  const tiles = [];
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      if (Math.abs(-q - r) <= 2) tiles.push({ q, r });
    }
  }
  return {
    id: "demo-01",
    tiles,
    heroStart: { q: 0, r: 0 },
    tokenBuilding: { q: 1, r: 0 },
    tokensPerTurn: 2,
    tokenCap: 5,
    tokenCostPerTest: 1,
    playerSubject: Subject.MATEMATIKA,
    playerUnit: {
      id: "golem",
      name: "Kalkulus-gólem",
      subject: Subject.MATEMATIKA,
      base: { attack: 6, defense: 10, health: 50, speed: 3, initiative: 5 },
    },
    enemy: {
      id: "guard",
      stats: { attack: 5, defense: 4, health: 30, speed: 2, initiative: 3 },
    },
    techNodes: [
      {
        id: "t-atk",
        subject: Subject.MATEMATIKA,
        kkCost: 1,
        bonuses: [{ id: "atk+", stat: "attack", op: BonusOp.ADD, value: 12, source: "t-atk" }],
      },
    ],
    questions: [
      { id: "m1", subject: Subject.MATEMATIKA, topic: "algebra", b: 0, tier: DifficultyTier.ALAP },
      { id: "m2", subject: Subject.MATEMATIKA, topic: "algebra", b: 1, tier: DifficultyTier.ALAP },
    ],
  };
}
