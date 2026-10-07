// ScriptedSession — drives a Game through a list of commands and records a
// text transcript. This is how the presentation layer exercises the core: it
// only calls Game's public API, so it doubles as a reproducible end-to-end
// harness without any rendering-side state.

import { Game, Subject, type ScenarioDef } from "@tudas-paradigmaja/core";
import { renderStatus } from "./TextRenderer.js";

export type Command =
  | { readonly type: "move"; readonly to: { q: number; r: number } }
  | { readonly type: "endTurn" }
  | { readonly type: "enterAcademic" }
  | { readonly type: "leaveAcademic" }
  | { readonly type: "test"; readonly subject: Subject; readonly correct: boolean }
  | { readonly type: "research"; readonly nodeId: string }
  | { readonly type: "maintain"; readonly centerId: string; readonly correct: boolean }
  | { readonly type: "fight" };

export interface SessionResult {
  readonly game: Game;
  readonly transcript: readonly string[];
}

/** Apply `commands` to a fresh Game, capturing a status line after each step. */
export function runScriptedSession(
  scenario: ScenarioDef,
  seed: number,
  commands: readonly Command[],
): SessionResult {
  const game = new Game(scenario, seed);
  const transcript: string[] = [`[start] ${renderStatus(game).split("\n")[0]}`];

  for (const cmd of commands) {
    switch (cmd.type) {
      case "move":
        game.moveHero(cmd.to);
        break;
      case "endTurn":
        game.endTurn();
        break;
      case "enterAcademic":
        game.enterAcademic();
        break;
      case "leaveAcademic":
        game.leaveAcademic();
        break;
      case "test":
        game.takeTest(cmd.subject, cmd.correct);
        break;
      case "research":
        game.research(cmd.nodeId);
        break;
      case "maintain":
        game.startMaintenance(cmd.centerId);
        game.resolveMaintenance(cmd.correct);
        break;
      case "fight":
        game.fight();
        break;
      default: {
        // Exhaustiveness guard.
        const _never: never = cmd;
        throw new Error(`Unknown command: ${JSON.stringify(_never)}`);
      }
    }
    transcript.push(`[${cmd.type}] ${renderStatus(game).split("\n").slice(0, 2).join(" | ")}`);
  }

  return { game, transcript };
}
