import { describe, it, expect } from "vitest";
import { Subject } from "../economy/KKLedger.js";
import { UnitLadder, type LadderTier } from "./UnitLadder.js";

// Numeris (Matematika) 7-tier ladder from the faction design.
const NAMES = [
  "Számőr", "Geometrista", "Algebraista", "Statisztikus",
  "Kalkulátor", "Matematikai Konstruktor", "Axiomatikus",
];

function numerisLadder(): UnitLadder {
  const tiers: LadderTier[] = NAMES.map((name, i) => {
    const tier = i + 1;
    const id = `num${tier}`;
    return {
      id,
      name,
      subject: Subject.MATEMATIKA,
      tier,
      kkCost: tier * 2,
      base: { attack: 4 + tier, defense: 3 + tier, health: 20 + tier * 10, speed: 3, initiative: 4 + tier },
      ...(tier < NAMES.length ? { upgradesTo: `num${tier + 1}` } : {}),
    };
  });
  return new UnitLadder(Subject.MATEMATIKA, tiers);
}

describe("UnitLadder — seven-tier progression (I19)", () => {
  it("builds a contiguous seven-tier ladder", () => {
    const l = numerisLadder();
    expect(l.size).toBe(7);
    expect(l.tiers().map((t) => t.tier)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(l.byTier(1).name).toBe("Számőr");
    expect(l.byTier(7).name).toBe("Axiomatikus");
  });

  it("walks the upgrade chain and prices each step", () => {
    const l = numerisLadder();
    expect(l.next("num1")!.id).toBe("num2");
    expect(l.upgradeCost("num1")).toBe(4); // num2 kkCost = 2*2
    expect(l.next("num7")).toBeNull(); // top tier
    expect(() => l.upgradeCost("num7")).toThrow(RangeError);
  });

  it("accepts input tiers in any order (sorts by tier)", () => {
    const l = numerisLadder();
    const shuffled = [...l.tiers()].reverse();
    const l2 = new UnitLadder(Subject.MATEMATIKA, shuffled);
    expect(l2.tiers().map((t) => t.id)).toEqual(l.tiers().map((t) => t.id));
  });

  // Negative tests.
  it("rejects a gap in tiers", () => {
    const tiers: LadderTier[] = [
      { id: "a", name: "a", subject: Subject.MATEMATIKA, tier: 1, kkCost: 1, base: { attack: 1, defense: 1, health: 1, speed: 1, initiative: 1 }, upgradesTo: "c" },
      { id: "c", name: "c", subject: Subject.MATEMATIKA, tier: 3, kkCost: 1, base: { attack: 1, defense: 1, health: 1, speed: 1, initiative: 1 } },
    ];
    expect(() => new UnitLadder(Subject.MATEMATIKA, tiers)).toThrow(TypeError);
  });

  it("rejects a wrong upgradesTo target", () => {
    const tiers: LadderTier[] = [
      { id: "a", name: "a", subject: Subject.MATEMATIKA, tier: 1, kkCost: 1, base: { attack: 1, defense: 1, health: 1, speed: 1, initiative: 1 }, upgradesTo: "ghost" },
      { id: "b", name: "b", subject: Subject.MATEMATIKA, tier: 2, kkCost: 1, base: { attack: 1, defense: 1, health: 1, speed: 1, initiative: 1 } },
    ];
    expect(() => new UnitLadder(Subject.MATEMATIKA, tiers)).toThrow(TypeError);
  });

  it("rejects a subject mismatch and a top tier with upgradesTo", () => {
    expect(() => new UnitLadder(Subject.FIZIKA, numerisLadder().tiers())).toThrow(TypeError);
    const tiers: LadderTier[] = [
      { id: "a", name: "a", subject: Subject.MATEMATIKA, tier: 1, kkCost: 1, base: { attack: 1, defense: 1, health: 1, speed: 1, initiative: 1 }, upgradesTo: "a" },
    ];
    expect(() => new UnitLadder(Subject.MATEMATIKA, tiers)).toThrow(TypeError);
  });
});
