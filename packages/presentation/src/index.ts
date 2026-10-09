// @tudas-paradigmaja/presentation — a thin, swappable text presentation layer.

export { renderMap, renderStatus, renderCenters, renderScientists, renderFrame } from "./TextRenderer.js";
export { runScriptedSession } from "./ScriptedSession.js";
export type { Command, SessionResult } from "./ScriptedSession.js";
export {
  demoScenario,
  demoScenarioWithCenter,
  demoScenarioWithCapture,
} from "./demoScenario.js";
export { europeLocations, europeScenario, europeHeroesScenario, renderWorldMap } from "./europe.js";
export type { EuropeScenario } from "./europe.js";
export { scientistsPack, scientistBirthLabels } from "./scientistsPack.js";
export {
  defaultLayout,
  hexToPixel,
  drawOrder,
  hexCorners,
} from "./hexProjection.js";
export type { HexLayout, PixelPoint } from "./hexProjection.js";
