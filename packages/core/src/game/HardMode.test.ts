import { describe, it, expect } from "vitest";
import { Subject } from "../economy/KKLedger.js";
import { SupplyLedger } from "../economy/SupplyLedger.js";
import { DifficultyTier } from "../education/QuestionBank.js";
import { Game } from "./Game.js";
import type { ScenarioDef } from "./Scenario.js";

function scenario(hardMode: boolean, supplyPerTurn = 1): ScenarioDef {
  const tiles = [];
  for (let q = -1; q <= 1; q++) for (let r = -1; r <= 1; r++) if (Math.abs(-q - r) <= 1) tiles.push({ q, r });
  return {
    id: "hard-01",
    tiles,
    heroStart: { q: 0, r: 0 },
    tokenBuilding: { q: 1, r: 0 },
    tokensPerTurn: 2,
    tokenCap: 50,
    tokenCostPerTest: 1,
    playerSubject: Subject.MATEMATIKA,
    playerUnit: { id: "golem", name: "Gólem", subject: Subject.MATEMATIKA, base: { attack: 6, defense: 10, health: 50, speed: 3, initiative: 5 } },
    enemy: { id: "guard", stats: { attack: 5, defense: 4, health: 60, speed: 2, initiative: 3 } },
    techNodes: [],
    questions: [{ id: "m1", subject: Subject.MATEMATIKA, topic: "t", b: 0, tier: DifficultyTier.ALAP }],
    knowledgeCenters: [{ id: "hub", subject: Subject.MATEMATIKA, hex: { q: 0, r: 0 }, stability: 100 }],
    hardMode,
    supplyPerTurn,
    unitUpkeep: 1,
    initialSupply: 0,
  };
}

describe("SupplyLedger (I28)", () => {
  it("produces and spends, blocking overspend", () => {
    const l = new SupplyLedger(2);
    l.produce(3);
    expect(l.balance).toBe(5);
    l.spend(4);
    expect(l.balance).toBe(1);
    expect(l.canSpend(2)).toBe(false);
    expect(() => l.spend(2)).toThrow(RangeError);
  });

  it("rejects negative amounts", () => {
    expect(() => new SupplyLedger(-1)).toThrow(TypeError);
    expect(() => new SupplyLedger(0).produce(-1)).toThrow(TypeError);
  });
});

describe("Game — hard mode supply logistics (I28)", () => {
  it("default mode ignores supply entirely", () => {
    const game = new Game(scenario(false), 1);
    expect(game.isHardMode).toBe(false);
    game.endTurn();
    expect(game.isStarving).toBe(false);
    expect(game.supplyBalance).toBe(0);
  });

  it("pays upkeep from supply each turn when it can", () => {
    const game = new Game(scenario(true, 2), 1); // +2 supply/turn, 1 unit upkeep 1
    game.endTurn(); // +2 produced, -1 upkeep => 1
    expect(game.supplyBalance).toBe(1);
    expect(game.isStarving).toBe(false);
  });

  it("starves when supply cannot cover upkeep", () => {
    const game = new Game(scenario(true, 0), 1); // no supply income, upkeep 1
    game.endTurn();
    expect(game.isStarving).toBe(true);
    expect(game.supplyBalance).toBe(0);
  });

  it("starving applies a combat penalty (battle differs)", () => {
    const starved = new Game(scenario(true, 0), 9);
    starved.endTurn(); // starving now
    expect(starved.isStarving).toBe(true);
    const a = starved.fight();

    const fed = new Game(scenario(true, 5), 9);
    fed.endTurn(); // well supplied, not starving
    expect(fed.isStarving).toBe(false);
    const b = fed.fight();

    expect(a.log).not.toEqual(b.log); // -2 attack while starving changes the fight
  });

  it("round-trips supply and starving through save/load", () => {
    const game = new Game(scenario(true, 0), 1);
    game.endTurn(); // starving, supply 0
    const s = game.save();
    const loaded = Game.load(s, scenario(true, 0));
    expect(loaded.save()).toEqual(s);
    expect(loaded.isStarving).toBe(true);
  });
});
