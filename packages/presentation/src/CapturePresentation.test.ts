import { describe, it, expect } from "vitest";
import { Difficulty } from "@tudas-paradigmaja/core";
import { runScriptedSession, type Command } from "./ScriptedSession.js";
import { renderCenters } from "./TextRenderer.js";
import { demoScenarioWithCapture } from "./demoScenario.js";

describe("presentation — capture status (I14)", () => {
  it("shows UNCAPTURED for a capture-required center before capture", () => {
    const { game } = runScriptedSession(demoScenarioWithCapture(), 1, []);
    expect(game.isCenterCaptured("var")).toBe(false);
    expect(renderCenters(game)).toContain("UNCAPTURED");
  });

  it("a successful capture command flips the panel to a stability band", () => {
    const script: Command[] = [
      {
        type: "capture",
        centerId: "var",
        startMs: 0,
        answers: [
          { correct: true, atMs: 100 },
          { correct: true, atMs: 200 },
          { correct: true, atMs: 300 },
        ],
      },
    ];
    const { game } = runScriptedSession(demoScenarioWithCapture(), 1, script);
    expect(game.isCenterCaptured("var")).toBe(true);
    const panel = renderCenters(game);
    expect(panel).not.toContain("UNCAPTURED");
    expect(panel).toContain("HIGH"); // stability 100 once captured
  });

  it("level 1 is untimed: slow answers still capture the center", () => {
    const script: Command[] = [
      {
        type: "capture",
        centerId: "var",
        startMs: 0,
        answers: [
          { correct: true, atMs: 100 },
          { correct: true, atMs: 20000 }, // would have been past the old 10s window
          { correct: true, atMs: 20001 },
        ],
      },
    ];
    const { game } = runScriptedSession(demoScenarioWithCapture(), 1, script);
    expect(game.isCenterCaptured("var")).toBe(true); // no timer at level 1
  });

  it("level 4: a 10s per-question countdown leaves the center UNCAPTURED", () => {
    const script: Command[] = [
      {
        type: "capture",
        centerId: "var",
        startMs: 0,
        answers: [
          { correct: true, atMs: 100 },
          { correct: true, atMs: 12000 }, // past the 10s per-question limit
          { correct: true, atMs: 12001 },
        ],
      },
    ];
    const { game } = runScriptedSession(demoScenarioWithCapture(Difficulty.FOUR), 1, script);
    expect(game.isCenterCaptured("var")).toBe(false);
    expect(renderCenters(game)).toContain("UNCAPTURED");
  });

  it("is deterministic for the same seed + script", () => {
    const script: Command[] = [
      { type: "capture", centerId: "var", startMs: 0, answers: [
        { correct: true, atMs: 10 }, { correct: true, atMs: 20 }, { correct: true, atMs: 30 },
      ] },
    ];
    const a = runScriptedSession(demoScenarioWithCapture(), 7, script);
    const b = runScriptedSession(demoScenarioWithCapture(), 7, script);
    expect(a.game.save()).toEqual(b.game.save());
  });
});
