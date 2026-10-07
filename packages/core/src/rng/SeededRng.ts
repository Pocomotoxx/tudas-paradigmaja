// SeededRng — the single source of randomness for the deterministic core.
//
// Algorithm: SplitMix64-derived 32-bit output. We keep a 32-bit unsigned
// internal state advanced by the SplitMix increment, then finalize each step
// with a mix function. This is fast, has good statistical quality for game
// use, and — critically — is fully deterministic and portable: the same seed
// yields the same sequence on any JS engine, which is what the reproducibility
// tests (and later save/replay) depend on.
//
// This is NOT cryptographically secure and must never be used for anything
// security-sensitive. It exists purely to make gameplay reproducible.

/** Minimal random interface the rest of the core depends on. */
export interface Rng {
  /** Next unsigned 32-bit integer in [0, 2^32). */
  nextUint32(): number;
  /** Next float in [0, 1). */
  nextFloat(): number;
  /** Uniform integer in [minInclusive, maxInclusive]. */
  nextInt(minInclusive: number, maxInclusive: number): number;
  /** Serializable internal state, for save/replay. */
  getState(): number;
}

const UINT32 = 0x1_0000_0000; // 2^32

/** Mix a 32-bit state into a well-distributed 32-bit output (mulberry32 finalizer). */
function mix32(z: number): number {
  z = Math.imul(z ^ (z >>> 15), z | 1);
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
  return (z ^ (z >>> 14)) >>> 0;
}

export class SeededRng implements Rng {
  /** Unsigned 32-bit state. */
  private state: number;

  /**
   * @param seed Any integer; coerced to an unsigned 32-bit value. The same
   *   seed always produces the same sequence.
   */
  constructor(seed: number) {
    if (!Number.isFinite(seed)) {
      throw new TypeError(`SeededRng seed must be a finite number, got ${seed}`);
    }
    // Coerce to uint32; a zero seed is fine because the step adds a nonzero
    // increment before mixing.
    this.state = seed >>> 0;
  }

  /** Restore an RNG from a previously serialized state (see getState). */
  static fromState(state: number): SeededRng {
    const rng = new SeededRng(0);
    rng.state = state >>> 0;
    return rng;
  }

  nextUint32(): number {
    // Advance state by the SplitMix32 odd increment, then finalize.
    this.state = (this.state + 0x9e3779b9) >>> 0;
    return mix32(this.state);
  }

  nextFloat(): number {
    return this.nextUint32() / UINT32;
  }

  nextInt(minInclusive: number, maxInclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
      throw new TypeError("nextInt bounds must be integers");
    }
    if (maxInclusive < minInclusive) {
      throw new RangeError(
        `nextInt: maxInclusive (${maxInclusive}) < minInclusive (${minInclusive})`,
      );
    }
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + (this.nextUint32() % span);
  }

  getState(): number {
    return this.state >>> 0;
  }

  /** Overwrite the internal state in place (for save/load restore). */
  restore(state: number): void {
    this.state = state >>> 0;
  }
}
