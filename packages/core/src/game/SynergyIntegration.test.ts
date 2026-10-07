import { describe, it, expect } from "vitest";
import { Subject } from "../economy/KKLedger.js";
import { BonusOp } from "../units/BonusSystem.js";
import { DifficultyTier } from "../education/QuestionBank.js";
import { Game } from "./Game.js";
import type { ScenarioDef } from "./Scenario.js";

function scenario(): ScenarioDef {
  const tiles = [];
  for (let q = -1; q <= 1; q++) for (let r = -1; r <= 1; r++) if (Math.abs(-q - r) <= 1) tiles.push({ q, r });
  return {
    id: "syn-01",
    tiles,
    heroStart: { q: 0, r: 0 },
    tokenBuilding: { q: 1, r: 0 },
    tokensPerTurn: 2,
    tokenCap: 50,
    tokenCostPerTest: 1,
    playerSubject: Subject.MATEMATIKA,
    playerUnit: { id: "golem", name: "Gólem", subject: Subject.MATEMATIKA, base: { attack: 6, defense: 10, health: 50, speed: 3, initiative: 5 } },
    enemy: { id: "guard", stats: { attack: 5, defense: 4, health: 60, speed: 2, initiative: 3 } },
    techNodes: [],
    questions: [
      { id: "bio1", subject: Subject.BIOLOGIA, topic: "t", b: 0, tier: DifficultyTier.SZAKERTO },
      { id: "kem1", subject: Subject.KEMIA, topic: "t", b: 0, tier: DifficultyTier.SZAKERTO },
    ],
    knowledgeCenters: [{ id: "hub", subject: Subject.MATEMATIKA, hex: { q: 0, r: 0 }, stability: 100 }],
    synergies: [
      {
        id: "biochem",
        name: "Biokémiai fegyverzet",
        requires: [
          { subject: Subject.BIOLOGIA, kk: 3 },
          { subject: Subject.KEMIA, kk: 3 },
        ],
        cost: [
          { subject: Subject.BIOLOGIA, kk: 2 },
          { subject: Subject.KEMIA, kk: 2 },
        ],
        unlocks: "ability:biochemical-ordnance",
        armyBonuses: [{ id: "biochem-atk", stat: "attack", op: BonusOp.ADD, value: 5, source: "biochem" }],
      },
    ],
  };
}

/** Bank 3 Biológia + 3 Kémia KK in one academic phase. */
function bankBioKem(game: Game): void {
  game.endTurn(); // hub produces tokens
  game.enterAcademic();
  game.takeTest(Subject.BIOLOGIA, true); // +3
  game.takeTest(Subject.KEMIA, true); // +3
  game.leaveAcademic();
}

describe("Game — synergy integration (I26)", () => {
  it("lists synergies and gates unlocking on mastery", () => {
    const game = new Game(scenario(), 1);
    expect(game.synergyIds()).toEqual(["biochem"]);
    expect(game.canUnlockSynergy("biochem")).toBe(false); // no KK
    bankBioKem(game);
    expect(game.canUnlockSynergy("biochem")).toBe(true);
  });

  it("unlocking spends KK in both subjects and records it", () => {
    const game = new Game(scenario(), 1);
    bankBioKem(game);
    game.unlockSynergy("biochem");
    expect(game.isSynergyUnlocked("biochem")).toBe(true);
    expect(game.kkOf(Subject.BIOLOGIA)).toBe(1); // 3 - 2
    expect(game.kkOf(Subject.KEMIA)).toBe(1);
  });

  it("an unlocked synergy's army bonus changes the battle", () => {
    const withSyn = new Game(scenario(), 9);
    bankBioKem(withSyn);
    withSyn.unlockSynergy("biochem");
    const a = withSyn.fight();

    const without = new Game(scenario(), 9);
    bankBioKem(without);
    const b = without.fight();

    expect(a.log).not.toEqual(b.log); // +5 attack army-wide changes damage
  });

  it("round-trips unlocked synergies through save/load", () => {
    const game = new Game(scenario(), 1);
    bankBioKem(game);
    game.unlockSynergy("biochem");
    const s = game.save();
    const loaded = Game.load(s, scenario());
    expect(loaded.save()).toEqual(s);
    expect(loaded.isSynergyUnlocked("biochem")).toBe(true);
  });

  // Negative tests.
  it("refuses to unlock without the mastery KK, and rejects double unlock", () => {
    const game = new Game(scenario(), 1);
    expect(() => game.unlockSynergy("biochem")).toThrow(RangeError); // no KK
    bankBioKem(game);
    game.unlockSynergy("biochem");
    expect(() => game.unlockSynergy("biochem")).toThrow(RangeError); // already unlocked
  });
});
