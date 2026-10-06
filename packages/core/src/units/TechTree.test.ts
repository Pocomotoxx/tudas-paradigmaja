import { describe, it, expect } from "vitest";
import { KKLedger, Subject } from "../economy/KKLedger.js";
import { BonusOp, type Bonus } from "./BonusSystem.js";
import { Unit } from "./Unit.js";
import { TechTree } from "./TechTree.js";

const MATHS = Subject.MATEMATIKA;

function golem(): Unit {
  return new Unit({
    id: "kalkulus-golem",
    name: "Kalkulus-gólem",
    subject: MATHS,
    base: { attack: 8, defense: 12, health: 120, speed: 3, initiative: 4 },
  });
}

const armor: Bonus = { id: "armor+", stat: "defense", op: BonusOp.ADD, value: 6, source: "t-armor" };

function tree(): TechTree {
  return new TechTree([
    { id: "t-armor", subject: MATHS, kkCost: 3, bonuses: [armor] },
    {
      id: "t-armor-2",
      subject: MATHS,
      kkCost: 5,
      bonuses: [{ id: "armor++", stat: "defense", op: BonusOp.MUL, value: 1.5, source: "t-armor-2" }],
      prerequisites: ["t-armor"],
    },
  ]);
}

describe("TechTree — KK-funded unit development (I4 AC8)", () => {
  it("researching a node spends KK and raises the unit stat (AC8)", () => {
    const kk = new KKLedger();
    kk.earn(MATHS, 10);
    const unit = golem();
    const before = unit.stat("defense"); // 12

    tree().research("t-armor", kk, unit);

    const after = unit.stat("defense"); // 12 + 6
    expect(after).toBe(before + 6);
    expect(kk.balanceOf(MATHS)).toBe(7); // 10 - 3
  });

  it("enforces prerequisites", () => {
    const kk = new KKLedger();
    kk.earn(MATHS, 20);
    const unit = golem();
    const t = tree();
    expect(() => t.research("t-armor-2", kk, unit)).toThrow(RangeError);
    t.research("t-armor", kk, unit);
    expect(t.canResearch("t-armor-2", kk)).toBe(true);
    t.research("t-armor-2", kk, unit);
    // defense: (12 + 6) * 1.5 = 27
    expect(unit.stat("defense")).toBe(27);
  });

  it("blocks research without enough KK", () => {
    const kk = new KKLedger();
    kk.earn(MATHS, 2); // need 3
    const unit = golem();
    expect(tree().canResearch("t-armor", kk)).toBe(false);
    expect(() => tree().research("t-armor", kk, unit)).toThrow(RangeError);
  });

  it("rejects a subject mismatch between unit and node", () => {
    const kk = new KKLedger();
    kk.earn(MATHS, 10);
    const historyUnit = new Unit({
      id: "kronos",
      name: "Kronos-stratéga",
      subject: Subject.TORTENELEM,
      base: { attack: 7, defense: 6, health: 80, speed: 6, initiative: 9 },
    });
    expect(() => tree().research("t-armor", kk, historyUnit)).toThrow(TypeError);
  });

  it("cannot research the same node twice", () => {
    const kk = new KKLedger();
    kk.earn(MATHS, 10);
    const unit = golem();
    const t = tree();
    t.research("t-armor", kk, unit);
    expect(() => t.research("t-armor", kk, unit)).toThrow(RangeError);
  });

  // Negative / safety tests at construction.
  it("rejects duplicate node ids and unknown prerequisites", () => {
    expect(() => new TechTree([
      { id: "dup", subject: MATHS, kkCost: 1, bonuses: [] },
      { id: "dup", subject: MATHS, kkCost: 1, bonuses: [] },
    ])).toThrow(TypeError);
    expect(() => new TechTree([
      { id: "x", subject: MATHS, kkCost: 1, bonuses: [], prerequisites: ["ghost"] },
    ])).toThrow(TypeError);
  });
});

describe("Unit — construction safety", () => {
  it("rejects a negative base stat", () => {
    expect(() => new Unit({
      id: "bad",
      name: "bad",
      subject: MATHS,
      base: { attack: -1, defense: 1, health: 1, speed: 1, initiative: 1 },
    })).toThrow(TypeError);
  });
});
