import { describe, it, expect } from "vitest";
import { SeededRng } from "../rng/SeededRng.js";
import { Subject } from "../economy/KKLedger.js";
import { DifficultyTier, validateQuestion, type QuestionItem } from "../education/QuestionBank.js";
import { buildChoices } from "../education/MultipleChoice.js";
import { Difficulty, difficultyParams } from "./Difficulty.js";

describe("Difficulty (I47) — four levels", () => {
  it("maps each level to its rebellion interval and choice count", () => {
    expect(difficultyParams(Difficulty.ONE)).toMatchObject({ rebellionIntervalTurns: 10, choiceCount: 2, subjectUnrestCascade: false });
    expect(difficultyParams(Difficulty.TWO)).toMatchObject({ rebellionIntervalTurns: 8, choiceCount: 3, subjectUnrestCascade: false });
    expect(difficultyParams(Difficulty.THREE)).toMatchObject({ rebellionIntervalTurns: 6, choiceCount: 5, subjectUnrestCascade: true });
    expect(difficultyParams(Difficulty.FOUR)).toMatchObject({ rebellionIntervalTurns: 3, choiceCount: 7, subjectUnrestCascade: true });
  });

  it("enables the subject-unrest cascade only on levels 3 and 4", () => {
    expect([Difficulty.ONE, Difficulty.TWO].map((l) => difficultyParams(l).subjectUnrestCascade)).toEqual([false, false]);
    expect([Difficulty.THREE, Difficulty.FOUR].map((l) => difficultyParams(l).subjectUnrestCascade)).toEqual([true, true]);
  });
});

const MCQ: QuestionItem = {
  id: "q1", subject: Subject.FIZIKA, topic: "erő", b: 0, tier: DifficultyTier.ALAP,
  prompt: "Mi a Newton SI-mértékegysége?",
  correct: "newton (N)",
  distractors: ["joule (J)", "watt (W)", "pascal (Pa)", "coulomb (C)", "volt (V)", "tesla (T)"],
};

describe("MultipleChoice (I47) — felelet választós options", () => {
  it("builds exactly choiceCount options with one correct, no duplicates", () => {
    for (const n of [2, 3, 5, 7]) {
      const set = buildChoices(MCQ, n, new SeededRng(1));
      expect(set.choices).toHaveLength(n);
      expect(set.choices.filter((c) => c.correct)).toHaveLength(1);
      expect(set.choices[set.correctIndex]!.correct).toBe(true);
      expect(set.choices[set.correctIndex]!.text).toBe("newton (N)");
      expect(new Set(set.choices.map((c) => c.text)).size).toBe(n); // distinct
      expect(set.choices.some((c) => c.text === "newton (N)")).toBe(true);
    }
  });

  it("uses the difficulty's choice count (2 / 3 / 5 / 7)", () => {
    const counts = [Difficulty.ONE, Difficulty.TWO, Difficulty.THREE, Difficulty.FOUR]
      .map((l) => buildChoices(MCQ, difficultyParams(l).choiceCount, new SeededRng(5)).choices.length);
    expect(counts).toEqual([2, 3, 5, 7]);
  });

  it("is deterministic for the same seed and varies the order across seeds", () => {
    const a = buildChoices(MCQ, 5, new SeededRng(7)).choices.map((c) => c.text);
    const b = buildChoices(MCQ, 5, new SeededRng(7)).choices.map((c) => c.text);
    expect(a).toEqual(b);
    const c = buildChoices(MCQ, 5, new SeededRng(99)).choices.map((x) => x.text);
    expect(a).not.toEqual(c); // different seed -> different order/selection
  });

  it("rejects too few distractors or a plain (non-MC) question", () => {
    expect(() => buildChoices(MCQ, 8, new SeededRng(1))).toThrow(/distractors/); // only 6 available
    const plain = validateQuestion({ id: "p", subject: Subject.MATEMATIKA, topic: "t", b: 0, tier: DifficultyTier.ALAP });
    expect(() => buildChoices(plain, 3, new SeededRng(1))).toThrow(/no multiple-choice/);
  });

  it("validateQuestion accepts and round-trips MC content", () => {
    const q = validateQuestion(MCQ);
    expect(q.correct).toBe("newton (N)");
    expect(q.distractors).toHaveLength(6);
    expect(() => validateQuestion({ ...MCQ, correct: "" })).toThrow(/correct/);
    expect(() => validateQuestion({ ...MCQ, distractors: ["ok", 3] })).toThrow(/distractors/);
  });
});
