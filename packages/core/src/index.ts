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
