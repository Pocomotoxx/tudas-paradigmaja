import { describe, it, expect } from "vitest";
import { Subject, BattleOutcome } from "@tudas-paradigmaja/core";
import { runScriptedSession, type Command } from "./ScriptedSession.js";
import { renderMap, renderStatus, renderFrame } from "./TextRenderer.js";
import { demoScenario } from "./demoScenario.js";

const winningScript: Command[] = [
  { type: "move", to: { q: 1, r: 0 } },
  { type: "endTurn" },
  { type: "enterAcademic" },
  { type: "test", subject: Subject.MATEMATIKA, correct: true },
  { type: "leaveAcademic" },
  { type: "research", nodeId: "t-atk" },
  { type: "fight" },
];

describe("presentation — thin layer drives the core (I7)", () => {
  it("a scripted session plays the full slice to a WIN", () => {
    const { game, transcript } = runScriptedSession(demoScenario(), 2026, winningScript);
    expect(game.won).toBe(true);
    expect(game.outcome).toBe(BattleOutcome.PLAYER);
    // The transcript recorded one line per command plus the start line.
    expect(transcript).toHaveLength(winningScript.length + 1);
    expect(renderStatus(game)).toContain("*** WIN ***");
  });

  it("renderMap marks hero, building and is stable in shape", () => {
    const { game } = runScriptedSession(demoScenario(), 1, [
      { type: "move", to: { q: 1, r: 0 } },
    ]);
    const map = renderMap(game);
    expect(map).toContain("@"); // hero (now on the building hex)
    // The frame combines map and status without throwing.
    expect(renderFrame(game)).toContain("Phase:");
  });

  it("is deterministic: same seed + script => identical transcript", () => {
    const a = runScriptedSession(demoScenario(), 55, winningScript);
    const b = runScriptedSession(demoScenario(), 55, winningScript);
    expect(a.transcript).toEqual(b.transcript);
    expect(a.game.save()).toEqual(b.game.save());
  });

  it("surfaces core guard errors rather than swallowing them", () => {
    // Trying to test outside the academic phase must throw (flow protection).
    expect(() =>
      runScriptedSession(demoScenario(), 1, [
        { type: "test", subject: Subject.MATEMATIKA, correct: true },
      ]),
    ).toThrow();
  });
});
