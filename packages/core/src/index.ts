// @tudas-paradigmaja/core — public surface of the deterministic rules engine.
//
// Invariant for the whole core: no DOM, no fetch, no global Math.random.
// All randomness flows through a single seeded source (SeededRng), so that
// (GameState, Command, seed) -> GameState' is a pure, reproducible function.

export { SeededRng } from "./rng/SeededRng.js";
export type { Rng } from "./rng/SeededRng.js";
