// SupplyLedger — the optional hard-mode logistics resource (Ellátmány).
//
// Knowledge is the economy in the default mode; hard mode adds a PARALLEL
// classic resource that gates quantity/logistics, never access or quality.
// Supply is produced per turn and consumed by army upkeep; running out causes
// "starving" (a combat penalty), not loss of units.

export class SupplyLedger {
  private supply: number;

  constructor(initial = 0) {
    if (!Number.isInteger(initial) || initial < 0) {
      throw new TypeError(`initial supply must be a non-negative integer, got ${initial}`);
    }
    this.supply = initial;
  }

  get balance(): number {
    return this.supply;
  }

  produce(amount: number): void {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new TypeError(`amount must be a non-negative integer, got ${amount}`);
    }
    this.supply += amount;
  }

  canSpend(amount: number): boolean {
    return Number.isInteger(amount) && amount >= 0 && this.supply >= amount;
  }

  spend(amount: number): void {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new TypeError(`amount must be a non-negative integer, got ${amount}`);
    }
    if (this.supply < amount) {
      throw new RangeError(`Insufficient supply: have ${this.supply}, need ${amount}`);
    }
    this.supply -= amount;
  }

  /** Set the balance directly (for save/load restore and drain-to-zero). */
  restore(balance: number): void {
    if (!Number.isInteger(balance) || balance < 0) {
      throw new TypeError(`balance must be a non-negative integer, got ${balance}`);
    }
    this.supply = balance;
  }
}
