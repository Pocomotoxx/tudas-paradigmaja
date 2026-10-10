import { describe, it, expect } from "vitest";
import { Subject } from "../economy/KKLedger.js";
import { DifficultyTier } from "../education/QuestionBank.js";
import { Game } from "./Game.js";
import { Difficulty } from "./Difficulty.js";
import type { ScenarioDef } from "./Scenario.js";

// A center that rebels after a couple of wrong answers (low stability + big loss).
function scenario(difficulty: Difficulty): ScenarioDef {
  const tiles = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
  return {
    id: "diff-01",
    tiles,
    heroStart: { q: 0, r: 0 },
    tokenBuilding: { q: 1, r: 0 },
    tokensPerTurn: 2,
    tokenCap: 50,
    tokenCostPerTest: 1,
    playerSubject: Subject.FIZIKA,
    playerUnit: { id: "golem", name: "Gólem", subject: Subject.FIZIKA, base: { attack: 6, defense: 10, health: 50, speed: 3, initiative: 5 } },
    enemy: { id: "guard", stats: { attack: 5, defense: 4, health: 60, speed: 2, initiative: 3 } },
    techNodes: [],
    questions: [{ id: "f1", subject: Subject.FIZIKA, topic: "t", b: 0, tier: DifficultyTier.ALAP }],
    knowledgeCenters: [
      { id: "hub", subject: Subject.FIZIKA, hex: { q: 0, r: 0 }, stability: 30, config: { maxStability: 100, gainPerCorrect: 20, lossPerWrong: 25, recoveryThreshold: 34 } },
    ],
    difficulty,
  };
}

describe("Game — difficulty rebellion interval (I48)", () => {
  it("level 1: a rebellion can only recur every 10 turns", () => {
    const g = new Game(scenario(Difficulty.ONE), 1);
    expect(g.rebellionIntervalTurns).toBe(10);
    // Two wrong answers: 30 -> 5 -> rebel (0). First rebellion is allowed.
    g.answerMaintenance("hub", false);
    g.answerMaintenance("hub", false);
    expect(g.centerRebelled("hub")).toBe(true);
    // Recover out of rebellion with correct answers, then try to rebel again
    // immediately — it is suppressed because < 10 turns have passed.
    g.answerMaintenance("hub", true); // +20 -> 20
    g.answerMaintenance("hub", true); // +20 -> 40 (>= recovery 34) -> not rebelled
    expect(g.centerRebelled("hub")).toBe(false);
    g.answerMaintenance("hub", false); // 15
    g.answerMaintenance("hub", false); // would hit 0 -> rebel, but suppressed
    expect(g.centerRebelled("hub")).toBe(false); // rebellion gated by interval
  });

  it("level 4: rebellions can recur after only 3 turns", () => {
    const g = new Game(scenario(Difficulty.FOUR), 1);
    expect(g.rebellionIntervalTurns).toBe(3);
    g.answerMaintenance("hub", false);
    g.answerMaintenance("hub", false);
    expect(g.centerRebelled("hub")).toBe(true); // first rebellion at turn 1
    // advance 3 turns so the interval elapses
    g.answerMaintenance("hub", true); g.answerMaintenance("hub", true); // recover to 40
    g.endTurn(); g.endTurn(); g.endTurn(); // now turn 4, >=3 since turn 1
    g.answerMaintenance("hub", false); g.answerMaintenance("hub", false);
    expect(g.centerRebelled("hub")).toBe(true); // allowed again
  });
});

describe("Game — subject unrest cascade (I48, levels 3–4)", () => {
  it("levels 1–2 never raise unrest", () => {
    const g = new Game(scenario(Difficulty.TWO), 1);
    for (let i = 0; i < 8; i++) g.answerMaintenance("hub", false);
    expect(g.unrestOf(Subject.FIZIKA)).toBe(0);
    expect(g.desertionChance(Subject.FIZIKA)).toBe(0);
  });

  it("level 3: repeated wrong answers raise unrest and a growing desertion chance", () => {
    const g = new Game(scenario(Difficulty.THREE), 1);
    for (let i = 0; i < 6; i++) g.answerMaintenance("hub", false); // past threshold 3
    expect(g.unrestOf(Subject.FIZIKA)).toBeGreaterThan(0);
    expect(g.desertionChance(Subject.FIZIKA)).toBeGreaterThan(0);
  });

  it("round-trips difficulty state through save/load", () => {
    const g = new Game(scenario(Difficulty.THREE), 1);
    for (let i = 0; i < 6; i++) g.answerMaintenance("hub", false);
    const save = g.save();
    expect(save.subjectUnrest).toBeDefined();
    const g2 = Game.load(save, scenario(Difficulty.THREE));
    expect(g2.unrestOf(Subject.FIZIKA)).toBe(g.unrestOf(Subject.FIZIKA));
    expect(g2.rebellionIntervalTurns).toBe(6);
  });
});
