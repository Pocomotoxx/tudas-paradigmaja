import { describe, it, expect } from "vitest";
import { Subject } from "../economy/KKLedger.js";
import { BonusOp, type Bonus } from "../units/BonusSystem.js";
import { Unit } from "../units/Unit.js";
import {
  validateScientist,
  leaderBonusesFor,
  effectiveStatsUnderLeader,
  FOREIGN,
  type ScientistDef,
} from "./Scientist.js";

const atkBonus: Bonus = { id: "phys-atk", stat: "attack", op: BonusOp.ADD, value: 3, source: "newton" };
const foreignMalus: Bonus = { id: "foreign-slow", stat: "speed", op: BonusOp.ADD, value: -1, source: "newton" };

const newton: ScientistDef = {
  id: "newton",
  name: "Sir Isaac Newton",
  subject: Subject.FIZIKA,
  birthplaceLocationId: "dynamis-town",
  cost: { subject: Subject.FIZIKA, kk: 4 },
  affinities: [
    { subject: Subject.FIZIKA, bonuses: [atkBonus] },
    { subject: FOREIGN, bonuses: [foreignMalus] },
  ],
};

function unit(subject: Subject): Unit {
  return new Unit({ id: `u-${subject}`, name: "u", subject, base: { attack: 6, defense: 5, health: 40, speed: 4, initiative: 5 } });
}

describe("Scientist — leader bonuses (I22)", () => {
  it("grants the home-subject bonus to matching units", () => {
    const bonuses = leaderBonusesFor(newton, Subject.FIZIKA);
    expect(bonuses).toContain(atkBonus);
    expect(bonuses).not.toContain(foreignMalus); // own subject is not foreign
  });

  it("applies the FOREIGN malus to non-home subjects only", () => {
    const foreign = leaderBonusesFor(newton, Subject.BIOLOGIA);
    expect(foreign).toContain(foreignMalus);
    expect(foreign).not.toContain(atkBonus);
    // home subject gets no foreign malus
    expect(leaderBonusesFor(newton, Subject.FIZIKA)).not.toContain(foreignMalus);
  });

  it("computes effective stats under the leader without mutating the unit", () => {
    const physUnit = unit(Subject.FIZIKA);
    const before = physUnit.effectiveStats();
    const led = effectiveStatsUnderLeader(physUnit, newton);
    expect(led.attack).toBe(before.attack + 3); // +3 physics affinity
    expect(led.speed).toBe(before.speed); // home subject: no malus
    // unmutated
    expect(physUnit.effectiveStats()).toEqual(before);
  });

  it("penalises a foreign unit's stats", () => {
    const bioUnit = unit(Subject.BIOLOGIA);
    const led = effectiveStatsUnderLeader(bioUnit, newton);
    expect(led.speed).toBe(bioUnit.stat("speed") - 1); // foreign malus
    expect(led.attack).toBe(bioUnit.stat("attack")); // no physics bonus
  });

  // Negative tests.
  it("rejects invalid definitions", () => {
    expect(() => validateScientist({ ...newton, id: "" })).toThrow(TypeError);
    expect(() => validateScientist({ ...newton, name: "" })).toThrow(TypeError);
    expect(() => validateScientist({ ...newton, subject: "NOPE" as never })).toThrow(TypeError);
    expect(() => validateScientist({ ...newton, cost: { subject: Subject.FIZIKA, kk: -1 } })).toThrow(TypeError);
    expect(() => validateScientist({ ...newton, affinities: [{ subject: "??" as never, bonuses: [] }] })).toThrow(TypeError);
  });
});
