import { describe, it, expect } from "vitest";
import { Subject } from "../economy/KKLedger.js";
import { Game } from "./Game.js";
import type { ScenarioDef } from "./Scenario.js";

function centeredScenario(stability: number): ScenarioDef {
  const tiles = [];
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      if (Math.abs(-q - r) <= 2) tiles.push({ q, r });
    }
  }
  return {
    id: "center-01",
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
    enemy: { id: "guard", stats: { attack: 5, defense: 4, health: 30, speed: 2, initiative: 3 } },
    techNodes: [],
    questions: [],
    knowledgeCenters: [
      { id: "egyetem", subject: Subject.MATEMATIKA, hex: { q: 0, r: 0 }, stability },
    ],
  };
}

describe("Game — knowledge-center economy integration (I9)", () => {
  it("token production comes from the center's stepped stability output", () => {
    const game = new Game(centeredScenario(100), 1); // HIGH -> output 3
    expect(game.centerTokenOutput("egyetem")).toBe(3);
    game.endTurn();
    expect(game.tokenBalance).toBe(3);
    game.endTurn();
    expect(game.tokenBalance).toBe(6);
  });

  it("rebellion cuts token production; recovery restores it (E1/E3)", () => {
    const game = new Game(centeredScenario(20), 1); // LOW -> output 1, loss 25
    game.answerMaintenance("egyetem", false); // 20 -> 0 -> rebelled
    expect(game.centerRebelled("egyetem")).toBe(true);
    expect(game.centerTokenOutput("egyetem")).toBe(0);

    game.endTurn(); // rebelled center produces nothing
    expect(game.tokenBalance).toBe(0);

    game.answerMaintenance("egyetem", true); // 0 -> 20, still rebelled (below recovery 34)
    expect(game.centerRebelled("egyetem")).toBe(true);
    game.answerMaintenance("egyetem", true); // 20 -> 40, recovered (MID, output 2)
    expect(game.centerRebelled("egyetem")).toBe(false);

    game.endTurn();
    expect(game.tokenBalance).toBe(2);
  });

  it("maintenance answers raise stability on correct", () => {
    const game = new Game(centeredScenario(50), 1);
    const before = game.centerStability("egyetem");
    game.answerMaintenance("egyetem", true);
    expect(game.centerStability("egyetem")).toBeGreaterThan(before);
  });

  it("save/load round-trips center state and continues identically", () => {
    const game = new Game(centeredScenario(20), 9);
    game.answerMaintenance("egyetem", false); // rebelled
    game.answerMaintenance("egyetem", true); // 20
    const s = game.save();
    const loaded = Game.load(s, centeredScenario(20));
    expect(loaded.save()).toEqual(s);
    expect(loaded.centerStability("egyetem")).toBe(game.centerStability("egyetem"));
    expect(loaded.centerRebelled("egyetem")).toBe(game.centerRebelled("egyetem"));

    game.endTurn();
    loaded.endTurn();
    expect(loaded.save()).toEqual(game.save());
  });

  it("unknown center id throws", () => {
    const game = new Game(centeredScenario(100), 1);
    expect(() => game.centerStability("ghost")).toThrow(RangeError);
    expect(() => game.answerMaintenance("ghost", true)).toThrow(RangeError);
  });

  it("legacy scenarios without centers keep the tokenBuilding economy", () => {
    const base = centeredScenario(100);
    const legacy: ScenarioDef = { ...base };
    delete (legacy as { knowledgeCenters?: unknown }).knowledgeCenters;
    const game = new Game(legacy, 1);
    expect(game.hasCenters).toBe(false);
    game.moveHero({ q: 1, r: 0 }); // onto token building
    game.endTurn();
    expect(game.tokenBalance).toBe(2); // legacy tokensPerTurn
  });
});
