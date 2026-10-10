import { describe, it, expect } from "vitest";
import { SeededRng } from "../rng/SeededRng.js";
import { Subject } from "../economy/KKLedger.js";
import { Game } from "./Game.js";
import { Difficulty } from "./Difficulty.js";
import { SubjectUnrest, SUBJECT_UNREST_DEFAULTS } from "./SubjectUnrest.js";
import { DifficultyTier } from "../education/QuestionBank.js";
import type { ScenarioDef } from "./Scenario.js";

const F = Subject.FIZIKA, K = Subject.KEMIA;

describe("SubjectUnrest (I48) — levels 3–4 cascade", () => {
  it("does nothing when disabled (difficulty 1–2)", () => {
    const u = new SubjectUnrest({ enabled: false });
    for (let i = 0; i < 10; i++) u.recordAnswer(F, false);
    expect(u.unrestOf(F)).toBe(0);
    expect(u.desertionChance(F)).toBe(0);
    expect(u.unrestfulSubjects()).toEqual([]);
  });

  it("raises unrest only after several wrong answers (threshold)", () => {
    const u = new SubjectUnrest({ enabled: true, wrongThreshold: 3, unrestStep: 1 });
    u.recordAnswer(F, false); u.recordAnswer(F, false); u.recordAnswer(F, false);
    expect(u.unrestOf(F)).toBe(0); // 3 wrong = at threshold, not past it
    u.recordAnswer(F, false); // 4th
    expect(u.unrestOf(F)).toBe(1);
    u.recordAnswer(F, false); // 5th
    expect(u.unrestOf(F)).toBe(2);
    expect(u.unrestOf(K)).toBe(0); // other subjects untouched
  });

  it("desertion chance grows with unrest and correct answers cool it", () => {
    const u = new SubjectUnrest({ enabled: true, wrongThreshold: 0, unrestStep: 1, desertionPerUnrest: 0.1 });
    u.recordAnswer(F, false); // unrest 1
    u.recordAnswer(F, false); // unrest 2
    expect(u.desertionChance(F)).toBeCloseTo(0.2, 6);
    u.recordAnswer(F, true); // cool by 1 -> unrest 1
    expect(u.desertionChance(F)).toBeCloseTo(0.1, 6);
    expect(u.unrestfulSubjects()).toEqual([F]);
  });

  it("caps unrest and its desertion chance at 1", () => {
    const u = new SubjectUnrest({ enabled: true, wrongThreshold: 0, unrestStep: 5, maxUnrest: 10, desertionPerUnrest: 0.5 });
    for (let i = 0; i < 10; i++) u.recordAnswer(F, false);
    expect(u.unrestOf(F)).toBe(10);
    expect(u.desertionChance(F)).toBe(1);
  });

  it("rolls more desertions as unrest rises, deterministically", () => {
    const u = new SubjectUnrest({ enabled: true, wrongThreshold: 0, unrestStep: 1, desertionPerUnrest: 0.1 });
    for (let i = 0; i < 5; i++) u.recordAnswer(F, false); // unrest 5 -> 50%
    const a = u.rollDesertions(F, 100, new SeededRng(1));
    const b = u.rollDesertions(F, 100, new SeededRng(1));
    expect(a).toBe(b);             // deterministic
    expect(a).toBeGreaterThan(30); // ~50 of 100
    expect(a).toBeLessThan(70);
    expect(u.rollDesertions(F, 0, new SeededRng(1))).toBe(0);
  });

  it("round-trips through snapshot/restore", () => {
    const u = new SubjectUnrest({ enabled: true, wrongThreshold: 1 });
    u.recordAnswer(F, false); u.recordAnswer(F, false); u.recordAnswer(K, false);
    const snap = u.snapshot();
    const u2 = new SubjectUnrest({ enabled: true, wrongThreshold: 1 });
    u2.restore(snap);
    expect(u2.unrestOf(F)).toBe(u.unrestOf(F));
    expect(u2.snapshot()).toEqual(snap);
  });
});

// --- confirmed balance (2026-10-10): 3 free wrong answers, 80% desertion at
// max unrest, same cascade on levels 3 and 4, inert on 1–2 -------------------
function unrestScenario(difficulty: Difficulty): ScenarioDef {
  const tiles = [{ q: 0, r: 0 }];
  return {
    id: "unrest-balance-01",
    tiles,
    heroStart: { q: 0, r: 0 },
    tokenBuilding: { q: 0, r: 0 },
    tokensPerTurn: 0,
    tokenCap: 50,
    tokenCostPerTest: 1,
    playerSubject: Subject.FIZIKA,
    playerUnit: { id: "golem", name: "Gólem", subject: Subject.FIZIKA, base: { attack: 6, defense: 10, health: 50, speed: 3, initiative: 5 } },
    enemy: { id: "guard", stats: { attack: 5, defense: 4, health: 60, speed: 2, initiative: 3 } },
    techNodes: [],
    questions: [{ id: "f1", subject: Subject.FIZIKA, topic: "t", b: 0, tier: DifficultyTier.ALAP }],
    knowledgeCenters: [{ id: "hub", subject: Subject.FIZIKA, hex: { q: 0, r: 0 }, stability: 100 }],
    difficulty,
  };
}

describe("SubjectUnrest balance — confirmed with the project owner (2026-10-10)", () => {
  it("SUBJECT_UNREST_DEFAULTS match the agreed numbers", () => {
    expect(SUBJECT_UNREST_DEFAULTS.wrongThreshold).toBe(3);   // 3 wrong answers are "free"
    expect(SUBJECT_UNREST_DEFAULTS.desertionPerUnrest).toBe(0.08); // 80% at max unrest (10)
    expect(SUBJECT_UNREST_DEFAULTS.maxUnrest * SUBJECT_UNREST_DEFAULTS.desertionPerUnrest).toBeCloseTo(0.8, 6);
  });

  it("3 wrong answers are free; the 4th starts raising unrest — on both level 3 and 4", () => {
    for (const diff of [Difficulty.THREE, Difficulty.FOUR]) {
      const g = new Game(unrestScenario(diff), 1);
      g.answerMaintenance("hub", false);
      g.answerMaintenance("hub", false);
      g.answerMaintenance("hub", false);
      expect(g.unrestOf(Subject.FIZIKA)).toBe(0); // still free
      g.answerMaintenance("hub", false); // 4th wrong
      expect(g.unrestOf(Subject.FIZIKA)).toBe(1);
      expect(g.desertionChance(Subject.FIZIKA)).toBeCloseTo(0.08, 6);
    }
  });

  it("levels 1–2 never engage the cascade, regardless of how many wrong answers", () => {
    for (const diff of [Difficulty.ONE, Difficulty.TWO]) {
      const g = new Game(unrestScenario(diff), 1);
      for (let i = 0; i < 10; i++) g.answerMaintenance("hub", false);
      expect(g.unrestOf(Subject.FIZIKA)).toBe(0);
      expect(g.desertionChance(Subject.FIZIKA)).toBe(0);
    }
  });
});
