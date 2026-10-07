// @tudas-paradigmaja/presentation — a thin, swappable text presentation layer.

export { renderMap, renderStatus, renderCenters, renderFrame } from "./TextRenderer.js";
export { runScriptedSession } from "./ScriptedSession.js";
export type { Command, SessionResult } from "./ScriptedSession.js";
export {
  demoScenario,
  demoScenarioWithCenter,
  demoScenarioWithCapture,
} from "./demoScenario.js";
