// Difficulty — the four difficulty levels and their tuning knobs.
//
// Higher levels make the game harsher and the questions harder to guess:
//  - rebellionIntervalTurns: a knowledge centre may rebel at most once every N
//    turns (10 / 8 / 6 / 3) — lower = rebellions can strike more often.
//  - choiceCount: number of options on a multiple-choice question (2 / 3 / 5 / 7)
//    — more options means a wrong answer is harder to guess.
//  - subjectUnrestCascade: at levels 3–4, repeatedly wrong answers raise unrest
//    across every region of that subject and make that subject's units desert
//    at a growing rate (see SubjectUnrest).
//  - answerTimeLimitMs: per-question countdown for capture questions (CaptureGate
//    perQuestionMs). null on levels 1–2 — untimed; the player may take as long
//    as they like, or simply walk away (CaptureGate.abandon()), e.g. leaving the
//    settlement without penalty. 20000ms / 10000ms on levels 3–4.

export enum Difficulty {
  ONE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
}

export interface DifficultyParams {
  readonly level: Difficulty;
  /** A centre may rebel at most once every this many turns. */
  readonly rebellionIntervalTurns: number;
  /** Multiple-choice options presented per question. */
  readonly choiceCount: number;
  /** Whether wrong answers cascade unrest/desertion into the subject's regions. */
  readonly subjectUnrestCascade: boolean;
  /** Per-question time limit (ms) for capture questions, or null when untimed. */
  readonly answerTimeLimitMs: number | null;
}

export const DIFFICULTIES: Readonly<Record<Difficulty, DifficultyParams>> = {
  [Difficulty.ONE]:   { level: Difficulty.ONE,   rebellionIntervalTurns: 10, choiceCount: 2, subjectUnrestCascade: false, answerTimeLimitMs: null },
  [Difficulty.TWO]:   { level: Difficulty.TWO,   rebellionIntervalTurns: 8,  choiceCount: 3, subjectUnrestCascade: false, answerTimeLimitMs: null },
  [Difficulty.THREE]: { level: Difficulty.THREE, rebellionIntervalTurns: 6,  choiceCount: 5, subjectUnrestCascade: true,  answerTimeLimitMs: 20_000 },
  [Difficulty.FOUR]:  { level: Difficulty.FOUR,  rebellionIntervalTurns: 3,  choiceCount: 7, subjectUnrestCascade: true,  answerTimeLimitMs: 10_000 },
};

/** Tuning for a difficulty level. Throws on an unknown level. */
export function difficultyParams(level: Difficulty): DifficultyParams {
  const p = DIFFICULTIES[level];
  if (p === undefined) throw new RangeError(`Unknown difficulty level: ${level}`);
  return p;
}
