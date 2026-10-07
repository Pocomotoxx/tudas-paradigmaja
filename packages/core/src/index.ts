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

export { RaschEstimator } from "./education/RaschEstimator.js";
export {
  QuestionBank,
  DifficultyTier,
  validateQuestion,
} from "./education/QuestionBank.js";
export type { QuestionItem } from "./education/QuestionBank.js";
export { TestSession, DEFAULT_TIER_REWARD } from "./education/TestSession.js";
export type { TestResult } from "./education/TestSession.js";

export { BonusSystem, BonusOp, STATS, validateBonus } from "./units/BonusSystem.js";
export type { Bonus, Stat, StatBlock } from "./units/BonusSystem.js";
export { Unit } from "./units/Unit.js";
export type { UnitInit } from "./units/Unit.js";
export { TechTree } from "./units/TechTree.js";
export type { TechNode } from "./units/TechTree.js";

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

export { Game } from "./game/Game.js";
export type { GameSave } from "./game/Game.js";
export type { ScenarioDef } from "./game/Scenario.js";
