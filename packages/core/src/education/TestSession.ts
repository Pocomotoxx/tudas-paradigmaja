// TestSession — orchestrates one academic-phase testing flow.
//
// Ties together the flow guard, the async token economy, the per-subject KK
// reward, the adaptive estimator, and the question bank, enforcing the design
// rules:
//   - a test may be started ONLY in the ACADEMIC phase (flow protection, AC4);
//   - each subject allows ONE test window per turn (G3, AC6) — once resolved,
//     that subject is exhausted until the next turn;
//   - starting a test spends test tokens (async economy);
//   - a correct answer earns subject KK by tier; a wrong answer earns nothing
//     and never deducts existing points (no-frustration rule, AC5);
//   - the player's ability estimate updates on every answer (AC7).

import { PhaseMachine, PhaseError } from "../phase/GamePhase.js";
import { TokenLedger } from "../economy/TokenLedger.js";
import { KKLedger, Subject } from "../economy/KKLedger.js";
import { RaschEstimator } from "./RaschEstimator.js";
import { QuestionBank, DifficultyTier, type QuestionItem } from "./QuestionBank.js";

export const DEFAULT_TIER_REWARD: Readonly<Record<DifficultyTier, number>> = {
  [DifficultyTier.ALAP]: 1,
  [DifficultyTier.HALADO]: 2,
  [DifficultyTier.SZAKERTO]: 3,
};

export interface TestResult {
  readonly question: QuestionItem;
  readonly correct: boolean;
  readonly kkEarned: number;
  readonly newTheta: number;
}

interface Deps {
  readonly phase: PhaseMachine;
  readonly tokens: TokenLedger;
  readonly kk: KKLedger;
  readonly rasch: RaschEstimator;
  readonly bank: QuestionBank;
  readonly tokenCostPerTest?: number;
  readonly tierReward?: Readonly<Record<DifficultyTier, number>>;
}

export class TestSession {
  private readonly phase: PhaseMachine;
  private readonly tokens: TokenLedger;
  private readonly kk: KKLedger;
  private readonly rasch: RaschEstimator;
  private readonly bank: QuestionBank;
  private readonly tokenCostPerTest: number;
  private readonly tierReward: Readonly<Record<DifficultyTier, number>>;

  private readonly usedBySubject = new Map<Subject, Set<string>>();
  private exhaustedThisTurn = new Set<Subject>();
  private open: QuestionItem | null = null;

  constructor(deps: Deps) {
    this.phase = deps.phase;
    this.tokens = deps.tokens;
    this.kk = deps.kk;
    this.rasch = deps.rasch;
    this.bank = deps.bank;
    this.tokenCostPerTest = deps.tokenCostPerTest ?? 1;
    this.tierReward = deps.tierReward ?? DEFAULT_TIER_REWARD;
    if (!Number.isInteger(this.tokenCostPerTest) || this.tokenCostPerTest < 0) {
      throw new TypeError("tokenCostPerTest must be a non-negative integer");
    }
  }

  isSubjectExhausted(subject: Subject): boolean {
    return this.exhaustedThisTurn.has(subject);
  }

  get hasOpenQuestion(): boolean {
    return this.open !== null;
  }

  /**
   * Open a test window for `subject`: validates phase (AC4) and the G3
   * per-turn window (AC6), spends tokens, and returns the adaptively selected
   * question. Throws on any violation.
   */
  startTest(subject: Subject): QuestionItem {
    this.phase.assertCanStartTest(); // AC4
    if (this.open !== null) {
      throw new PhaseError("A test is already open; resolve it first");
    }
    if (this.exhaustedThisTurn.has(subject)) {
      throw new PhaseError(`Subject ${subject} already tested this turn (G3)`); // AC6
    }
    const used = this.usedBySubject.get(subject) ?? new Set<string>();
    const question = this.bank.selectFor(subject, this.rasch.thetaOf(subject), used);
    if (question === null) {
      throw new RangeError(`No remaining question for subject ${subject}`);
    }
    this.tokens.spend(this.tokenCostPerTest); // async economy
    this.open = question;
    return question;
  }

  /**
   * Resolve the open test with the caller-judged correctness. Updates ability,
   * awards KK on success (none on failure, no deduction), and exhausts the
   * subject for this turn.
   */
  resolve(correct: boolean): TestResult {
    const question = this.open;
    if (question === null) {
      throw new PhaseError("No open test to resolve");
    }
    const newTheta = this.rasch.update(question.subject, question.b, correct); // AC7
    let kkEarned = 0;
    if (correct) {
      kkEarned = this.tierReward[question.tier];
      this.kk.earn(question.subject, kkEarned); // AC5 (pass -> KK)
    }
    // AC5: a wrong answer deducts nothing.
    const used = this.usedBySubject.get(question.subject) ?? new Set<string>();
    used.add(question.id);
    this.usedBySubject.set(question.subject, used);
    this.exhaustedThisTurn.add(question.subject);
    this.open = null;
    return { question, correct, kkEarned, newTheta };
  }

  /** Begin a new turn: clears per-turn subject exhaustion (reopens windows). */
  newTurn(): void {
    if (this.open !== null) {
      throw new PhaseError("Cannot advance turn while a test is open");
    }
    this.exhaustedThisTurn = new Set<Subject>();
  }
}
