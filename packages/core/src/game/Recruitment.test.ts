import { describe, it, expect } from "vitest";
import { Subject } from "../economy/KKLedger.js";
import { DifficultyTier } from "../education/QuestionBank.js";
import { BattleOutcome } from "../combat/Battle.js";
import { Game } from "./Game.js";
import type { ScenarioDef } from "./Scenario.js";

function scenario(): ScenarioDef {
  const tiles = [];
  for (let q = -1; q <= 1; q++) for (let r = -1; r <= 1; r++) if (Math.abs(-q - r) <= 1) tiles.push({ q, r });
  return {
    id: "rec-01",
    tiles,
    heroStart: { q: 0, r: 0 },
    tokenBuilding: { q: 1, r: 0 },
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
    questions: [{ id: "m1", subject: Subject.MATEMATIKA, topic: "t", b: 0, tier: DifficultyTier.ALAP }],
    knowledgeCenters: [{ id: "egyetem", subject: Subject.MATEMATIKA, hex: { q: 0, r: 0 }, stability: 100 }],
    garrisons: [
      {
        locationId: "vesta",
        templates: [
          { id: "spearman", name: "Spearman", subject: Subject.MATEMATIKA, kkCost: 0, base: { attack: 7, defense: 6, health: 40, speed: 4, initiative: 6 } },
          { id: "elite", name: "Elite", subject: Subject.MATEMATIKA, kkCost: 5, base: { attack: 12, defense: 9, health: 60, speed: 4, initiative: 7 } },
        ],
      },
    ],
  };
}

describe("Game — fortress recruitment (I17)", () => {
  it("lists garrison templates and recruits a free unit into the army", () => {
    const game = new Game(scenario(), 1);
    expect(game.garrisonTemplateIds("vesta").sort()).toEqual(["elite", "spearman"]);
    expect(game.armySize).toBe(1);
    const u = game.recruit("vesta", "spearman"); // kkCost 0
    expect(game.armySize).toBe(2);
    expect(game.armyUnitIds()).toContain(u.id);
    expect(u.id).toBe("spearman#1");
  });

  it("spends KK and blocks recruitment when KK is insufficient", () => {
    const game = new Game(scenario(), 1);
    expect(() => game.recruit("vesta", "elite")).toThrow(RangeError); // needs 5 KK, has 0
  });

  it("the recruited army fights alongside the hero", () => {
    const game = new Game(scenario(), 3);
    game.recruit("vesta", "spearman");
    const res = game.fight();
    expect(game.armySize).toBe(2);
    expect(res.outcome).toBe(BattleOutcome.PLAYER);
    // Both army units appear as attackers in the log.
    const attackers = new Set(res.log.map((e) => e.attackerId));
    expect(attackers.has("golem")).toBe(true);
    expect(attackers.has("spearman#1")).toBe(true);
  });

  it("round-trips recruited units through save/load", () => {
    const game = new Game(scenario(), 1);
    game.recruit("vesta", "spearman");
    const s = game.save();
    const loaded = Game.load(s, scenario());
    expect(loaded.save()).toEqual(s);
    expect(loaded.armySize).toBe(2);
    expect(loaded.armyUnitIds()).toEqual(game.armyUnitIds());
  });

  // Negative tests.
  it("rejects unknown garrison and template", () => {
    const game = new Game(scenario(), 1);
    expect(() => game.recruit("ghost", "spearman")).toThrow(RangeError);
    expect(() => game.recruit("vesta", "ghost")).toThrow(RangeError);
  });
});
