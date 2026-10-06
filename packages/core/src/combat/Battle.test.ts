import { describe, it, expect } from "vitest";
import { SeededRng } from "../rng/SeededRng.js";
import { Subject } from "../economy/KKLedger.js";
import { BonusOp } from "../units/BonusSystem.js";
import { Unit } from "../units/Unit.js";
import {
  simulateBattle,
  combatantFromUnit,
  BattleSide,
  BattleOutcome,
  type CombatantInit,
} from "./Battle.js";

const player: CombatantInit = {
  id: "golem",
  side: BattleSide.PLAYER,
  stats: { attack: 12, defense: 10, health: 60, speed: 3, initiative: 5 },
};
const enemy: CombatantInit = {
  id: "ogre",
  side: BattleSide.ENEMY,
  stats: { attack: 8, defense: 4, health: 40, speed: 3, initiative: 4 },
};

describe("simulateBattle — deterministic combat (I5 AC9, AC10)", () => {
  it("is reproducible: same combatants + same seed => identical log (AC9)", () => {
    const a = simulateBattle([player, enemy], new SeededRng(2026));
    const b = simulateBattle([player, enemy], new SeededRng(2026));
    expect(a.outcome).toBe(b.outcome);
    expect(a.rounds).toBe(b.rounds);
    expect(a.log).toEqual(b.log);
  });

  it("different seeds can produce different logs", () => {
    // Give both sides a crit chance so RNG actually influences the fight.
    const p = { ...player, critChance: 0.5 };
    const e = { ...enemy, critChance: 0.5 };
    const a = simulateBattle([p, e], new SeededRng(1));
    const b = simulateBattle([p, e], new SeededRng(99999));
    expect(a.log).not.toEqual(b.log);
  });

  it("the stronger side wins and the victory condition is evaluated (AC10)", () => {
    const res = simulateBattle([player, enemy], new SeededRng(7));
    expect(res.outcome).toBe(BattleOutcome.PLAYER);
    // Enemy must be dead; the last log entry that targets it leaves hp 0.
    const lastHitOnEnemy = [...res.log].reverse().find((e) => e.defenderId === "ogre");
    expect(lastHitOnEnemy!.defenderHpAfter).toBe(0);
  });

  it("developed units translate tech advantage into combat power", () => {
    // A tech-buffed unit vs a plain one of the same base: the buffed side wins.
    const base = { attack: 6, defense: 6, health: 40, speed: 3, initiative: 5 };
    const strong = new Unit({ id: "strong", name: "s", subject: Subject.MATEMATIKA, base });
    strong.addBonus({ id: "atk+", stat: "attack", op: BonusOp.ADD, value: 10, source: "tech" });
    const weak = new Unit({ id: "weak", name: "w", subject: Subject.MATEMATIKA, base });

    const res = simulateBattle(
      [
        combatantFromUnit(strong, BattleSide.PLAYER),
        combatantFromUnit(weak, BattleSide.ENEMY),
      ],
      new SeededRng(3),
    );
    expect(res.outcome).toBe(BattleOutcome.PLAYER);
  });

  // Negative / safety tests.
  it("rejects an empty battle and duplicate ids", () => {
    expect(() => simulateBattle([], new SeededRng(1))).toThrow(RangeError);
    expect(() => simulateBattle([player, { ...enemy, id: "golem" }], new SeededRng(1))).toThrow(TypeError);
  });

  it("rejects an out-of-range crit chance", () => {
    expect(() =>
      simulateBattle([{ ...player, critChance: 2 }, enemy], new SeededRng(1)),
    ).toThrow(RangeError);
  });

  it("terminates at the round cap without hanging", () => {
    // Two near-invincible combatants (huge defense, tiny attack) would never
    // resolve; the cap must stop them and return a decided-by-HP outcome.
    const tank = (id: string, side: BattleSide): CombatantInit => ({
      id,
      side,
      stats: { attack: 1, defense: 100, health: 1000, speed: 1, initiative: 1 },
    });
    const res = simulateBattle([tank("a", BattleSide.PLAYER), tank("b", BattleSide.ENEMY)], new SeededRng(1), 10);
    expect(res.rounds).toBe(10);
    expect([BattleOutcome.PLAYER, BattleOutcome.ENEMY, BattleOutcome.DRAW]).toContain(res.outcome);
  });
});
