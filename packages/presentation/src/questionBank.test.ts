import { describe, it, expect } from "vitest";
import {
  ALL_SUBJECTS,
  QuestionBank,
  RaschEstimator,
  SeededRng,
  buildChoices,
  Difficulty,
  DIFFICULTIES,
} from "@tudas-paradigmaja/core";
import { coreQuestionBank, questionsFor } from "./questionBank.js";

describe("coreQuestionBank (I50) — real multiple-choice content for all 9 subjects", () => {
  const items = coreQuestionBank();

  it("has unique ids and passes QuestionBank validation", () => {
    const ids = new Set(items.map((q) => q.id));
    expect(ids.size).toBe(items.length);
    expect(() => new QuestionBank(items)).not.toThrow();
  });

  it("covers every subject with at least six questions", () => {
    for (const s of ALL_SUBJECTS) {
      expect(questionsFor(s).length).toBeGreaterThanOrEqual(6);
      expect(items.filter((q) => q.subject === s).length).toBe(questionsFor(s).length);
    }
  });

  it("every question carries full MC content with six distractors", () => {
    for (const q of items) {
      expect(q.prompt).toBeTruthy();
      expect(q.correct).toBeTruthy();
      expect(q.distractors).toBeDefined();
      expect(q.distractors!.length).toBeGreaterThanOrEqual(6);
      // No accidental duplicate between the correct answer and its distractors.
      expect(q.distractors!.includes(q.correct!)).toBe(false);
      expect(new Set(q.distractors)).toHaveLength(q.distractors!.length);
    }
  });

  it("supports the hardest difficulty's 7-option questions for every item", () => {
    const rng = new SeededRng(1);
    for (const q of items) {
      const set = buildChoices(q, DIFFICULTIES[Difficulty.FOUR].choiceCount, rng);
      expect(set.choices).toHaveLength(7);
      expect(set.choices[set.correctIndex]!.text).toBe(q.correct);
    }
  });

  it("is selectable through the adaptive bank by theta, per subject", () => {
    const bank = new QuestionBank(items);
    const rasch = new RaschEstimator();
    for (const s of ALL_SUBJECTS) {
      const picked = bank.selectFor(s, rasch.thetaOf(s));
      expect(picked).not.toBeNull();
      expect(picked!.subject).toBe(s);
    }
  });

  it("difficulty tiers roughly separate by Rasch b within each subject", () => {
    for (const s of ALL_SUBJECTS) {
      const qs = questionsFor(s);
      const avg = (tier: string) => {
        const pool = qs.filter((q) => q.tier === tier);
        return pool.reduce((sum, q) => sum + q.b, 0) / pool.length;
      };
      expect(avg("ALAP")).toBeLessThan(avg("HALADO"));
      expect(avg("HALADO")).toBeLessThan(avg("SZAKERTO"));
    }
  });
});
