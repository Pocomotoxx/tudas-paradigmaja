// @tudas-paradigmaja/core — public surface of the deterministic rules engine.
//
// Invariant for the whole core: no DOM, no fetch, no global Math.random.
// All randomness flows through a single seeded source (SeededRng), so that
// (GameState, Command, seed) -> GameState' is a pure, reproducible function.

export { SeededRng } from "./rng/SeededRng.js";
export type { Rng } from "./rng/SeededRng.js";

export { Hex, HEX_DIRECTIONS } from "./hex/Hex.js";
export type { HexCoord } from "./hex/Hex.js";
export { HexMap } from "./hex/HexMap.js";
export type { Tile, ReachableHex } from "./hex/HexMap.js";

export { GamePhase, PhaseMachine, PhaseError } from "./phase/GamePhase.js";

export { TokenLedger } from "./economy/TokenLedger.js";
export { KKLedger, Subject, ALL_SUBJECTS } from "./economy/KKLedger.js";
export { SupplyLedger } from "./economy/SupplyLedger.js";

export { RaschEstimator } from "./education/RaschEstimator.js";
export {
  QuestionBank,
  DifficultyTier,
  validateQuestion,
} from "./education/QuestionBank.js";
export type { QuestionItem } from "./education/QuestionBank.js";
export { TestSession, DEFAULT_TIER_REWARD } from "./education/TestSession.js";
export type { TestResult } from "./education/TestSession.js";
export { buildChoices } from "./education/MultipleChoice.js";
export type { Choice, ChoiceSet } from "./education/MultipleChoice.js";
export { Difficulty, DIFFICULTIES, difficultyParams } from "./game/Difficulty.js";
export type { DifficultyParams } from "./game/Difficulty.js";

export { BonusSystem, BonusOp, STATS, validateBonus } from "./units/BonusSystem.js";
export type { Bonus, Stat, StatBlock } from "./units/BonusSystem.js";
export { Unit } from "./units/Unit.js";
export type { UnitInit } from "./units/Unit.js";
export { TechTree } from "./units/TechTree.js";
export type { TechNode } from "./units/TechTree.js";
export { RecruitmentRoster, validateUnitTemplate } from "./units/Recruitment.js";
export type { UnitTemplate } from "./units/Recruitment.js";
export { UnitLadder } from "./units/UnitLadder.js";
export type { LadderTier } from "./units/UnitLadder.js";

export {
  simulateBattle,
  combatantFromUnit,
  BattleSide,
  BattleOutcome,
} from "./combat/Battle.js";
export type {
  CombatantInit,
  AttackLogEntry,
  BattleResult,
} from "./combat/Battle.js";

export { KnowledgeCenter, StabilityBand } from "./knowledge/KnowledgeCenter.js";
export type {
  KnowledgeCenterConfig,
  KnowledgeCenterInit,
  KnowledgeCenterSnapshot,
} from "./knowledge/KnowledgeCenter.js";

export {
  validateScientist,
  leaderBonusesFor,
  effectiveStatsUnderLeader,
  FOREIGN,
} from "./heroes/Scientist.js";
export type { ScientistDef, ScientistAffinity, AffinityTarget } from "./heroes/Scientist.js";

export {
  LocationType,
  LOCATION_META,
  isKnowledgeLocation,
  locationSubject,
  knowledgeCentersFromLocations,
} from "./world/LocationType.js";
export type { LocationTypeMeta, WorldLocation } from "./world/LocationType.js";

export { RegionGraph } from "./world/RegionGraph.js";
export type {
  RegionInit,
  ReachableRegion,
  RegionGraphSnapshot,
} from "./world/RegionGraph.js";

export { StrategicLoop, defaultBattleResolver } from "./game/StrategicLoop.js";
export type {
  StrategicConfig,
  StrategicMove,
  StrategicSnapshot,
  BattleResolver,
} from "./game/StrategicLoop.js";

export { SynergyRegistry, validateSynergy } from "./synergy/SynergyRegistry.js";
export type { SynergyDef, SubjectAmount } from "./synergy/SynergyRegistry.js";

export { validateArtifact } from "./artifacts/Artifact.js";
export type { ArtifactDef, ArtifactCaptureSpec } from "./artifacts/Artifact.js";

export { CaptureGate, CaptureStatus } from "./capture/CaptureGate.js";
export type { CaptureInit, CaptureSubmitResult } from "./capture/CaptureGate.js";

export { Game } from "./game/Game.js";
export type { GameSave, MaintenanceResult } from "./game/Game.js";
export type { ScenarioDef, GarrisonPlacement, StrategicDef, StrategicRegionDef } from "./game/Scenario.js";
