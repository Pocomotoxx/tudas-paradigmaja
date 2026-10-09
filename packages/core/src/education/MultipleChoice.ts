// MultipleChoice — build the options for a felelet választós (multiple-choice)
// question at a given difficulty. The number of options comes from the
// difficulty level (2 / 3 / 5 / 7). The correct answer plus a deterministic
// sample of distractors are shuffled with the seeded RNG, so the same
// (question, choiceCount, seed) always yields the same options in the same
// order — reproducible for tests and replay.

import type { Rng } from "../rng/SeededRng.js";
import type { QuestionItem } from "./QuestionBank.js";

export interface Choice {
  readonly text: string;
  readonly correct: boolean;
}

export interface ChoiceSet {
  readonly questionId: string;
  readonly prompt: string;
  readonly choices: readonly Choice[];
  /** Index of the correct choice within `choices`. */
  readonly correctIndex: number;
}

/** Deterministic Fisher–Yates shuffle driven by the seeded RNG. */
function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Build a `choiceCount`-option multiple-choice set for a question. Requires the
 * question to carry MC content (`correct` + enough `distractors`). The correct
 * answer and (choiceCount - 1) distractors are selected (distractors shuffled,
 * then the first N taken) and all options shuffled into their final order.
 */
export function buildChoices(q: QuestionItem, choiceCount: number, rng: Rng): ChoiceSet {
  if (!Number.isInteger(choiceCount) || choiceCount < 2) {
    throw new RangeError(`choiceCount must be an integer >= 2, got ${choiceCount}`);
  }
  if (q.correct === undefined || q.distractors === undefined) {
    throw new TypeError(`Question ${q.id} has no multiple-choice content`);
  }
  const needed = choiceCount - 1;
  if (q.distractors.length < needed) {
    throw new RangeError(
      `Question ${q.id} needs ${needed} distractors for ${choiceCount} choices, has ${q.distractors.length}`,
    );
  }
  const picked = shuffle([...q.distractors], rng).slice(0, needed);
  const options: Choice[] = [{ text: q.correct, correct: true }, ...picked.map((text) => ({ text, correct: false }))];
  const ordered = shuffle(options, rng);
  return {
    questionId: q.id,
    prompt: q.prompt ?? q.topic,
    choices: ordered,
    correctIndex: ordered.findIndex((c) => c.correct),
  };
}
