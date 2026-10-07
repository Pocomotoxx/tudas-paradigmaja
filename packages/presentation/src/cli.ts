// cli.ts — the single edge that performs console I/O. Everything it calls is
// pure; this file is intentionally not unit-tested (it only prints).
//
// Run (after build): node packages/presentation/dist/cli.js

import { Subject } from "@tudas-paradigmaja/core";
import { renderFrame } from "./TextRenderer.js";
import { runScriptedSession, type Command } from "./ScriptedSession.js";
import { demoScenario } from "./demoScenario.js";

const script: Command[] = [
  { type: "move", to: { q: 1, r: 0 } },
  { type: "endTurn" },
  { type: "enterAcademic" },
  { type: "test", subject: Subject.MATEMATIKA, correct: true },
  { type: "leaveAcademic" },
  { type: "research", nodeId: "t-atk" },
  { type: "fight" },
];

function main(): void {
  const { game, transcript } = runScriptedSession(demoScenario(), 2026, script);
  // eslint-disable-next-line no-console
  console.log(transcript.join("\n"));
  // eslint-disable-next-line no-console
  console.log("\n" + renderFrame(game));
}

main();
