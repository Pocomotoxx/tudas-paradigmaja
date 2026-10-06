import { describe, it, expect } from "vitest";
import { QuestionBank, DifficultyTier, validateQuestion } from "./QuestionBank.js";
import { Subject } from "../economy/KKLedger.js";

const q = (id: string, b: number, subject = Subject.MATEMATIKA) => ({
  id,
  subject,
  topic: "t",
  b,
  tier: DifficultyTier.ALAP,
});

describe("QuestionBank — data-driven pool + adaptive selection", () => {
  it("counts questions per subject", () => {
    const bank = new QuestionBank([q("a", 0), q("b", 1), q("h", 0, Subject.TORTENELEM)]);
    expect(bank.countFor(Subject.MATEMATIKA)).toBe(2);
    expect(bank.countFor(Subject.TORTENELEM)).toBe(1);
    expect(bank.countFor(Subject.BIOLOGIA)).toBe(0);
  });

  it("selects the question closest in difficulty to theta", () => {
    const bank = new QuestionBank([q("easy", -2), q("mid", 0), q("hard", 2)]);
    expect(bank.selectFor(Subject.MATEMATIKA, 0.1)!.id).toBe("mid");
    expect(bank.selectFor(Subject.MATEMATIKA, 1.9)!.id).toBe("hard");
    expect(bank.selectFor(Subject.MATEMATIKA, -3)!.id).toBe("easy");
  });

  it("breaks ties deterministically by id", () => {
    const bank = new QuestionBank([q("zeta", 1), q("alpha", -1)]);
    // theta=0 is equidistant; ascending id wins.
    expect(bank.selectFor(Subject.MATEMATIKA, 0)!.id).toBe("alpha");
  });

  it("excludes used ids and returns null when exhausted", () => {
    const bank = new QuestionBank([q("a", 0)]);
    expect(bank.selectFor(Subject.MATEMATIKA, 0, new Set(["a"]))).toBeNull();
  });

  // Negative / safety tests: malformed records are rejected (not silently kept).
  it("rejects malformed question records", () => {
    expect(() => validateQuestion({ id: "", subject: Subject.MATEMATIKA, topic: "t", b: 0, tier: DifficultyTier.ALAP })).toThrow(TypeError);
    expect(() => validateQuestion({ id: "x", subject: "NOPE", topic: "t", b: 0, tier: DifficultyTier.ALAP })).toThrow(TypeError);
    expect(() => validateQuestion({ id: "x", subject: Subject.MATEMATIKA, topic: "t", b: NaN, tier: DifficultyTier.ALAP })).toThrow(TypeError);
    expect(() => validateQuestion({ id: "x", subject: Subject.MATEMATIKA, topic: "t", b: 0, tier: "???" })).toThrow(TypeError);
  });

  it("rejects duplicate ids in the bank", () => {
    expect(() => new QuestionBank([q("dup", 0), q("dup", 1)])).toThrow(TypeError);
  });
});
