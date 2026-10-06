import { describe, it, expect } from "vitest";
import { PhaseMachine, GamePhase, PhaseError } from "../phase/GamePhase.js";
import { TokenLedger } from "../economy/TokenLedger.js";
import { KKLedger, Subject } from "../economy/KKLedger.js";
import { RaschEstimator } from "./RaschEstimator.js";
import { QuestionBank, DifficultyTier } from "./QuestionBank.js";
import { TestSession } from "./TestSession.js";

const MATHS = Subject.MATEMATIKA;

function makeSession(opts?: { tokens?: number; phase?: GamePhase }) {
  const phase = new PhaseMachine(opts?.phase ?? GamePhase.ACADEMIC);
  const tokens = new TokenLedger(10, opts?.tokens ?? 5);
  const kk = new KKLedger();
  const rasch = new RaschEstimator();
  const bank = new QuestionBank([
    { id: "m1", subject: MATHS, topic: "algebra", b: 0, tier: DifficultyTier.ALAP },
    { id: "m2", subject: MATHS, topic: "algebra", b: 1, tier: DifficultyTier.HALADO },
    { id: "m3", subject: MATHS, topic: "algebra", b: 2, tier: DifficultyTier.SZAKERTO },
  ]);
  const session = new TestSession({ phase, tokens, kk, rasch, bank });
  return { phase, tokens, kk, rasch, bank, session };
}

describe("TestSession — education flow (I3 AC4-AC7, G3)", () => {
  it("a correct answer earns subject KK by tier; theta rises (AC5, AC7)", () => {
    const { session, kk, rasch } = makeSession();
    const before = rasch.thetaOf(MATHS);
    session.startTest(MATHS); // selects m1 (b=0, ALAP, reward 1)
    const res = session.resolve(true);
    expect(res.correct).toBe(true);
    expect(res.kkEarned).toBe(1);
    expect(kk.balanceOf(MATHS)).toBe(1);
    expect(rasch.thetaOf(MATHS)).toBeGreaterThan(before);
  });

  it("a wrong answer earns nothing and deducts nothing (AC5)", () => {
    const { session, kk } = makeSession();
    kk.earn(MATHS, 5); // existing points
    session.startTest(MATHS);
    const res = session.resolve(false);
    expect(res.kkEarned).toBe(0);
    expect(kk.balanceOf(MATHS)).toBe(5); // unchanged, no deduction
  });

  it("spends a token per test (async economy)", () => {
    const { session, tokens } = makeSession({ tokens: 2 });
    session.startTest(MATHS);
    session.resolve(true);
    expect(tokens.balance).toBe(1);
  });

  // Core negative test (AC4): no test outside ACADEMIC.
  it("rejects starting a test in TACTICAL phase (AC4)", () => {
    const { session } = makeSession({ phase: GamePhase.TACTICAL });
    expect(() => session.startTest(MATHS)).toThrow(PhaseError);
  });

  // Core negative test (G3/AC6): one window per subject per turn.
  it("rejects a second test in the same subject in one turn (G3/AC6)", () => {
    const { session } = makeSession();
    session.startTest(MATHS);
    session.resolve(true);
    expect(session.isSubjectExhausted(MATHS)).toBe(true);
    expect(() => session.startTest(MATHS)).toThrow(PhaseError);
  });

  it("reopens the subject window after newTurn", () => {
    const { session } = makeSession();
    session.startTest(MATHS);
    session.resolve(true);
    session.newTurn();
    expect(session.isSubjectExhausted(MATHS)).toBe(false);
    expect(() => session.startTest(MATHS)).not.toThrow();
  });

  it("does not repeat a question already used", () => {
    const { session } = makeSession();
    const first = session.startTest(MATHS);
    session.resolve(true);
    session.newTurn();
    const second = session.startTest(MATHS);
    expect(second.id).not.toBe(first.id);
  });

  it("rejects starting a test with insufficient tokens", () => {
    const { session } = makeSession({ tokens: 0 });
    expect(() => session.startTest(MATHS)).toThrow(RangeError);
  });

  it("rejects resolving when no test is open", () => {
    const { session } = makeSession();
    expect(() => session.resolve(true)).toThrow(PhaseError);
  });

  it("rejects opening a second test before resolving the first", () => {
    const { session } = makeSession();
    session.startTest(MATHS);
    expect(() => session.startTest(MATHS)).toThrow(PhaseError);
  });
});
