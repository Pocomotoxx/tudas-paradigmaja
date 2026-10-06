import { describe, it, expect } from "vitest";
import { KKLedger, Subject, ALL_SUBJECTS } from "./KKLedger.js";

describe("KKLedger — per-subject cognitive credits (I2 AC5 support)", () => {
  it("starts every subject at zero", () => {
    const l = new KKLedger();
    for (const s of ALL_SUBJECTS) expect(l.balanceOf(s)).toBe(0);
  });

  it("earns and spends per subject independently", () => {
    const l = new KKLedger();
    l.earn(Subject.MATEMATIKA, 10);
    l.earn(Subject.TORTENELEM, 3);
    expect(l.balanceOf(Subject.MATEMATIKA)).toBe(10);
    expect(l.balanceOf(Subject.TORTENELEM)).toBe(3);
    expect(l.balanceOf(Subject.BIOLOGIA)).toBe(0);

    l.spend(Subject.MATEMATIKA, 4);
    expect(l.balanceOf(Subject.MATEMATIKA)).toBe(6);
    // Spending maths does not touch history.
    expect(l.balanceOf(Subject.TORTENELEM)).toBe(3);
  });

  it("blocks overspend in a subject", () => {
    const l = new KKLedger();
    l.earn(Subject.FIZIKA_KEMIA, 2);
    expect(l.canSpend(Subject.FIZIKA_KEMIA, 3)).toBe(false);
    expect(() => l.spend(Subject.FIZIKA_KEMIA, 3)).toThrow(RangeError);
  });

  it("snapshots all balances for serialization", () => {
    const l = new KKLedger();
    l.earn(Subject.FOLDRAJZ, 7);
    const snap = l.snapshot();
    expect(snap[Subject.FOLDRAJZ]).toBe(7);
    expect(Object.keys(snap).sort()).toEqual([...ALL_SUBJECTS].sort());
  });

  // Negative / safety tests.
  it("rejects negative earn/spend amounts", () => {
    const l = new KKLedger();
    expect(() => l.earn(Subject.BIOLOGIA, -1)).toThrow(TypeError);
    expect(() => l.spend(Subject.BIOLOGIA, -1)).toThrow(TypeError);
  });
});
