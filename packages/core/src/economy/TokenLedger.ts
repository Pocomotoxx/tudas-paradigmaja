// TokenLedger — the subject-neutral "test token" balance (D-FLOW async economy).
//
// The strategic phase produces test tokens (an abstraction of time/opportunity),
// which the player later spends to attempt tests in the academic phase. Per
// decision G2 the balance has a hard cap and earns NO interest: production
// above the cap is simply lost, so hoarding has a ceiling and cannot snowball.

export class TokenLedger {
  private tokens: number;
  readonly cap: number;

  constructor(cap: number, initial = 0) {
    if (!Number.isInteger(cap) || cap < 0) {
      throw new TypeError(`cap must be a non-negative integer, got ${cap}`);
    }
    if (!Number.isInteger(initial) || initial < 0) {
      throw new TypeError(`initial must be a non-negative integer, got ${initial}`);
    }
    this.cap = cap;
    this.tokens = Math.min(initial, cap);
  }

  get balance(): number {
    return this.tokens;
  }

  /** Set the balance directly (for save/load restore); clamped to [0, cap]. */
  restore(balance: number): void {
    if (!Number.isInteger(balance) || balance < 0) {
      throw new TypeError(`balance must be a non-negative integer, got ${balance}`);
    }
    this.tokens = Math.min(balance, this.cap);
  }

  /**
   * Produce `amount` tokens (e.g. from owning a building for a turn). The
   * balance is clamped at the cap (G2: no interest, overflow is lost).
   * @returns the number of tokens actually added (may be less than `amount`).
   */
  produce(amount: number): number {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new TypeError(`amount must be a non-negative integer, got ${amount}`);
    }
    const before = this.tokens;
    this.tokens = Math.min(this.tokens + amount, this.cap);
    return this.tokens - before;
  }

  /** True when the balance can cover `amount`. */
  canSpend(amount: number): boolean {
    return Number.isInteger(amount) && amount >= 0 && this.tokens >= amount;
  }

  /** Spend `amount` tokens, or throw if the balance is insufficient. */
  spend(amount: number): void {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new TypeError(`amount must be a non-negative integer, got ${amount}`);
    }
    if (this.tokens < amount) {
      throw new RangeError(
        `Insufficient tokens: have ${this.tokens}, need ${amount}`,
      );
    }
    this.tokens -= amount;
  }
}
