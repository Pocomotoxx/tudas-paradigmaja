// TextRenderer — a pure, string-producing view of the game state.
//
// The presentation layer is deliberately thin and swappable: it reads the
// Game's public API and returns strings. It performs NO console I/O itself
// (that lives at the very edge, in a CLI entry point), so it stays testable
// and the core stays I/O-free. A canvas/DOM renderer could replace this module
// without touching the core.

import { Game, Subject, ALL_SUBJECTS, type Stat } from "@tudas-paradigmaja/core";

const STAT_ORDER: readonly Stat[] = ["attack", "defense", "health", "speed", "initiative"];

/** Render a compact ASCII map with the hero (@), token building ($) and blocked (#) tiles. */
export function renderMap(game: Game): string {
  const tiles = game.mapTiles();
  const hero = game.heroAt();
  const building = game.tokenBuildingAt();
  const qs = tiles.map((t) => t.q);
  const rs = tiles.map((t) => t.r);
  const minQ = Math.min(...qs), maxQ = Math.max(...qs);
  const minR = Math.min(...rs), maxR = Math.max(...rs);
  const present = new Map(tiles.map((t) => [`${t.q},${t.r}`, t]));

  const lines: string[] = [];
  for (let r = minR; r <= maxR; r++) {
    // Offset each row to suggest a hex grid.
    let row = " ".repeat(r - minR);
    for (let q = minQ; q <= maxQ; q++) {
      const t = present.get(`${q},${r}`);
      if (t === undefined) {
        row += "  ";
        continue;
      }
      let cell = ".";
      if (t.blocked) cell = "#";
      if (q === building.q && r === building.r) cell = "$";
      if (q === hero.q && r === hero.r) cell = "@";
      row += cell + " ";
    }
    lines.push(row.replace(/\s+$/, ""));
  }
  return lines.join("\n");
}

/** Render the status panel (phase, turn, economy, unit stats, outcome). */
export function renderStatus(game: Game): string {
  const stats = game.unitStats();
  const kkParts = ALL_SUBJECTS
    .map((s: Subject) => `${s}=${game.kkOf(s)}`)
    .filter((p) => !p.endsWith("=0"));
  const statLine = STAT_ORDER.map((s) => `${s}:${stats[s]}`).join(" ");
  const lines = [
    `Scenario: ${game.scenarioId}  Turn: ${game.turn}  Phase: ${game.currentPhase}`,
    `Hero: (${game.heroAt().q}, ${game.heroAt().r})  Tokens: ${game.tokenBalance}`,
    `KK: ${kkParts.length > 0 ? kkParts.join(" ") : "—"}`,
    `Unit: ${statLine}`,
    `Outcome: ${game.outcome ?? "—"}${game.won ? "  *** WIN ***" : ""}`,
  ];
  return lines.join("\n");
}

function bandLabel(output: number, rebelled: boolean): string {
  if (rebelled) return "REBELLED";
  if (output >= 3) return "HIGH";
  if (output >= 2) return "MID";
  if (output >= 1) return "LOW";
  return "REBELLED";
}

/** Render the knowledge-center panel (stability, band, output, due check). */
export function renderCenters(game: Game): string {
  if (!game.hasCenters) return "";
  const due = new Set(game.maintenanceDueIds());
  const lines = game.centerIds().map((id) => {
    if (!game.isCenterCaptured(id)) {
      return `  ${id}: UNCAPTURED (needs 3-question capture)`;
    }
    const reb = game.centerRebelled(id);
    const out = game.centerTokenOutput(id);
    return (
      `  ${id}: stab=${game.centerStability(id)} ` +
      `out=${out} ${bandLabel(out, reb)}` +
      `${due.has(id) ? " [check due]" : ""}`
    );
  });
  return `Centers:\n${lines.join("\n")}`;
}

/** Full frame: map, status, and (when present) the center panel. */
export function renderFrame(game: Game): string {
  const centers = renderCenters(game);
  return `${renderMap(game)}\n\n${renderStatus(game)}${centers ? `\n\n${centers}` : ""}`;
}
