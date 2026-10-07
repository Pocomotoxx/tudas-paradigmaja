// KnowledgeCenter — a held location that must be sustained by correct answers.
//
// Economic model (see docs/design/economy-model-v0.1-DRAFT.md): knowledge is the
// economy. A center has a `stability` (0..max). Periodic maintenance checks ask
// a subject question; a correct answer raises stability, a wrong one lowers it.
//
// E1 (stepped output): token/supply output is a stepped function of stability in
//     three bands (LOW / MID / HIGH), zero while rebelled.
// E2 (stability-dependent cadence): the lower the stability band, the more often
//     the center demands a maintenance check.
// E3 (recoverable rebellion with hysteresis): stability 0 -> rebelled; output is
//     cut, but the player keeps already-produced units (no retroactive loss).
//     Answering correctly restores stability; once it climbs back to the
//     recovery threshold the center stops rebelling and output resumes. The
//     threshold is above the rebellion point, so output does not flicker.
//
// Deterministic and serializable (save/load): all transitions are pure given the
// inputs; toSnapshot/fromSnapshot round-trip the full state.

import { Subject, ALL_SUBJECTS } from "../economy/KKLedger.js";

export enum StabilityBand {
  REBELLED = "REBELLED",
  LOW = "LOW",
  MID = "MID",
  HIGH = "HIGH",
}

export interface KnowledgeCenterConfig {
  /** Maximum stability (positive integer). Default 100. */
  readonly maxStability?: number;
  /** Stability gained per correct answer. Default 20. */
  readonly gainPerCorrect?: number;
  /** Stability lost per wrong answer. Default 25. */
  readonly lossPerWrong?: number;
  /** Stability (inclusive) at/above which a rebelled center recovers. Default 34 (MID). */
  readonly recoveryThreshold?: number;
}

export interface KnowledgeCenterInit {
  readonly id: string;
  readonly subject: Subject;
  /** Starting stability. Default = maxStability. */
  readonly stability?: number;
  readonly config?: KnowledgeCenterConfig;
}

export interface KnowledgeCenterSnapshot {
  readonly id: string;
  readonly subject: Subject;
  readonly stability: number;
  readonly rebelled: boolean;
  readonly lastCheckedTurn: number;
  readonly maxStability: number;
  readonly gainPerCorrect: number;
  readonly lossPerWrong: number;
  readonly recoveryThreshold: number;
}

// Band thresholds as fractions of maxStability.
const MID_FRACTION = 0.34;
const HIGH_FRACTION = 0.67;

// Stepped output (E1) and check cadence in turns (E2) per band.
const BAND_TOKEN_OUTPUT: Readonly<Record<StabilityBand, number>> = {
  [StabilityBand.REBELLED]: 0,
  [StabilityBand.LOW]: 1,
  [StabilityBand.MID]: 2,
  [StabilityBand.HIGH]: 3,
};
const BAND_CHECK_INTERVAL: Readonly<Record<StabilityBand, number>> = {
  [StabilityBand.REBELLED]: 1,
  [StabilityBand.LOW]: 1,
  [StabilityBand.MID]: 2,
  [StabilityBand.HIGH]: 3,
};

export class KnowledgeCenter {
  readonly id: string;
  readonly subject: Subject;
  readonly maxStability: number;
  private readonly gainPerCorrect: number;
  private readonly lossPerWrong: number;
  private readonly recoveryThreshold: number;

  private stabilityValue: number;
  private rebelledFlag = false;
  private lastCheckedTurn = 0;

  constructor(init: KnowledgeCenterInit) {
    if (typeof init.id !== "string" || init.id.length === 0) {
      throw new TypeError("KnowledgeCenter.id must be a non-empty string");
    }
    if (!ALL_SUBJECTS.includes(init.subject)) {
      throw new TypeError(`KnowledgeCenter.subject invalid: ${String(init.subject)}`);
    }
    this.id = init.id;
    this.subject = init.subject;
    const cfg = init.config ?? {};
    this.maxStability = cfg.maxStability ?? 100;
    this.gainPerCorrect = cfg.gainPerCorrect ?? 20;
    this.lossPerWrong = cfg.lossPerWrong ?? 25;
    this.recoveryThreshold = cfg.recoveryThreshold ?? Math.ceil(this.maxStability * MID_FRACTION);
    this.assertConfig();
    const start = init.stability ?? this.maxStability;
    if (!Number.isInteger(start) || start < 0 || start > this.maxStability) {
      throw new RangeError(`stability must be an integer in [0, ${this.maxStability}]`);
    }
    this.stabilityValue = start;
    this.rebelledFlag = start === 0;
  }

  private assertConfig(): void {
    if (!Number.isInteger(this.maxStability) || this.maxStability < 1) {
      throw new TypeError("maxStability must be a positive integer");
    }
    for (const [k, v] of [["gainPerCorrect", this.gainPerCorrect], ["lossPerWrong", this.lossPerWrong]] as const) {
      if (!Number.isInteger(v) || v < 1) throw new TypeError(`${k} must be a positive integer`);
    }
    if (
      !Number.isInteger(this.recoveryThreshold) ||
      this.recoveryThreshold < 1 ||
      this.recoveryThreshold > this.maxStability
    ) {
      throw new RangeError(`recoveryThreshold must be an integer in [1, ${this.maxStability}]`);
    }
  }

  get stability(): number {
    return this.stabilityValue;
  }

  get rebelled(): boolean {
    return this.rebelledFlag;
  }

  /** The band from current stability (REBELLED overrides band while the flag is set). */
  band(): StabilityBand {
    if (this.rebelledFlag) return StabilityBand.REBELLED;
    const frac = this.stabilityValue / this.maxStability;
    if (frac >= HIGH_FRACTION) return StabilityBand.HIGH;
    if (frac >= MID_FRACTION) return StabilityBand.MID;
    return StabilityBand.LOW;
  }

  /** Stepped token output for this turn (E1); 0 while rebelled. */
  tokenOutput(): number {
    return BAND_TOKEN_OUTPUT[this.band()];
  }

  /** How many turns between maintenance checks at the current band (E2). */
  checkInterval(): number {
    return BAND_CHECK_INTERVAL[this.band()];
  }

  /** Whether a maintenance check is due at `turn`, given the last check. */
  isCheckDue(turn: number): boolean {
    if (!Number.isInteger(turn) || turn < 0) {
      throw new RangeError("turn must be a non-negative integer");
    }
    return turn - this.lastCheckedTurn >= this.checkInterval();
  }

  /**
   * Apply a maintenance-check answer at `turn`. Correct raises stability, wrong
   * lowers it (clamped). Sets/clears the rebellion flag with hysteresis (E3):
   * stability 0 -> rebelled; recovery only once stability >= recoveryThreshold.
   * Records the turn as the last check.
   */
  answer(correct: boolean, turn: number): void {
    if (!Number.isInteger(turn) || turn < 0) {
      throw new RangeError("turn must be a non-negative integer");
    }
    const delta = correct ? this.gainPerCorrect : -this.lossPerWrong;
    this.stabilityValue = Math.max(0, Math.min(this.maxStability, this.stabilityValue + delta));
    if (this.stabilityValue === 0) {
      this.rebelledFlag = true;
    } else if (this.rebelledFlag && this.stabilityValue >= this.recoveryThreshold) {
      this.rebelledFlag = false; // recovered (hysteresis: must climb back up)
    }
    this.lastCheckedTurn = turn;
  }

  toSnapshot(): KnowledgeCenterSnapshot {
    return {
      id: this.id,
      subject: this.subject,
      stability: this.stabilityValue,
      rebelled: this.rebelledFlag,
      lastCheckedTurn: this.lastCheckedTurn,
      maxStability: this.maxStability,
      gainPerCorrect: this.gainPerCorrect,
      lossPerWrong: this.lossPerWrong,
      recoveryThreshold: this.recoveryThreshold,
    };
  }

  static fromSnapshot(snap: KnowledgeCenterSnapshot): KnowledgeCenter {
    const c = new KnowledgeCenter({
      id: snap.id,
      subject: snap.subject,
      stability: snap.stability,
      config: {
        maxStability: snap.maxStability,
        gainPerCorrect: snap.gainPerCorrect,
        lossPerWrong: snap.lossPerWrong,
        recoveryThreshold: snap.recoveryThreshold,
      },
    });
    c.rebelledFlag = snap.rebelled;
    c.lastCheckedTurn = snap.lastCheckedTurn;
    return c;
  }
}
