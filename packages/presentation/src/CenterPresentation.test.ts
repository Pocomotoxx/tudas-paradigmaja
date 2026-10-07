import { describe, it, expect } from "vitest";
import { Subject } from "@tudas-paradigmaja/core";
import { runScriptedSession, type Command } from "./ScriptedSession.js";
import { renderCenters, renderFrame } from "./TextRenderer.js";
import { demoScenario, demoScenarioWithCenter } from "./demoScenario.js";

describe("presentation — knowledge-center status (I11)", () => {
  it("renderCenters shows stability, band and output", () => {
    const { game } = runScriptedSession(demoScenarioWithCenter(), 1, []);
    const panel = renderCenters(game);
    expect(panel).toContain("egyetem");
    expect(panel).toContain("stab=50");
    expect(panel).toContain("MID"); // 50/100 -> MID, output 2
  });

  it("reflects rebellion after failed maintenance", () => {
    const script: Command[] = [
      { type: "maintain", centerId: "egyetem", correct: false }, // 50 -> 25 (LOW)
      { type: "maintain", centerId: "egyetem", correct: false }, // 25 -> 0 -> rebelled
    ];
    const { game } = runScriptedSession(demoScenarioWithCenter(), 1, script);
    const panel = renderCenters(game);
    expect(panel).toContain("REBELLED");
    expect(game.centerRebelled("egyetem")).toBe(true);
  });

  it("maintenance raises stability and the panel shows the higher band", () => {
    const script: Command[] = [
      { type: "maintain", centerId: "egyetem", correct: true }, // 50 -> 70 (HIGH)
    ];
    const { game } = runScriptedSession(demoScenarioWithCenter(), 1, script);
    expect(game.centerStability("egyetem")).toBe(70);
    expect(renderCenters(game)).toContain("HIGH");
  });

  it("renderFrame includes the center panel only when centers exist", () => {
    const withCenter = runScriptedSession(demoScenarioWithCenter(), 1, []);
    expect(renderFrame(withCenter.game)).toContain("Centers:");
    const without = runScriptedSession(demoScenario(), 1, []);
    expect(renderFrame(without.game)).not.toContain("Centers:");
  });

  it("is deterministic for the same seed + script", () => {
    const script: Command[] = [{ type: "maintain", centerId: "egyetem", correct: true }];
    const a = runScriptedSession(demoScenarioWithCenter(), 3, script);
    const b = runScriptedSession(demoScenarioWithCenter(), 3, script);
    expect(a.game.save()).toEqual(b.game.save());
    void Subject;
  });
});
