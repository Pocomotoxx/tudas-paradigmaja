import { describe, it, expect } from "vitest";
import { KKLedger, Subject } from "../economy/KKLedger.js";
import { SynergyRegistry, validateSynergy, type SynergyDef } from "./SynergyRegistry.js";

const biochem: SynergyDef = {
  id: "biochem",
  name: "Biokémiai fegyverzet",
  requires: [
    { subject: Subject.BIOLOGIA, kk: 5 },
    { subject: Subject.KEMIA, kk: 5 },
  ],
  cost: [
    { subject: Subject.BIOLOGIA, kk: 3 },
    { subject: Subject.KEMIA, kk: 3 },
  ],
  unlocks: "ability:biochemical-ordnance",
};

function registry(): SynergyRegistry {
  return new SynergyRegistry([biochem]);
}

describe("SynergyRegistry — cross-subject synergies (I21)", () => {
  it("is lockable only when both mastery gates are met", () => {
    const kk = new KKLedger();
    const reg = registry();
    expect(reg.canUnlock("biochem", kk)).toBe(false); // 0/0
    kk.earn(Subject.BIOLOGIA, 5);
    expect(reg.canUnlock("biochem", kk)).toBe(false); // chem still 0
    kk.earn(Subject.KEMIA, 5);
    expect(reg.canUnlock("biochem", kk)).toBe(true);
  });

  it("unlocking spends the cost in each subject and returns the ability", () => {
    const kk = new KKLedger();
    kk.earn(Subject.BIOLOGIA, 6);
    kk.earn(Subject.KEMIA, 6);
    const def = registry().unlock("biochem", kk);
    expect(def.unlocks).toBe("ability:biochemical-ordnance");
    expect(kk.balanceOf(Subject.BIOLOGIA)).toBe(3); // 6 - 3
    expect(kk.balanceOf(Subject.KEMIA)).toBe(3);
  });

  it("refuses to unlock when a requirement is unmet", () => {
    const kk = new KKLedger();
    kk.earn(Subject.BIOLOGIA, 5); // chem 0
    expect(() => registry().unlock("biochem", kk)).toThrow(RangeError);
  });

  it("lists ids and looks up defs", () => {
    const reg = registry();
    expect(reg.ids()).toEqual(["biochem"]);
    expect(reg.get("biochem").name).toBe("Biokémiai fegyverzet");
    expect(() => reg.get("ghost")).toThrow(RangeError);
  });

  // Negative tests.
  it("rejects a synergy requiring fewer than two subjects", () => {
    expect(() => validateSynergy({ ...biochem, requires: [{ subject: Subject.BIOLOGIA, kk: 5 }] })).toThrow(TypeError);
  });

  it("rejects an empty unlocks id and duplicate registry ids", () => {
    expect(() => validateSynergy({ ...biochem, unlocks: "" })).toThrow(TypeError);
    expect(() => new SynergyRegistry([biochem, biochem])).toThrow(TypeError);
  });

  it("rejects invalid amounts", () => {
    expect(() => validateSynergy({ ...biochem, cost: [{ subject: Subject.BIOLOGIA, kk: -1 }, { subject: Subject.KEMIA, kk: 1 }] })).toThrow(TypeError);
  });
});
