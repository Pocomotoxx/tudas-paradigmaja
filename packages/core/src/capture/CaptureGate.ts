// CaptureGate — the three-question, time-windowed acquisition gate (vision §11).
//
// Acquiring an objective (territory, center, unit, artifact) is not automatic:
// the player must answer `requiredCorrect` questions (default 3) correctly
// WITHIN a time window. Succeed in time -> control granted; the window expires
// first -> not granted (no retroactive penalty; the player may retry later).
//
// Determinism: the core never reads a real clock. Time is an INJECTED value
// (`nowMs`) supplied by the caller/presentation on every operation, so the gate
// is fully reproducible and testable. Questions are drawn adaptively from the
// bank by the player's ability (theta), without repeats within the attempt.

import type { QuestionBank, QuestionItem } from "../education/QuestionBank.js";
import type { RaschEstimator } from "../education/RaschEstimator.js";
import type { Subject } from "../economy/KKLedger.js";

export enum CaptureStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  TIMED_OUT = "TIMED_OUT",
}

export interface CaptureInit {
  readonly targetId: string;
  readonly subject: Subject;
  readonly bank: QuestionBank;
  readonly rasch: RaschEstimator;
  /** Window length in milliseconds (positive integer). */
  readonly windowMs: number;
  /** Correct answers required to capture. Default 3. */
  readonly requiredCorrect?: number;
}

export interface CaptureSubmitResult {
  readonly status: CaptureStatus;
  readonly correctCount: number;
  /** Next question to answer while PENDING, else null. */
  readonly nextQuestion: QuestionItem | null;
}

export class CaptureGate {
  readonly targetId: string;
  readonly subject: Subject;
  readonly windowMs: number;
  readonly requiredCorrect: number;
  private readonly bank: QuestionBank;
  private readonly rasch: RaschEstimator;
  private readonly used = new Set<string>();

  private statusValue: CaptureStatus = CaptureStatus.PENDING;
  private startedAt: number | null = null;
  private lastNow = 0;
  private correct = 0;
  private current: QuestionItem | null = null;

  constructor(init: CaptureInit) {
    if (typeof init.targetId !== "string" || init.targetId.length === 0) {
      throw new TypeError("CaptureGate.targetId must be a non-empty string");
    }
    if (!Number.isInteger(init.windowMs) || init.windowMs < 1) {
      throw new TypeError("windowMs must be a positive integer");
    }
    const req = init.requiredCorrect ?? 3;
    if (!Number.isInteger(req) || req < 1) {
      throw new TypeError("requiredCorrect must be a positive integer");
    }
    this.targetId = init.targetId;
    this.subject = init.subject;
    this.windowMs = init.windowMs;
    this.requiredCorrect = req;
    this.bank = init.bank;
    this.rasch = init.rasch;
  }

  get status(): CaptureStatus { return this.statusValue; }
  get correctCount(): number { return this.correct; }
  get currentQuestion(): QuestionItem | null { return this.current; }
  get captured(): boolean { return this.statusValue === CaptureStatus.SUCCESS; }

  /** Milliseconds left in the window at `nowMs` (0 once started and expired). */
  remainingMs(nowMs: number): number {
    if (this.startedAt === null) return this.windowMs;
    return Math.max(0, this.windowMs - (nowMs - this.startedAt));
  }

  /** Begin the attempt at `nowMs`; draws the first question. */
  start(nowMs: number): QuestionItem {
    this.assertNow(nowMs);
    if (this.startedAt !== null) throw new Error("CaptureGate already started");
    this.startedAt = nowMs;
    this.lastNow = nowMs;
    const q = this.draw();
    if (q === null) throw new RangeError(`No question available for subject ${this.subject}`);
    this.current = q;
    return q;
  }

  /**
   * Submit an answer to the current question at `nowMs`. If the window has
   * expired the answer is discarded and the gate times out. Otherwise the
   * answer updates ability; a correct one advances the count (success at
   * requiredCorrect), a wrong one draws the next question. Draws also stop the
   * attempt (TIMED_OUT) if the bank runs out before success.
   */
  submit(correct: boolean, nowMs: number): CaptureSubmitResult {
    this.assertNow(nowMs);
    if (this.statusValue !== CaptureStatus.PENDING) {
      throw new Error(`CaptureGate is resolved (${this.statusValue})`);
    }
    if (this.startedAt === null) throw new Error("CaptureGate not started");
    if (this.current === null) throw new Error("No current question to answer");

    if (this.remainingMs(nowMs) <= 0) {
      this.statusValue = CaptureStatus.TIMED_OUT;
      this.current = null;
      return this.result();
    }

    this.rasch.update(this.subject, this.current.b, correct);
    this.used.add(this.current.id);
    if (correct) {
      this.correct++;
      if (this.correct >= this.requiredCorrect) {
        this.statusValue = CaptureStatus.SUCCESS;
        this.current = null;
        return this.result();
      }
    }
    const next = this.draw();
    if (next === null) {
      // Out of questions before success and still within time: cannot continue.
      this.statusValue = CaptureStatus.TIMED_OUT;
      this.current = null;
      return this.result();
    }
    this.current = next;
    return this.result();
  }

  /** Resolve a timeout without answering (e.g. the window elapsed while idle). */
  poll(nowMs: number): CaptureStatus {
    this.assertNow(nowMs);
    if (this.statusValue === CaptureStatus.PENDING && this.startedAt !== null && this.remainingMs(nowMs) <= 0) {
      this.statusValue = CaptureStatus.TIMED_OUT;
      this.current = null;
    }
    return this.statusValue;
  }

  private draw(): QuestionItem | null {
    return this.bank.selectFor(this.subject, this.rasch.thetaOf(this.subject), this.used);
  }

  private result(): CaptureSubmitResult {
    return { status: this.statusValue, correctCount: this.correct, nextQuestion: this.current };
  }

  private assertNow(nowMs: number): void {
    if (!Number.isFinite(nowMs)) throw new TypeError("nowMs must be finite");
    if (nowMs < this.lastNow) throw new RangeError("nowMs must not move backwards");
    this.lastNow = nowMs;
  }
}
