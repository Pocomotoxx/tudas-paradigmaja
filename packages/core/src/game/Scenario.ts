// Scenario — static definition of a playable slice (G1: one scripted scenario).
//
// A scenario is pure data: the map, the player's starting unit, the token
// building, the enemy guard, the tech options, and the question bank. It is not
// serialized in a save (it is fixed content); a save references it by id and is
// reconstructed against the same scenario.

import type { Subject } from "../economy/KKLedger.js";
import type { HexCoord } from "../hex/Hex.js";
import type { UnitInit } from "../units/Unit.js";
import type { TechNode } from "../units/TechTree.js";
import type { CombatantInit } from "../combat/Battle.js";

export interface ScenarioDef {
  readonly id: string;
  /** Tiles for the HexMap. */
  readonly tiles: readonly { q: number; r: number; enterCost?: number; blocked?: boolean }[];
  readonly heroStart: HexCoord;
  /** Owning this hex at turn end produces tokens. */
  readonly tokenBuilding: HexCoord;
  readonly tokensPerTurn: number;
  readonly tokenCap: number;
  readonly tokenCostPerTest: number;
  readonly playerUnit: UnitInit;
  readonly playerSubject: Subject;
  readonly enemy: Omit<CombatantInit, "side">;
  readonly techNodes: readonly TechNode[];
  readonly questions: readonly unknown[];
}
