// RaschEstimator — adaptive ability estimate per subject (1-parameter IRT).
//
// MVP adaptivity (decision D-IRT): we use the Rasch / 1PL model, where each
// question has a single difficulty parameter `b` and the probability of a
// correct answer for a player of ability theta is the logistic
//   P(correct) = 1 / (1 + exp(b - theta)).
// After each answer we take one stochastic-gradient step
//   theta <- theta + lr * (score - P),
// which strictly increases theta on a correct answer and decreases it on a
// wrong one. The estimate is per subject (maths ability != history ability)
// and is independent of the strategic AI difficulty.
//
// Full 3PL IRT (discrimination `a`, guessing `c`) is deliberately deferred.

import { Subject, ALL_SUBJECTS } from "../economy/KKLedger.js";

export class RaschEstimator {
  private readonly theta = new Map<Subject, number>();
  private readonly learningRate: number;

  /**
   * @param initialTheta starting ability for every subject (default 0).
   * @param learningRate gradient step size in (0, 1] (default 0.5).
   */
  constructor(initialTheta = 0, learningRate = 0.5) {
    if (!Number.isFinite(initialTheta)) {
      throw new TypeError("initialTheta must be finite");
    }
    if (!(learningRate > 0) || learningRate > 1) {
      throw new RangeError("learningRate must be in (0, 1]");
    }
    this.learningRate = learningRate;
    for (const s of ALL_SUBJECTS) this.theta.set(s, initialTheta);
  }

  thetaOf(subject: Subject): number {
    const t = this.theta.get(subject);
    if (t === undefined) throw new TypeError(`Unknown subject: ${String(subject)}`);
    return t;
  }

  /** Probability that a player of `theta` answers a question of difficulty `b`. */
  static probabilityCorrect(theta: number, b: number): number {
    return 1 / (1 + Math.exp(b - theta));
  }

  /**
   * Update the subject's ability after one answer.
   * @param b question difficulty
   * @param correct whether the answer was correct
   * @returns the new theta for the subject
   */
  update(subject: Subject, b: number, correct: boolean): number {
    const theta = this.thetaOf(subject);
    if (!Number.isFinite(b)) throw new TypeError("b must be finite");
    const p = RaschEstimator.probabilityCorrect(theta, b);
    const score = correct ? 1 : 0;
    const next = theta + this.learningRate * (score - p);
    this.theta.set(subject, next);
    return next;
  }

  snapshot(): Record<Subject, number> {
    const out = {} as Record<Subject, number>;
    for (const s of ALL_SUBJECTS) out[s] = this.thetaOf(s);
    return out;
  }
}
