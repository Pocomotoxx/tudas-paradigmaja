// SubjectUnrest — the levels 3–4 cascade: repeatedly wrong answers in a subject
// raise unrest across all regions of that subject and make that subject's units
// desert at a growing rate.
//
// Model: each subject keeps a `wrong` counter. Wrong answers beyond a threshold
// raise the subject's unrest by one step each; correct answers cool it down.
// The desertion chance grows with unrest (növekvő százalék). When the cascade is
// disabled (difficulty 1–2) every operation is a no-op and unrest stays 0.
//
// Determinism: desertions are rolled from the shared seeded RNG.

import type { Rng } from "../rng/SeededRng.js";
import { ALL_SUBJECTS, type Subject } from "../economy/KKLedger.js";

export interface SubjectUnrestConfig {
  /** Whether the cascade is active (difficulty 3–4). */
  readonly enabled: boolean;
  /** Wrong answers in a subject before unrest starts rising. Default 3. */
  readonly wrongThreshold?: number;
  /** Unrest gained per wrong answer past the threshold. Default 1. */
  readonly unrestStep?: number;
  /** Unrest removed per correct answer. Default 1. */
  readonly coolStep?: number;
  /** Maximum unrest per subject. Default 10. */
  readonly maxUnrest?: number;
  /** Desertion chance added per unrest point (0..1). Default 0.08. */
  readonly desertionPerUnrest?: number;
}

export type SubjectUnrestSnapshot = Readonly<Record<string, { wrong: number; unrest: number }>>;

export class SubjectUnrest {
  private readonly enabled: boolean;
  private readonly wrongThreshold: number;
  private readonly unrestStep: number;
  private readonly coolStep: number;
  private readonly maxUnrest: number;
  private readonly desertionPerUnrest: number;

  private readonly wrong = new Map<Subject, number>();
  private readonly unrest = new Map<Subject, number>();

  constructor(cfg: SubjectUnrestConfig) {
    this.enabled = cfg.enabled;
    this.wrongThreshold = cfg.wrongThreshold ?? 3;
    this.unrestStep = cfg.unrestStep ?? 1;
    this.coolStep = cfg.coolStep ?? 1;
    this.maxUnrest = cfg.maxUnrest ?? 10;
    this.desertionPerUnrest = cfg.desertionPerUnrest ?? 0.08;
  }

  get isEnabled(): boolean { return this.enabled; }

  /** Record one answer in a subject. No-op when the cascade is disabled. */
  recordAnswer(subject: Subject, correct: boolean): void {
    if (!this.enabled) return;
    if (correct) {
      // A correct answer cools unrest and chips away at the wrong counter.
      this.unrest.set(subject, Math.max(0, this.unrestOf(subject) - this.coolStep));
      this.wrong.set(subject, Math.max(0, (this.wrong.get(subject) ?? 0) - 1));
      return;
    }
    const w = (this.wrong.get(subject) ?? 0) + 1;
    this.wrong.set(subject, w);
    if (w > this.wrongThreshold) {
      this.unrest.set(subject, Math.min(this.maxUnrest, this.unrestOf(subject) + this.unrestStep));
    }
  }

  unrestOf(subject: Subject): number {
    return this.unrest.get(subject) ?? 0;
  }

  /** Probability in [0,1] that one of this subject's units deserts this turn. */
  desertionChance(subject: Subject): number {
    return Math.min(1, this.unrestOf(subject) * this.desertionPerUnrest);
  }

  /** Subjects currently under unrest (> 0), sorted for determinism. */
  unrestfulSubjects(): Subject[] {
    return ALL_SUBJECTS.filter((s) => this.unrestOf(s) > 0);
  }

  /**
   * Roll how many of `unitCount` units of a subject desert this turn, each
   * independently with desertionChance(subject). Deterministic via the RNG.
   */
  rollDesertions(subject: Subject, unitCount: number, rng: Rng): number {
    const p = this.desertionChance(subject);
    if (p <= 0 || unitCount <= 0) return 0;
    let deserters = 0;
    for (let i = 0; i < unitCount; i++) if (rng.nextFloat() < p) deserters++;
    return deserters;
  }

  snapshot(): SubjectUnrestSnapshot {
    const out: Record<string, { wrong: number; unrest: number }> = {};
    for (const s of ALL_SUBJECTS) {
      const w = this.wrong.get(s) ?? 0, u = this.unrest.get(s) ?? 0;
      if (w > 0 || u > 0) out[s] = { wrong: w, unrest: u };
    }
    return out;
  }

  restore(snap: SubjectUnrestSnapshot): this {
    this.wrong.clear();
    this.unrest.clear();
    for (const [s, v] of Object.entries(snap)) {
      this.wrong.set(s as Subject, v.wrong);
      this.unrest.set(s as Subject, v.unrest);
    }
    return this;
  }
}
