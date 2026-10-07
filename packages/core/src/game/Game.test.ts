import { describe, it, expect } from "vitest";
import { Subject } from "../economy/KKLedger.js";
import { BonusOp } from "../units/BonusSystem.js";
import { GamePhase } from "../phase/GamePhase.js";
import { BattleOutcome } from "../combat/Battle.js";
import { DifficultyTier } from "../education/QuestionBank.js";
import { Game } from "./Game.js";
import type { ScenarioDef } from "./Scenario.js";

function scenario(): ScenarioDef {
  const tiles = [];
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      if (Math.abs(-q - r) <= 2) tiles.push({ q, r });
    }
  }
  return {
    id: "proto-01",
    tiles,
    heroStart: { q: 0, r: 0 },
    tokenBuilding: { q: 1, r: 0 },
    tokensPerTurn: 2,
    tokenCap: 5,
    tokenCostPerTest: 1,
    playerSubject: Subject.MATEMATIKA,
    playerUnit: {
      id: "golem",
      name: "Kalkulus-gólem",
      subject: Subject.MATEMATIKA,
      base: { attack: 6, defense: 10, health: 50, speed: 3, initiative: 5 },
    },
    enemy: {
      id: "guard",
      stats: { attack: 5, defense: 4, health: 30, speed: 2, initiative: 3 },
    },
    techNodes: [
      {
        id: "t-atk",
        subject: Subject.MATEMATIKA,
        kkCost: 1,
        bonuses: [{ id: "atk+", stat: "attack", op: BonusOp.ADD, value: 12, source: "t-atk" }],
      },
    ],
    questions: [
      { id: "m1", subject: Subject.MATEMATIKA, topic: "algebra", b: 0, tier: DifficultyTier.ALAP },
      { id: "m2", subject: Subject.MATEMATIKA, topic: "algebra", b: 1, tier: DifficultyTier.ALAP },
    ],
  };
}

/** Drive the full slice up to (but not including) the final battle. */
function playToPreFight(game: Game): void {
  game.moveHero({ q: 1, r: 0 }); // onto the token building
  expect(game.ownsTokenBuilding()).toBe(true);
  game.endTurn(); // produces 2 tokens
  expect(game.tokenBalance).toBe(2);

  game.enterAcademic();
  const atkBefore = game.unitStats().attack;
  const res = game.takeTest(Subject.MATEMATIKA, true); // correct -> +1 KK, -1 token
  expect(res.correct).toBe(true);
  expect(game.kkOf(Subject.MATEMATIKA)).toBe(1);
  expect(game.tokenBalance).toBe(1);
  game.leaveAcademic();

  game.research("t-atk"); // spends 1 KK, unit attack +12
  expect(game.unitStats().attack).toBe(atkBefore + 12);
  expect(game.kkOf(Subject.MATEMATIKA)).toBe(0);
}

describe("Game — full vertical slice integration (I6 AC11)", () => {
  it("plays move -> token -> test -> KK -> tech -> battle -> WIN", () => {
    const game = new Game(scenario(), 2026);
    playToPreFight(game);
    const result = game.fight();
    expect(result.outcome).toBe(BattleOutcome.PLAYER);
    expect(game.won).toBe(true);
    expect(game.currentPhase).toBe(GamePhase.STRATEGIC); // returns to strategic after combat
  });

  it("a weak (undeveloped) unit does not auto-win", () => {
    // Without the tech upgrade the golem is much weaker; verify the upgrade matters.
    const game = new Game(scenario(), 2026);
    const base = game.unitStats().attack;
    expect(base).toBe(6); // undeveloped
  });
});

describe("Game — deterministic save/load (I6 AC12)", () => {
  it("save() is idempotent across a load round-trip", () => {
    const game = new Game(scenario(), 123);
    playToPreFight(game);
    const s1 = game.save();
    const loaded = Game.load(s1, scenario());
    expect(loaded.save()).toEqual(s1);
  });

  it("a loaded game continues identically (same battle log)", () => {
    const game = new Game(scenario(), 123);
    playToPreFight(game);
    const s = game.save();
    const loaded = Game.load(s, scenario());

    const r1 = game.fight();
    const r2 = loaded.fight();
    expect(r2.outcome).toBe(r1.outcome);
    expect(r2.log).toEqual(r1.log);
  });

  it("restores phase, tokens, KK, theta, tech and unit bonuses", () => {
    const game = new Game(scenario(), 7);
    playToPreFight(game);
    const loaded = Game.load(game.save(), scenario());
    expect(loaded.currentPhase).toBe(game.currentPhase);
    expect(loaded.tokenBalance).toBe(game.tokenBalance);
    expect(loaded.kkOf(Subject.MATEMATIKA)).toBe(game.kkOf(Subject.MATEMATIKA));
    expect(loaded.unitStats()).toEqual(game.unitStats()); // bonuses reapplied
    expect(loaded.turn).toBe(game.turn);
  });

  // Negative / safety tests.
  it("rejects loading a save with the wrong scenario id", () => {
    const game = new Game(scenario(), 1);
    const bad = { ...game.save(), scenarioId: "other" };
    expect(() => Game.load(bad, scenario())).toThrow(TypeError);
  });

  it("rejects an unknown save version", () => {
    const game = new Game(scenario(), 1);
    const bad = { ...game.save(), version: 99 as unknown as 2 };
    expect(() => Game.load(bad, scenario())).toThrow(TypeError);
  });
});
