import { describe, it, expect } from "vitest";
import { Subject } from "../economy/KKLedger.js";
import { DifficultyTier } from "../education/QuestionBank.js";
import { Game } from "./Game.js";
import type { ScenarioDef } from "./Scenario.js";

function scenario(stability = 50): ScenarioDef {
  const tiles = [];
  for (let q = -1; q <= 1; q++) for (let r = -1; r <= 1; r++) if (Math.abs(-q - r) <= 1) tiles.push({ q, r });
  return {
    id: "maint-01",
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
    questions: [
      { id: "m1", subject: Subject.MATEMATIKA, topic: "algebra", b: 0, tier: DifficultyTier.ALAP },
      { id: "m2", subject: Subject.MATEMATIKA, topic: "algebra", b: 1, tier: DifficultyTier.ALAP },
      { id: "m3", subject: Subject.MATEMATIKA, topic: "algebra", b: 2, tier: DifficultyTier.ALAP },
    ],
    knowledgeCenters: [{ id: "egyetem", subject: Subject.MATEMATIKA, hex: { q: 0, r: 0 }, stability }],
  };
}

describe("Game — question-based maintenance (I10)", () => {
  it("draws a subject question and a correct answer raises theta AND stability", () => {
    const game = new Game(scenario(50), 1);
    const q = game.startMaintenance("egyetem");
    expect(q.subject).toBe(Subject.MATEMATIKA);
    expect(game.hasPendingMaintenance).toBe(true);

    const res = game.resolveMaintenance(true);
    expect(res.correct).toBe(true);
    expect(res.newTheta).toBeGreaterThan(0); // theta rose from 0
    expect(res.stability).toBe(70); // 50 + 20
    expect(game.hasPendingMaintenance).toBe(false);
  });

  it("a wrong answer lowers theta and stability (and can trigger rebellion)", () => {
    const game = new Game(scenario(20), 1);
    game.startMaintenance("egyetem");
    const res = game.resolveMaintenance(false); // 20 - 25 -> 0 -> rebelled
    expect(res.newTheta).toBeLessThan(0);
    expect(res.stability).toBe(0);
    expect(res.rebelled).toBe(true);
  });

  it("adapts: questions get harder as theta rises, no repeats", () => {
    const game = new Game(scenario(100), 1);
    const q1 = game.startMaintenance("egyetem");
    game.resolveMaintenance(true);
    const q2 = game.startMaintenance("egyetem");
    game.resolveMaintenance(true);
    const q3 = game.startMaintenance("egyetem");
    const ids = [q1.id, q2.id, q3.id];
    expect(new Set(ids).size).toBe(3); // no repeats
    // Difficulty should trend upward with rising theta.
    expect(q3.b).toBeGreaterThanOrEqual(q1.b);
  });

  it("round-trips maintenance state through save/load", () => {
    const game = new Game(scenario(50), 5);
    game.startMaintenance("egyetem");
    game.resolveMaintenance(true);
    const s = game.save();
    const loaded = Game.load(s, scenario(50));
    expect(loaded.save()).toEqual(s);
    // Continued selection excludes the already-used question identically.
    const a = game.startMaintenance("egyetem");
    const b = loaded.startMaintenance("egyetem");
    expect(a.id).toBe(b.id);
  });

  // Negative tests.
  it("rejects resolving with no open check and double-open", () => {
    const game = new Game(scenario(50), 1);
    expect(() => game.resolveMaintenance(true)).toThrow();
    game.startMaintenance("egyetem");
    expect(() => game.startMaintenance("egyetem")).toThrow();
  });

  it("rejects maintenance for an unknown center", () => {
    const game = new Game(scenario(50), 1);
    expect(() => game.startMaintenance("ghost")).toThrow(RangeError);
  });

  it("throws when the bank is exhausted", () => {
    const game = new Game(scenario(100), 1);
    for (let i = 0; i < 3; i++) {
      game.startMaintenance("egyetem");
      game.resolveMaintenance(true);
    }
    expect(() => game.startMaintenance("egyetem")).toThrow(RangeError);
  });
});
