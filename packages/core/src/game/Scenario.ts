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
import type { KnowledgeCenterConfig } from "../knowledge/KnowledgeCenter.js";
import type { UnitTemplate } from "../units/Recruitment.js";
import type { ScientistDef } from "../heroes/Scientist.js";
import type { SynergyDef } from "../synergy/SynergyRegistry.js";
import type { ArtifactDef } from "../artifacts/Artifact.js";

export interface GarrisonPlacement {
  /** The military location this roster belongs to (id, free-form content). */
  readonly locationId: string;
  readonly templates: readonly UnitTemplate[];
}

export interface KnowledgeCenterPlacement {
  readonly id: string;
  readonly subject: Subject;
  readonly hex: HexCoord;
  readonly stability?: number;
  readonly config?: KnowledgeCenterConfig;
  /** If true, the center starts uncaptured and must be taken via the capture gate. */
  readonly requiresCapture?: boolean;
  /** Capture time window in ms (default 30000). */
  readonly captureWindowMs?: number;
  /** Correct answers required to capture (default 3). */
  readonly captureRequiredCorrect?: number;
}

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
  /**
   * Optional knowledge centers. When present, token production comes from their
   * stepped stability output instead of the legacy tokenBuilding path.
   */
  readonly knowledgeCenters?: readonly KnowledgeCenterPlacement[];
  /** Optional military-location recruitment rosters. */
  readonly garrisons?: readonly GarrisonPlacement[];
  /** Optional recruitable scientist heroes. */
  readonly scientists?: readonly ScientistDef[];
  /** Optional cross-subject synergies. */
  readonly synergies?: readonly SynergyDef[];
  /** Optional strategic artifacts. */
  readonly artifacts?: readonly ArtifactDef[];
}
