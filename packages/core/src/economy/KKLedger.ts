// KKLedger — per-subject Kognitív Kredit balances.
//
// KK is EARNED by passing tests in a given subject during the academic phase,
// and SPENT on tech-tree nodes and unit development for that subject. Balances
// are per-subject (maths-KK is not history-KK); this asymmetry is what drives
// the strategic specialisation-vs-polymath choice.

export enum Subject {
  MATEMATIKA = "MATEMATIKA",
  FIZIKA_KEMIA = "FIZIKA_KEMIA",
  BIOLOGIA = "BIOLOGIA",
  TORTENELEM = "TORTENELEM",
  FOLDRAJZ = "FOLDRAJZ",
}

export const ALL_SUBJECTS: readonly Subject[] = Object.values(Subject);

export class KKLedger {
  private readonly balances = new Map<Subject, number>();

  constructor() {
    for (const s of ALL_SUBJECTS) this.balances.set(s, 0);
  }

  balanceOf(subject: Subject): number {
    return this.balances.get(subject) ?? 0;
  }

  /** Earn KK in a subject (from a passed test). */
  earn(subject: Subject, amount: number): void {
    this.assertKnownSubject(subject);
    if (!Number.isInteger(amount) || amount < 0) {
      throw new TypeError(`amount must be a non-negative integer, got ${amount}`);
    }
    this.balances.set(subject, this.balanceOf(subject) + amount);
  }

  canSpend(subject: Subject, amount: number): boolean {
    return (
      this.balances.has(subject) &&
      Number.isInteger(amount) &&
      amount >= 0 &&
      this.balanceOf(subject) >= amount
    );
  }

  /** Spend KK in a subject (on a tech node / unit upgrade), or throw. */
  spend(subject: Subject, amount: number): void {
    this.assertKnownSubject(subject);
    if (!Number.isInteger(amount) || amount < 0) {
      throw new TypeError(`amount must be a non-negative integer, got ${amount}`);
    }
    const current = this.balanceOf(subject);
    if (current < amount) {
      throw new RangeError(
        `Insufficient ${subject} KK: have ${current}, need ${amount}`,
      );
    }
    this.balances.set(subject, current - amount);
  }

  /** Snapshot of all balances, for save/serialization. */
  snapshot(): Record<Subject, number> {
    const out = {} as Record<Subject, number>;
    for (const s of ALL_SUBJECTS) out[s] = this.balanceOf(s);
    return out;
  }

  private assertKnownSubject(subject: Subject): void {
    if (!this.balances.has(subject)) {
      throw new TypeError(`Unknown subject: ${String(subject)}`);
    }
  }
}
