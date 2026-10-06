import { describe, it, expect } from "vitest";
import { TokenLedger } from "./TokenLedger.js";

describe("TokenLedger — async token economy (I2 AC2, AC3)", () => {
  it("accumulates produced tokens over turns (AC2)", () => {
    const l = new TokenLedger(10);
    l.produce(2); // turn 1
    l.produce(2); // turn 2
    l.produce(2); // turn 3
    expect(l.balance).toBe(6);
  });

  it("enforces the cap and earns no interest (AC3/G2)", () => {
    const l = new TokenLedger(5);
    const added = l.produce(8); // would overshoot
    expect(l.balance).toBe(5);
    expect(added).toBe(5); // only 5 actually landed
    // At cap, further production adds nothing (no interest, no overflow).
    expect(l.produce(3)).toBe(0);
    expect(l.balance).toBe(5);
  });

  it("spends tokens and blocks overspend", () => {
    const l = new TokenLedger(10, 4);
    expect(l.canSpend(4)).toBe(true);
    l.spend(3);
    expect(l.balance).toBe(1);
    expect(l.canSpend(2)).toBe(false);
    expect(() => l.spend(2)).toThrow(RangeError);
  });

  // Negative / safety tests.
  it("rejects a negative or non-integer cap", () => {
    expect(() => new TokenLedger(-1)).toThrow(TypeError);
    expect(() => new TokenLedger(2.5)).toThrow(TypeError);
  });

  it("rejects negative production and spend amounts", () => {
    const l = new TokenLedger(10, 5);
    expect(() => l.produce(-1)).toThrow(TypeError);
    expect(() => l.spend(-1)).toThrow(TypeError);
  });

  it("clamps an initial balance above the cap", () => {
    expect(new TokenLedger(5, 99).balance).toBe(5);
  });
});
