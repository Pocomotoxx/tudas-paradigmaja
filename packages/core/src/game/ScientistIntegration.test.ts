import { describe, it, expect } from "vitest";
import { Subject } from "../economy/KKLedger.js";
import { BonusOp } from "../units/BonusSystem.js";
import { DifficultyTier } from "../education/QuestionBank.js";
import { FOREIGN } from "../heroes/Scientist.js";
import { Game } from "./Game.js";
import type { ScenarioDef } from "./Scenario.js";

function scenario(): ScenarioDef {
  const tiles = [];
  for (let q = -1; q <= 1; q++) for (let r = -1; r <= 1; r++) if (Math.abs(-q - r) <= 1) tiles.push({ q, r });
  return {
    id: "sci-01",
    tiles,
    heroStart: { q: 0, r: 0 },
    tokenBuilding: { q: 1, r: 0 },
    tokensPerTurn: 2,
    tokenCap: 50,
    tokenCostPerTest: 1,
    playerSubject: Subject.MATEMATIKA,
    playerUnit: { id: "golem", name: "Gólem", subject: Subject.MATEMATIKA, base: { attack: 6, defense: 10, health: 50, speed: 4, initiative: 5 } },
    enemy: { id: "guard", stats: { attack: 5, defense: 4, health: 60, speed: 2, initiative: 3 } },
    techNodes: [],
    questions: [{ id: "m1", subject: Subject.MATEMATIKA, topic: "t", b: 0, tier: DifficultyTier.SZAKERTO }],
    knowledgeCenters: [{ id: "egyetem", subject: Subject.MATEMATIKA, hex: { q: 0, r: 0 }, stability: 100 }],
    scientists: [
      {
        id: "gauss",
        name: "Carl Friedrich Gauss",
        subject: Subject.MATEMATIKA,
        birthplaceLocationId: "egyetem", // owned center -> controlled
        cost: { subject: Subject.MATEMATIKA, kk: 2 },
        affinities: [
          { subject: Subject.MATEMATIKA, bonuses: [{ id: "g-atk", stat: "attack", op: BonusOp.ADD, value: 4, source: "gauss" }] },
          { subject: FOREIGN, bonuses: [{ id: "g-slow", stat: "speed", op: BonusOp.ADD, value: -1, source: "gauss" }] },
        ],
      },
      {
        id: "stranger",
        name: "Stranger",
        subject: Subject.MATEMATIKA,
        birthplaceLocationId: "nowhere", // not controlled
        cost: { subject: Subject.MATEMATIKA, kk: 0 },
        affinities: [{ subject: Subject.MATEMATIKA, bonuses: [] }, { subject: FOREIGN, bonuses: [] }],
      },
    ],
  };
}

function bankKK(game: Game): void {
  game.endTurn();
  game.enterAcademic();
  game.takeTest(Subject.MATEMATIKA, true); // SZAKERTO -> +3 KK
  game.leaveAcademic();
}

describe("Game — scientist hero integration (I23)", () => {
  it("hires a scientist at a controlled birthplace, spending KK", () => {
    const game = new Game(scenario(), 1);
    bankKK(game); // +3 math KK
    expect(game.isScientistHired("gauss")).toBe(false);
    game.hireScientist("gauss"); // cost 2
    expect(game.isScientistHired("gauss")).toBe(true);
    expect(game.kkOf(Subject.MATEMATIKA)).toBe(1); // 3 - 2
  });

  it("refuses to hire at an uncontrolled birthplace", () => {
    const game = new Game(scenario(), 1);
    expect(() => game.hireScientist("stranger")).toThrow(RangeError);
  });

  it("requires a hired scientist to lead", () => {
    const game = new Game(scenario(), 1);
    expect(() => game.setLeader("gauss")).toThrow(RangeError);
  });

  it("the leader's affinity changes the battle (bonus flows into combat)", () => {
    const withLeader = new Game(scenario(), 42);
    bankKK(withLeader);
    withLeader.hireScientist("gauss");
    withLeader.setLeader("gauss");
    const led = withLeader.fight();

    const noLeader = new Game(scenario(), 42);
    bankKK(noLeader);
    const plain = noLeader.fight();

    // Same seed, but the +4 attack buff changes the damage log.
    expect(led.log).not.toEqual(plain.log);
  });

  it("round-trips hired scientists and the leader through save/load", () => {
    const game = new Game(scenario(), 1);
    bankKK(game);
    game.hireScientist("gauss");
    game.setLeader("gauss");
    const s = game.save();
    const loaded = Game.load(s, scenario());
    expect(loaded.save()).toEqual(s);
    expect(loaded.isScientistHired("gauss")).toBe(true);
    expect(loaded.currentLeaderId).toBe("gauss");
  });

  it("rejects an unknown scientist", () => {
    const game = new Game(scenario(), 1);
    expect(() => game.hireScientist("ghost")).toThrow(RangeError);
  });
});
