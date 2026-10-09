import { describe, it, expect } from "vitest";
import { Subject } from "../economy/KKLedger.js";
import { DifficultyTier } from "../education/QuestionBank.js";
import { Game } from "./Game.js";
import type { ScenarioDef } from "./Scenario.js";

// Strategic map:  home(blue) - mid(neutral) - front(red, garrison 2) - keep(red, 999)
function scenario(): ScenarioDef {
  const tiles = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
  return {
    id: "strat-01",
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
    questions: [
      { id: "m1", subject: Subject.MATEMATIKA, topic: "t", b: 0, tier: DifficultyTier.ALAP },
      { id: "k1", subject: Subject.KEMIA, topic: "t", b: 0, tier: DifficultyTier.ALAP },
      { id: "k2", subject: Subject.KEMIA, topic: "t", b: 0.5, tier: DifficultyTier.ALAP },
      { id: "k3", subject: Subject.KEMIA, topic: "t", b: -0.5, tier: DifficultyTier.ALAP },
    ],
    knowledgeCenters: [{ id: "hub", subject: Subject.MATEMATIKA, hex: { q: 0, r: 0 }, stability: 100 }],
    strategic: {
      playerFaction: "blue",
      armyRegion: "home",
      armyStrength: 50, // strong army -> reliably wins the small garrison
      moveBudget: 2,
      regions: [
        { id: "home", owner: "blue", adjacent: ["mid"], subject: Subject.MATEMATIKA, kkPerTurn: 2 },
        { id: "mid", adjacent: ["home", "front"], subject: Subject.FIZIKA },
        { id: "front", owner: "red", adjacent: ["mid", "keep"], garrison: 2, subject: Subject.KEMIA, kkPerTurn: 3 },
        { id: "keep", owner: "red", adjacent: ["front"], garrison: 999, subject: Subject.FIZIKA },
      ],
    },
  };
}

describe("Game — strategic campaign layer (I43)", () => {
  it("exposes the strategic layer only when the scenario defines one", () => {
    const g = new Game(scenario(), 7);
    expect(g.hasStrategicLayer).toBe(true);
    expect(g.armyRegion).toBe("home");
    expect(g.movementBudget).toBe(2);
    expect(g.regionOwner("home")).toBe("blue");
    expect(g.regionOwner("mid")).toBeUndefined();
    expect(g.regionOwner("front")).toBe("red");
  });

  it("lists reachable targets, marching only to the enemy frontier", () => {
    const g = new Game(scenario(), 7);
    const t = g.strategicTargets();
    expect(t.map((x) => x.id)).toEqual(["front", "mid"]); // keep is behind front
    expect(t.find((x) => x.id === "front")!.enemy).toBe(true);
    expect(t.find((x) => x.id === "mid")!.enemy).toBe(false);
  });

  it("captures an enemy frontier region via a hex battle", () => {
    const g = new Game(scenario(), 7);
    const move = g.moveArmy("front"); // marches home->mid->front (cost 2)
    expect(move.battle).toBeDefined();
    expect(move.battle!.won).toBe(true);
    expect(move.captured).toBe(true);
    expect(g.armyRegion).toBe("front");
    expect(g.regionOwner("front")).toBe("blue");
    expect(g.movementBudget).toBe(0);
  });

  it("refills movement budget on endTurn", () => {
    const g = new Game(scenario(), 7);
    g.moveArmy("mid");
    expect(g.movementBudget).toBe(1);
    g.endTurn();
    expect(g.movementBudget).toBe(2);
  });

  it("round-trips strategic state through save/load", () => {
    const g = new Game(scenario(), 7);
    g.moveArmy("front"); // capture
    const save = g.save();
    expect(save.strategic).toBeDefined();
    expect(save.strategic!.armyRegion).toBe("front");

    const g2 = Game.load(save, scenario());
    expect(g2.hasStrategicLayer).toBe(true);
    expect(g2.armyRegion).toBe("front");
    expect(g2.regionOwner("front")).toBe("blue");
    expect(g2.movementBudget).toBe(save.strategic!.budgetLeft);
  });

  it("owned regions produce their subject's KK each turn", () => {
    const g = new Game(scenario(), 7);
    expect(g.regionSubject("home")).toBe(Subject.MATEMATIKA);
    expect(g.regionKKYield("home")).toBe(2);
    expect(g.regionKKYield("mid")).toBe(1); // subject present, default yield 1
    // Only home owned at start -> +2 MATEMATIKA on endTurn.
    g.endTurn();
    expect(g.kkOf(Subject.MATEMATIKA)).toBe(2);
    // Capture KEMIA front (yield 3); next turn adds MATEMATIKA(home 2) + KEMIA(front 3).
    g.moveArmy("front");
    g.endTurn();
    expect(g.kkOf(Subject.MATEMATIKA)).toBe(4);
    expect(g.kkOf(Subject.KEMIA)).toBe(3);
  });

  it("capture questions come from the region's subject", () => {
    const g = new Game(scenario(), 7);
    const qs = g.captureQuestions("front", 3); // front teaches KEMIA
    expect(qs).toHaveLength(3);
    expect(qs.every((q) => q.subject === Subject.KEMIA)).toBe(true);
    expect(new Set(qs.map((q) => q.id)).size).toBe(3); // all distinct
    // A region with no subject yields no capture questions.
    expect(g.captureQuestions("keep", 3).map((q) => q.subject)).toEqual([]); // keep is FIZIKA but bank has none
  });

  it("a scenario without a strategic block has no strategic layer", () => {
    const base = scenario();
    const { strategic, ...noStrat } = base;
    const g = new Game(noStrat as ScenarioDef, 1);
    expect(g.hasStrategicLayer).toBe(false);
    expect(() => g.armyRegion).toThrow(/no strategic layer/);
    expect(g.save().strategic).toBeUndefined();
  });
});
