import { describe, it, expect } from "vitest";
import { SeededRng } from "./SeededRng.js";

describe("SeededRng — determinism (I0 core invariant)", () => {
  it("produces an identical sequence for the same seed", () => {
    const a = new SeededRng(12345);
    const b = new SeededRng(12345);
    const seqA = Array.from({ length: 1000 }, () => a.nextUint32());
    const seqB = Array.from({ length: 1000 }, () => b.nextUint32());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = new SeededRng(1);
    const b = new SeededRng(2);
    const seqA = Array.from({ length: 50 }, () => a.nextUint32());
    const seqB = Array.from({ length: 50 }, () => b.nextUint32());
    expect(seqA).not.toEqual(seqB);
  });

  it("can be resumed exactly from a serialized state (save/replay)", () => {
    const a = new SeededRng(999);
    for (let i = 0; i < 17; i++) a.nextUint32();
    const resumed = SeededRng.fromState(a.getState());
    const tailA = Array.from({ length: 100 }, () => a.nextUint32());
    const tailResumed = Array.from({ length: 100 }, () => resumed.nextUint32());
    expect(tailResumed).toEqual(tailA);
  });

  it("nextFloat stays in [0, 1)", () => {
    const rng = new SeededRng(7);
    for (let i = 0; i < 10000; i++) {
      const f = rng.nextFloat();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it("nextInt stays within inclusive bounds and is deterministic", () => {
    const rng = new SeededRng(42);
    for (let i = 0; i < 10000; i++) {
      const n = rng.nextInt(3, 8);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(8);
    }
    // Deterministic draw: a fresh RNG with the same seed reproduces the roll.
    const r1 = new SeededRng(2026);
    const r2 = new SeededRng(2026);
    expect(r1.nextInt(1, 6)).toBe(r2.nextInt(1, 6));
  });

  // Negative / safety tests (Krista TEST_PLAN requirement).
  it("rejects a non-finite seed", () => {
    expect(() => new SeededRng(Number.NaN)).toThrow(TypeError);
    expect(() => new SeededRng(Infinity)).toThrow(TypeError);
  });

  it("rejects inverted integer bounds", () => {
    const rng = new SeededRng(1);
    expect(() => rng.nextInt(10, 2)).toThrow(RangeError);
  });

  it("rejects non-integer bounds", () => {
    const rng = new SeededRng(1);
    expect(() => rng.nextInt(0.5, 3)).toThrow(TypeError);
  });
});
