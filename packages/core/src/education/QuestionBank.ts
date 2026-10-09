// QuestionBank — the data-driven pool of knowledge questions.
//
// Questions are DATA (loadable from JSON), not code: a new question is a new
// record, never a code change. The bank validates every record on construction
// (malformed input is rejected, never silently accepted) and offers a
// deterministic adaptive selection: pick the unused question whose difficulty
// `b` is closest to the player's current ability theta, breaking ties by id.
//
// For the MVP, correctness evaluation is left to the caller (the presentation
// or a later solver) and passed into the TestSession as a boolean; the bank
// only models question metadata and selection.

import { Subject, ALL_SUBJECTS } from "../economy/KKLedger.js";

export enum DifficultyTier {
  ALAP = "ALAP",
  HALADO = "HALADO",
  SZAKERTO = "SZAKERTO",
}

const TIERS: readonly DifficultyTier[] = Object.values(DifficultyTier);

export interface QuestionItem {
  readonly id: string;
  readonly subject: Subject;
  readonly topic: string;
  /** Rasch difficulty parameter. */
  readonly b: number;
  readonly tier: DifficultyTier;
  /** Optional multiple-choice content (felelet választós). */
  readonly prompt?: string;
  /** The correct answer text. */
  readonly correct?: string;
  /** Wrong-answer options to draw distractors from. */
  readonly distractors?: readonly string[];
}

/** Validate a single raw record, returning a typed QuestionItem or throwing. */
export function validateQuestion(raw: unknown): QuestionItem {
  if (typeof raw !== "object" || raw === null) {
    throw new TypeError("Question must be an object");
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id.length === 0) {
    throw new TypeError("Question.id must be a non-empty string");
  }
  if (!ALL_SUBJECTS.includes(r.subject as Subject)) {
    throw new TypeError(`Question.subject invalid: ${String(r.subject)} (id=${r.id})`);
  }
  if (typeof r.topic !== "string" || r.topic.length === 0) {
    throw new TypeError(`Question.topic must be a non-empty string (id=${r.id})`);
  }
  if (typeof r.b !== "number" || !Number.isFinite(r.b)) {
    throw new TypeError(`Question.b must be a finite number (id=${r.id})`);
  }
  if (!TIERS.includes(r.tier as DifficultyTier)) {
    throw new TypeError(`Question.tier invalid: ${String(r.tier)} (id=${r.id})`);
  }
  // Optional multiple-choice content: validated only when any MC field is present.
  const hasMc = r.prompt !== undefined || r.correct !== undefined || r.distractors !== undefined;
  if (hasMc) {
    if (typeof r.correct !== "string" || r.correct.length === 0) {
      throw new TypeError(`Question.correct must be a non-empty string for MC (id=${r.id})`);
    }
    if (!Array.isArray(r.distractors) || r.distractors.some((d) => typeof d !== "string" || d.length === 0)) {
      throw new TypeError(`Question.distractors must be an array of non-empty strings (id=${r.id})`);
    }
    if (r.prompt !== undefined && typeof r.prompt !== "string") {
      throw new TypeError(`Question.prompt must be a string (id=${r.id})`);
    }
  }
  return {
    id: r.id,
    subject: r.subject as Subject,
    topic: r.topic,
    b: r.b,
    tier: r.tier as DifficultyTier,
    ...(typeof r.prompt === "string" ? { prompt: r.prompt } : {}),
    ...(typeof r.correct === "string" ? { correct: r.correct } : {}),
    ...(Array.isArray(r.distractors) ? { distractors: r.distractors as string[] } : {}),
  };
}

export class QuestionBank {
  private readonly bySubject = new Map<Subject, QuestionItem[]>();

  constructor(rawItems: readonly unknown[]) {
    const seenIds = new Set<string>();
    for (const s of ALL_SUBJECTS) this.bySubject.set(s, []);
    for (const raw of rawItems) {
      const q = validateQuestion(raw);
      if (seenIds.has(q.id)) {
        throw new TypeError(`Duplicate question id: ${q.id}`);
      }
      seenIds.add(q.id);
      this.bySubject.get(q.subject)!.push(q);
    }
  }

  countFor(subject: Subject): number {
    return this.bySubject.get(subject)?.length ?? 0;
  }

  /**
   * Deterministically select the question for `subject` whose difficulty is
   * closest to `theta`, excluding ids in `excludeIds`. Ties (equal |b - theta|)
   * break by ascending id. Returns null when no eligible question remains.
   */
  selectFor(
    subject: Subject,
    theta: number,
    excludeIds: ReadonlySet<string> = new Set(),
  ): QuestionItem | null {
    const pool = (this.bySubject.get(subject) ?? []).filter(
      (q) => !excludeIds.has(q.id),
    );
    if (pool.length === 0) return null;
    pool.sort((a, b) => {
      const da = Math.abs(a.b - theta);
      const db = Math.abs(b.b - theta);
      if (da !== db) return da - db;
      return a.id < b.id ? -1 : 1;
    });
    return pool[0] ?? null;
  }
}
