import { describe, it, expect } from "vitest";
import { Subject } from "../economy/KKLedger.js";
import { DifficultyTier } from "../education/QuestionBank.js";
import { CaptureStatus } from "../capture/CaptureGate.js";
import { Game } from "./Game.js";
import type { ScenarioDef } from "./Scenario.js";

function scenario(): ScenarioDef {
  const tiles = [];
  for (let q = -1; q <= 1; q++) for (let r = -1; r <= 1; r++) if (Math.abs(-q - r) <= 1) tiles.push({ q, r });
  return {
    id: "cap-01",
    tiles,
    heroStart: { q: 0, r: 0 },
    tokenBuilding: { q: 1, r: 0 },
    tokensPerTurn: 2,
    tokenCap: 50,
    tokenCostPerTest: 1,
    playerSubject: Subject.MATEMATIKA,
    playerUnit: {
      id: "golem",
      name: "Kalkulus-gólem",
      subject: Subject.MATEMATIKA,
      base: { attack: 6, defense: 10, health: 50, speed: 3, initiative: 5 },
    },
    enemy: { id: "guard", stats: { attack: 5, defense: 4, health: 30, speed: 2, initiative: 3 } },
    techNodes: [],
    questions: [
      { id: "m1", subject: Subject.MATEMATIKA, topic: "t", b: 0, tier: DifficultyTier.ALAP },
      { id: "m2", subject: Subject.MATEMATIKA, topic: "t", b: 1, tier: DifficultyTier.ALAP },
      { id: "m3", subject: Subject.MATEMATIKA, topic: "t", b: 2, tier: DifficultyTier.ALAP },
      { id: "m4", subject: Subject.MATEMATIKA, topic: "t", b: 3, tier: DifficultyTier.ALAP },
    ],
    knowledgeCenters: [
      {
        id: "var",
        subject: Subject.MATEMATIKA,
        hex: { q: 0, r: 0 },
        stability: 100,
        requiresCapture: true,
        captureWindowMs: 10000,
        captureRequiredCorrect: 3,
      },
    ],
  };
}

describe("Game — capture-gate integration (I13)", () => {
  it("an uncaptured center produces nothing and cannot be maintained", () => {
    const game = new Game(scenario(), 1);
    expect(game.isCenterCaptured("var")).toBe(false);
    game.endTurn();
    expect(game.tokenBalance).toBe(0); // no production until captured
    expect(() => game.startMaintenance("var")).toThrow();
  });

  it("capturing via 3 correct answers in time grants control and production", () => {
    const game = new Game(scenario(), 1);
    game.beginCapture("var", 0);
    expect(game.submitCapture(true, 100).captured).toBe(false); // 1/3
    expect(game.submitCapture(true, 200).captured).toBe(false); // 2/3
    const res = game.submitCapture(true, 300); // 3/3
    expect(res.status).toBe(CaptureStatus.SUCCESS);
    expect(res.captured).toBe(true);
    expect(game.isCenterCaptured("var")).toBe(true);

    game.endTurn();
    expect(game.tokenBalance).toBe(3); // HIGH stability now produces
    expect(() => game.startMaintenance("var")).not.toThrow();
  });

  it("a timed-out capture does not grant control", () => {
    const game = new Game(scenario(), 1);
    game.beginCapture("var", 0);
    game.submitCapture(true, 100); // 1/3
    const res = game.submitCapture(true, 20000); // past the 10s window
    expect(res.status).toBe(CaptureStatus.TIMED_OUT);
    expect(res.captured).toBe(false);
    expect(game.isCenterCaptured("var")).toBe(false);
  });

  it("round-trips captured state through save/load", () => {
    const game = new Game(scenario(), 1);
    game.beginCapture("var", 0);
    game.submitCapture(true, 10);
    game.submitCapture(true, 20);
    game.submitCapture(true, 30); // captured
    const s = game.save();
    const loaded = Game.load(s, scenario());
    expect(loaded.save()).toEqual(s);
    expect(loaded.isCenterCaptured("var")).toBe(true);
  });

  // Negative tests.
  it("rejects capturing a non-capture center and double capture flows", () => {
    const game = new Game(scenario(), 1);
    expect(() => game.submitCapture(true, 0)).toThrow(); // no capture in progress
    game.beginCapture("var", 0);
    expect(() => game.beginCapture("var", 1)).toThrow(); // already in progress
  });
});
