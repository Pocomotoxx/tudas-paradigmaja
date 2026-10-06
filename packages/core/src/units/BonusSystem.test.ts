import { describe, it, expect } from "vitest";
import { BonusSystem, BonusOp, validateBonus, type StatBlock, type Bonus } from "./BonusSystem.js";

const base: StatBlock = { attack: 10, defense: 5, health: 100, speed: 4, initiative: 6 };

const bonus = (over: Partial<Bonus>): Bonus => ({
  id: "b",
  stat: "attack",
  op: BonusOp.ADD,
  value: 1,
  source: "test",
  ...over,
});

describe("BonusSystem — generic modifiers", () => {
  it("returns base unchanged with no bonuses", () => {
    expect(BonusSystem.apply(base, [])).toEqual(base);
  });

  it("applies ADD before MUL per stat", () => {
    const out = BonusSystem.apply(base, [
      bonus({ id: "m", op: BonusOp.MUL, value: 2 }),
      bonus({ id: "a", op: BonusOp.ADD, value: 5 }),
    ]);
    // (10 + 5) * 2 = 30
    expect(out.attack).toBe(30);
  });

  it("is deterministic regardless of bonus insertion order", () => {
    const a = BonusSystem.apply(base, [
      bonus({ id: "z", op: BonusOp.MUL, value: 1.5 }),
      bonus({ id: "a", op: BonusOp.MUL, value: 2 }),
    ]);
    const b = BonusSystem.apply(base, [
      bonus({ id: "a", op: BonusOp.MUL, value: 2 }),
      bonus({ id: "z", op: BonusOp.MUL, value: 1.5 }),
    ]);
    expect(a).toEqual(b);
  });

  it("floors and clamps at zero (debuffs cannot go negative)", () => {
    const out = BonusSystem.apply(base, [
      bonus({ stat: "defense", op: BonusOp.ADD, value: -999 }),
    ]);
    expect(out.defense).toBe(0);
  });

  it("validateBonus rejects malformed bonuses", () => {
    expect(() => validateBonus(bonus({ id: "" }))).toThrow(TypeError);
    expect(() => validateBonus(bonus({ stat: "nope" as never }))).toThrow(TypeError);
    expect(() => validateBonus(bonus({ value: NaN }))).toThrow(TypeError);
  });
});
