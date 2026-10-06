// Battle — the deterministic tactical combat resolver.
//
// This is where the player's prior academic development is realised: a unit's
// effective stats (base + tech/bonus) decide the fight. Combat is a separate,
// isolated phase and contains NO knowledge tests (flow protection).
//
// Determinism: all randomness comes from an injected SeededRng, and turn order
// / target selection are fixed (initiative desc, id asc). Therefore the same
// combatants + same seed always yield the same battle log — the basis for
// reproducibility tests and save/replay (AC9).

import { SeededRng } from "../rng/SeededRng.js";
import type { StatBlock } from "../units/BonusSystem.js";
import type { Unit } from "../units/Unit.js";

export enum BattleSide {
  PLAYER = "PLAYER",
  ENEMY = "ENEMY",
}

export enum BattleOutcome {
  PLAYER = "PLAYER",
  ENEMY = "ENEMY",
  DRAW = "DRAW",
}

export interface CombatantInit {
  readonly id: string;
  readonly side: BattleSide;
  readonly stats: StatBlock;
  /** Probability in [0, 1] of a critical hit (double damage). Default 0. */
  readonly critChance?: number;
}

interface Combatant {
  readonly id: string;
  readonly side: BattleSide;
  readonly stats: StatBlock;
  readonly critChance: number;
  hp: number;
}

export interface AttackLogEntry {
  readonly round: number;
  readonly attackerId: string;
  readonly defenderId: string;
  readonly damage: number;
  readonly crit: boolean;
  readonly defenderHpAfter: number;
}

export interface BattleResult {
  readonly outcome: BattleOutcome;
  readonly rounds: number;
  readonly log: readonly AttackLogEntry[];
}

/** Build a combatant from a developed unit's effective stats. */
export function combatantFromUnit(
  unit: Unit,
  side: BattleSide,
  opts: { id?: string; critChance?: number } = {},
): CombatantInit {
  return {
    id: opts.id ?? unit.id,
    side,
    stats: unit.effectiveStats(),
    ...(opts.critChance !== undefined ? { critChance: opts.critChance } : {}),
  };
}

/** Deterministic single attack damage, given the shared RNG. */
function computeDamage(
  attacker: Combatant,
  defender: Combatant,
  rng: SeededRng,
): { damage: number; crit: boolean } {
  const base = Math.max(1, attacker.stats.attack - Math.floor(defender.stats.defense / 2));
  const variance = Math.floor(base / 5);
  const roll = variance > 0 ? rng.nextInt(0, variance) : 0;
  let damage = base + roll;
  const crit = attacker.critChance > 0 && rng.nextFloat() < attacker.critChance;
  if (crit) damage *= 2;
  return { damage, crit };
}

/**
 * Simulate a battle to completion. Turn order is by initiative (desc), ties by
 * id (asc), computed once. Each living combatant, on its turn, attacks the
 * first living enemy in that same order. The battle ends when one side has no
 * living combatants, or at `maxRounds` (then the side with more total HP wins,
 * or DRAW).
 */
export function simulateBattle(
  combatants: readonly CombatantInit[],
  rng: SeededRng,
  maxRounds = 100,
): BattleResult {
  if (combatants.length === 0) {
    throw new RangeError("Battle needs at least one combatant");
  }
  const ids = new Set<string>();
  for (const c of combatants) {
    if (ids.has(c.id)) throw new TypeError(`Duplicate combatant id: ${c.id}`);
    ids.add(c.id);
    const cc = c.critChance ?? 0;
    if (cc < 0 || cc > 1) throw new RangeError(`critChance must be in [0,1] (id=${c.id})`);
  }

  const roster: Combatant[] = combatants.map((c) => ({
    id: c.id,
    side: c.side,
    stats: c.stats,
    critChance: c.critChance ?? 0,
    hp: c.stats.health,
  }));

  // Fixed turn order.
  const order = [...roster].sort(
    (a, b) =>
      b.stats.initiative - a.stats.initiative ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  const alive = (side: BattleSide) => roster.some((c) => c.side === side && c.hp > 0);
  const log: AttackLogEntry[] = [];
  let round = 0;

  while (alive(BattleSide.PLAYER) && alive(BattleSide.ENEMY) && round < maxRounds) {
    round++;
    for (const attacker of order) {
      if (attacker.hp <= 0) continue;
      const enemySide =
        attacker.side === BattleSide.PLAYER ? BattleSide.ENEMY : BattleSide.PLAYER;
      const target = order.find((c) => c.side === enemySide && c.hp > 0);
      if (target === undefined) break; // enemy side wiped out
      const { damage, crit } = computeDamage(attacker, target, rng);
      target.hp = Math.max(0, target.hp - damage);
      log.push({
        round,
        attackerId: attacker.id,
        defenderId: target.id,
        damage,
        crit,
        defenderHpAfter: target.hp,
      });
    }
  }

  let outcome: BattleOutcome;
  const playerAlive = alive(BattleSide.PLAYER);
  const enemyAlive = alive(BattleSide.ENEMY);
  if (playerAlive && !enemyAlive) outcome = BattleOutcome.PLAYER;
  else if (!playerAlive && enemyAlive) outcome = BattleOutcome.ENEMY;
  else {
    // Round cap reached (or both wiped simultaneously): decide by total HP.
    const hp = (side: BattleSide) =>
      roster.filter((c) => c.side === side).reduce((s, c) => s + c.hp, 0);
    const ph = hp(BattleSide.PLAYER);
    const eh = hp(BattleSide.ENEMY);
    outcome = ph > eh ? BattleOutcome.PLAYER : eh > ph ? BattleOutcome.ENEMY : BattleOutcome.DRAW;
  }

  return { outcome, rounds: round, log };
}
