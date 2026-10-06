import { describe, it, expect } from "vitest";
import { RaschEstimator } from "./RaschEstimator.js";
import { Subject } from "../economy/KKLedger.js";

describe("RaschEstimator — adaptive ability (I3 AC7)", () => {
  it("probabilityCorrect is 0.5 when theta equals b", () => {
    expect(RaschEstimator.probabilityCorrect(0, 0)).toBeCloseTo(0.5, 10);
    expect(RaschEstimator.probabilityCorrect(2, 2)).toBeCloseTo(0.5, 10);
  });

  it("theta increases monotonically on a correct streak (AC7)", () => {
    const est = new RaschEstimator();
    let prev = est.thetaOf(Subject.MATEMATIKA);
    for (let i = 0; i < 10; i++) {
      const next = est.update(Subject.MATEMATIKA, 0, true);
      expect(next).toBeGreaterThan(prev);
      prev = next;
    }
  });

  it("theta decreases on a wrong answer", () => {
    const est = new RaschEstimator();
    const after = est.update(Subject.BIOLOGIA, 0, false);
    expect(after).toBeLessThan(0);
  });

  it("is deterministic for the same answer sequence", () => {
    const a = new RaschEstimator();
    const b = new RaschEstimator();
    const answers = [true, false, true, true, false];
    for (const c of answers) {
      a.update(Subject.FIZIKA_KEMIA, 0.3, c);
      b.update(Subject.FIZIKA_KEMIA, 0.3, c);
    }
    expect(a.thetaOf(Subject.FIZIKA_KEMIA)).toBe(b.thetaOf(Subject.FIZIKA_KEMIA));
  });

  it("tracks subjects independently", () => {
    const est = new RaschEstimator();
    est.update(Subject.MATEMATIKA, 0, true);
    expect(est.thetaOf(Subject.MATEMATIKA)).toBeGreaterThan(0);
    expect(est.thetaOf(Subject.TORTENELEM)).toBe(0);
  });

  // Negative / safety tests.
  it("rejects an out-of-range learning rate", () => {
    expect(() => new RaschEstimator(0, 0)).toThrow(RangeError);
    expect(() => new RaschEstimator(0, 1.5)).toThrow(RangeError);
  });
});
