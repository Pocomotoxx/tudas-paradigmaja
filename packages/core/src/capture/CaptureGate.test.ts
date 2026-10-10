import { describe, it, expect } from "vitest";
import { Subject } from "../economy/KKLedger.js";
import { QuestionBank, DifficultyTier } from "../education/QuestionBank.js";
import { RaschEstimator } from "../education/RaschEstimator.js";
import { CaptureGate, CaptureStatus } from "./CaptureGate.js";

function bank(n = 6): QuestionBank {
  const items = [];
  for (let i = 0; i < n; i++) {
    items.push({ id: `m${i}`, subject: Subject.MATEMATIKA, topic: "t", b: i - 2, tier: DifficultyTier.ALAP });
  }
  return new QuestionBank(items);
}

function gate(opts: { windowMs?: number; required?: number; questions?: number; perQuestionMs?: number | null } = {}) {
  return new CaptureGate({
    targetId: "var",
    subject: Subject.MATEMATIKA,
    bank: bank(opts.questions ?? 6),
    rasch: new RaschEstimator(),
    windowMs: opts.windowMs ?? 10000,
    ...(opts.required !== undefined ? { requiredCorrect: opts.required } : {}),
    ...(opts.perQuestionMs !== undefined ? { perQuestionMs: opts.perQuestionMs } : {}),
  });
}

describe("CaptureGate — three-question timed capture (vision §11)", () => {
  it("captures after requiredCorrect correct answers within the window", () => {
    const g = gate();
    g.start(0);
    expect(g.submit(true, 100).correctCount).toBe(1);
    expect(g.submit(true, 200).correctCount).toBe(2);
    const r = g.submit(true, 300);
    expect(r.status).toBe(CaptureStatus.SUCCESS);
    expect(g.captured).toBe(true);
    expect(r.nextQuestion).toBeNull();
  });

  it("times out when the window elapses; a late answer is discarded", () => {
    const g = gate({ windowMs: 1000 });
    g.start(0);
    g.submit(true, 500); // count 1, still in window
    const r = g.submit(true, 2000); // past deadline
    expect(r.status).toBe(CaptureStatus.TIMED_OUT);
    expect(r.correctCount).toBe(1); // the late correct answer did not count
    expect(g.captured).toBe(false);
  });

  it("poll resolves a timeout without answering", () => {
    const g = gate({ windowMs: 1000 });
    g.start(0);
    expect(g.poll(500)).toBe(CaptureStatus.PENDING);
    expect(g.poll(1500)).toBe(CaptureStatus.TIMED_OUT);
  });

  it("wrong answers do not capture but the attempt continues within time", () => {
    const g = gate({ required: 2 });
    g.start(0);
    expect(g.submit(false, 100).correctCount).toBe(0);
    expect(g.submit(true, 200).correctCount).toBe(1);
    expect(g.submit(true, 300).status).toBe(CaptureStatus.SUCCESS);
  });

  it("remainingMs counts down from the window", () => {
    const g = gate({ windowMs: 5000 });
    g.start(1000);
    expect(g.remainingMs(1000)).toBe(5000);
    expect(g.remainingMs(3000)).toBe(3000);
    expect(g.remainingMs(9000)).toBe(0);
  });

  it("times out if the bank runs out before success", () => {
    const g = gate({ required: 3, questions: 2 });
    g.start(0);
    g.submit(true, 10); // count 1
    const r = g.submit(true, 20); // count 2, but no more questions to draw
    expect(r.status).toBe(CaptureStatus.TIMED_OUT);
    expect(r.correctCount).toBe(2);
  });

  it("draws adaptively without repeating a question", () => {
    const g = gate();
    const q1 = g.start(0);
    const r1 = g.submit(false, 10);
    const r2 = g.submit(false, 20);
    const ids = [q1.id, r1.nextQuestion!.id, r2.nextQuestion!.id];
    expect(new Set(ids).size).toBe(3);
  });

  // Negative / safety tests.
  it("rejects invalid construction", () => {
    expect(() => new CaptureGate({ targetId: "", subject: Subject.MATEMATIKA, bank: bank(), rasch: new RaschEstimator(), windowMs: 1000 })).toThrow(TypeError);
    expect(() => new CaptureGate({ targetId: "x", subject: Subject.MATEMATIKA, bank: bank(), rasch: new RaschEstimator(), windowMs: 0 })).toThrow(TypeError);
    expect(() => new CaptureGate({ targetId: "x", subject: Subject.MATEMATIKA, bank: bank(), rasch: new RaschEstimator(), windowMs: 1000, requiredCorrect: 0 })).toThrow(TypeError);
  });

  it("rejects start twice, submit before start, and resolved submit", () => {
    const g = gate();
    expect(() => g.submit(true, 0)).toThrow();
    g.start(0);
    expect(() => g.start(1)).toThrow();
    g.submit(true, 1);
    g.submit(true, 2);
    g.submit(true, 3); // success
    expect(() => g.submit(true, 4)).toThrow();
  });

  it("rejects time moving backwards", () => {
    const g = gate();
    g.start(100);
    expect(() => g.submit(true, 50)).toThrow(RangeError);
  });

  it("is fully untimed with windowMs: Infinity and no perQuestionMs", () => {
    const g = gate({ windowMs: Infinity });
    expect(g.isUntimed).toBe(true);
    g.start(0);
    expect(g.remainingMs(999_999_999)).toBe(Infinity);
    expect(g.questionRemainingMs(999_999_999)).toBe(Infinity);
    expect(g.submit(true, 999_999_999).correctCount).toBe(1); // never expires
    expect(g.poll(10 ** 15)).toBe(CaptureStatus.PENDING);
  });

  it("perQuestionMs times out the CURRENT question even when windowMs is infinite", () => {
    const g = gate({ windowMs: Infinity, perQuestionMs: 1000 });
    expect(g.isUntimed).toBe(false);
    g.start(0);
    expect(g.submit(true, 500).correctCount).toBe(1); // within the 1s per-question limit
    const r = g.submit(true, 1600); // 2nd question drawn at t=500, deadline 1500
    expect(r.status).toBe(CaptureStatus.TIMED_OUT);
    expect(r.correctCount).toBe(1);
  });

  it("perQuestionMs resets on every new question", () => {
    const g = gate({ windowMs: Infinity, perQuestionMs: 1000, required: 3 });
    g.start(0);
    g.submit(true, 900); // 1/3, next question deadline = 900 + 1000 = 1900
    expect(g.questionRemainingMs(1800)).toBe(100);
    expect(g.submit(true, 1800).correctCount).toBe(2); // still within the fresh deadline
  });

  it("abandon() ends a PENDING attempt with no success and no further moves", () => {
    const g = gate();
    g.start(0);
    g.submit(true, 10); // 1/3
    const r = g.abandon(20);
    expect(r.status).toBe(CaptureStatus.ABANDONED);
    expect(g.captured).toBe(false);
    expect(() => g.submit(true, 30)).toThrow();
    expect(() => g.abandon(40)).toThrow(); // already resolved
  });

  it("start throws when no question exists for the subject", () => {
    const g = new CaptureGate({
      targetId: "x",
      subject: Subject.BIOLOGIA, // bank only has MATEMATIKA
      bank: bank(),
      rasch: new RaschEstimator(),
      windowMs: 1000,
    });
    expect(() => g.start(0)).toThrow(RangeError);
  });
});
