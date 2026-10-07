import { describe, it, expect } from "vitest";
import { Subject } from "../economy/KKLedger.js";
import { BonusOp } from "../units/BonusSystem.js";
import { DifficultyTier } from "../education/QuestionBank.js";
import { CaptureStatus } from "../capture/CaptureGate.js";
import { Game } from "./Game.js";
import type { ScenarioDef } from "./Scenario.js";

function scenario(): ScenarioDef {
  const tiles = [];
  for (let q = -1; q <= 1; q++) for (let r = -1; r <= 1; r++) if (Math.abs(-q - r) <= 1) tiles.push({ q, r });
  return {
    id: "art-01",
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
      { id: "m1", subject: Subject.MATEMATIKA, topic: "t", b: 0, tier: DifficultyTier.ALAP },
      { id: "m2", subject: Subject.MATEMATIKA, topic: "t", b: 1, tier: DifficultyTier.ALAP },
      { id: "m3", subject: Subject.MATEMATIKA, topic: "t", b: 2, tier: DifficultyTier.ALAP },
    ],
    artifacts: [
      {
        id: "orb",
        name: "Orb of Insight",
        armyBonuses: [{ id: "orb-atk", stat: "attack", op: BonusOp.ADD, value: 4, source: "orb" }],
      },
      {
        id: "relic",
        name: "Relic of Numeris",
        armyBonuses: [{ id: "relic-def", stat: "defense", op: BonusOp.ADD, value: 3, source: "relic" }],
        capture: { subject: Subject.MATEMATIKA, windowMs: 10000, requiredCorrect: 3 },
      },
    ],
  };
}

describe("Game — artifact integration (I27)", () => {
  it("acquires a direct (non-capture) artifact", () => {
    const game = new Game(scenario(), 1);
    expect(game.artifactIds().sort()).toEqual(["orb", "relic"]);
    expect(game.isArtifactHeld("orb")).toBe(false);
    game.acquireArtifact("orb");
    expect(game.isArtifactHeld("orb")).toBe(true);
  });

  it("requires the capture gate for a capture artifact", () => {
    const game = new Game(scenario(), 1);
    expect(() => game.acquireArtifact("relic")).toThrow(RangeError); // must be captured
    game.beginArtifactCapture("relic", 0);
    game.submitArtifactCapture(true, 100);
    game.submitArtifactCapture(true, 200);
    const r = game.submitArtifactCapture(true, 300);
    expect(r.status).toBe(CaptureStatus.SUCCESS);
    expect(r.held).toBe(true);
    expect(game.isArtifactHeld("relic")).toBe(true);
  });

  it("a timed-out capture does not grant the artifact", () => {
    const game = new Game(scenario(), 1);
    game.beginArtifactCapture("relic", 0);
    const r = game.submitArtifactCapture(true, 20000); // past the 10s window
    expect(r.status).toBe(CaptureStatus.TIMED_OUT);
    expect(game.isArtifactHeld("relic")).toBe(false);
  });

  it("a held artifact's army bonus changes the battle", () => {
    const withArt = new Game(scenario(), 9);
    withArt.acquireArtifact("orb");
    const a = withArt.fight();
    const without = new Game(scenario(), 9);
    const b = without.fight();
    expect(a.log).not.toEqual(b.log); // +4 attack army-wide
  });

  it("round-trips held artifacts through save/load", () => {
    const game = new Game(scenario(), 1);
    game.acquireArtifact("orb");
    const s = game.save();
    const loaded = Game.load(s, scenario());
    expect(loaded.save()).toEqual(s);
    expect(loaded.isArtifactHeld("orb")).toBe(true);
  });

  // Negative tests.
  it("rejects unknown artifacts and double acquisition", () => {
    const game = new Game(scenario(), 1);
    expect(() => game.acquireArtifact("ghost")).toThrow(RangeError);
    game.acquireArtifact("orb");
    expect(() => game.acquireArtifact("orb")).toThrow(RangeError);
  });
});
