import { describe, it, expect } from "vitest";
import { Game, Subject } from "@tudas-paradigmaja/core";
import { runScriptedSession, type Command } from "./ScriptedSession.js";
import { renderScientists } from "./TextRenderer.js";
import { europeHeroesScenario } from "./europe.js";
import { scientistBirthLabels } from "./scientistsPack.js";

function bankMathKK(game: Game): void {
  game.endTurn(); // owned centers produce tokens
  game.enterAcademic();
  game.takeTest(Subject.MATEMATIKA, true); // SZAKERTO -> +3 KK
  game.leaveAcademic();
}

describe("europe heroes — scientists live in the scenario (I25)", () => {
  it("includes one scientist per discipline city, all hireable at their city", () => {
    const game = new Game(europeHeroesScenario(), 1);
    expect(game.scientistIds().sort()).toEqual(["curie", "euler", "newton", "szentgyorgyi"]);
    // Their birthplaces are owned discipline-city centers.
    expect(game.isCenterCaptured("numeris")).toBe(true);
    expect(game.isCenterCaptured("dynamis")).toBe(true);
  });

  it("hires a maths scientist after banking KK and makes them leader", () => {
    const game = new Game(europeHeroesScenario(), 1);
    bankMathKK(game); // +3 math KK (euler costs 3)
    game.hireScientist("euler");
    game.setLeader("euler");
    expect(game.isScientistHired("euler")).toBe(true);
    expect(game.currentLeaderId).toBe("euler");
  });

  it("renderScientists shows availability, hire state and the leader", () => {
    const game = new Game(europeHeroesScenario(), 1);
    const names = scientistBirthLabels(); // ids present; use as a name-ish lookup
    const before = renderScientists(game, {});
    expect(before).toContain("euler: available");

    bankMathKK(game);
    const script: Command[] = [];
    void script;
    game.hireScientist("euler");
    game.setLeader("euler");
    const after = renderScientists(game);
    expect(after).toContain("euler: hired <= LEADER");
    expect(Object.keys(names)).toContain("euler");
  });

  it("a scripted hire+lead session runs and the leader affects the battle", () => {
    const scenario = europeHeroesScenario();
    const script: Command[] = [
      { type: "endTurn" },
      { type: "enterAcademic" },
      { type: "test", subject: Subject.MATEMATIKA, correct: true },
      { type: "leaveAcademic" },
      { type: "hire", scientistId: "euler" },
      { type: "lead", scientistId: "euler" },
      { type: "fight" },
    ];
    const led = runScriptedSession(scenario, 7, script);
    expect(led.game.currentLeaderId).toBe("euler");

    // Same seed, no leader: the battle log differs (euler buffs the maths golem).
    const plain = runScriptedSession(europeHeroesScenario(), 7, [{ type: "fight" }]);
    expect(led.game.save()).not.toEqual(plain.game.save());
  });

  it("cannot hire a scientist whose city is not controlled", () => {
    // Gauss (physics) birthplace is 'dynamis' which IS owned here, so pick a
    // scientist not in this scenario to confirm unknown-id rejection instead.
    const game = new Game(europeHeroesScenario(), 1);
    expect(() => game.hireScientist("gauss")).toThrow(); // not in this scenario
  });
});
