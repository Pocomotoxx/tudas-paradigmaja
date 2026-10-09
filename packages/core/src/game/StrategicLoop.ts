// StrategicLoop — the campaign turn on the region graph.
//
// One player army marches across the RegionGraph, spending a per-turn movement
// budget. It may cross its OWN and NEUTRAL regions freely; an ENEMY-owned region
// can only be a destination (the frontier it attacks), never a region it marches
// through. Entering an enemy region triggers a battle — resolved by an injected
// resolver so the tactical hex layer (simulateBattle) can own the actual fight;
// a win captures the region, a loss stops the army where it stood. Neutral and
// own regions are simply occupied/claimed on entry.
//
// Determinism: the internal Dijkstra visits neighbours in declared adjacency
// order and breaks ties by region id; the battle resolver is fed the shared
// seeded Rng. So (state, move, seed) -> state' is reproducible.

import type { Rng } from "../rng/SeededRng.js";
import { RegionGraph } from "../world/RegionGraph.js";

/** Decides a strategic battle: true = attacker (the player army) wins. */
export type BattleResolver = (attackerStrength: number, defenderStrength: number, rng: Rng) => boolean;

/**
 * Default resolver: probabilistic by strength ratio, drawn from the seeded Rng.
 * attacker wins with probability attack / (attack + defence); equal strengths
 * are a coin flip. A zero-strength defender always loses.
 */
export const defaultBattleResolver: BattleResolver = (atk, def, rng) => {
  if (def <= 0) return true;
  if (atk <= 0) return false;
  return rng.nextFloat() * (atk + def) < atk;
};

export interface StrategicConfig {
  readonly graph: RegionGraph;
  readonly playerFaction: string;
  /** Starting army position (a region id) and its combat strength. */
  readonly armyRegion: string;
  readonly armyStrength: number;
  /** Movement points granted at the start of each strategic turn. */
  readonly moveBudget: number;
  /** Defender strength per region id (absent = undefended, strength 0). */
  readonly garrisons?: Readonly<Record<string, number>>;
  /** Override the battle resolver (Game plugs in simulateBattle). */
  readonly resolver?: BattleResolver;
}

export interface StrategicMove {
  readonly from: string;
  readonly to: string;
  /** True if the army ended the move in `to`. */
  readonly moved: boolean;
  readonly costPaid: number;
  /** Present when entering a contested (enemy) region. */
  readonly battle?: { readonly attacker: number; readonly defender: number; readonly won: boolean };
  /** True if an enemy region was taken. */
  readonly captured: boolean;
}

export interface StrategicSnapshot {
  readonly armyRegion: string;
  readonly budgetLeft: number;
  readonly owners: Readonly<Record<string, string>>;
  readonly garrisons: Readonly<Record<string, number>>;
}

export class StrategicLoop {
  private readonly graph: RegionGraph;
  private readonly playerFaction: string;
  private readonly moveBudget: number;
  private readonly resolver: BattleResolver;
  private readonly garrisons = new Map<string, number>();

  private armyRegionId: string;
  private readonly armyStrength: number;
  private budgetLeft: number;

  constructor(cfg: StrategicConfig) {
    this.graph = cfg.graph;
    this.playerFaction = cfg.playerFaction;
    if (!this.graph.has(cfg.armyRegion)) {
      throw new RangeError(`Army start region ${cfg.armyRegion} is not in the graph`);
    }
    if (!Number.isInteger(cfg.moveBudget) || cfg.moveBudget < 0) {
      throw new TypeError(`moveBudget must be a non-negative integer, got ${cfg.moveBudget}`);
    }
    this.armyRegionId = cfg.armyRegion;
    this.armyStrength = cfg.armyStrength;
    this.moveBudget = cfg.moveBudget;
    this.budgetLeft = cfg.moveBudget;
    this.resolver = cfg.resolver ?? defaultBattleResolver;
    for (const [id, str] of Object.entries(cfg.garrisons ?? {})) {
      if (this.graph.has(id)) this.garrisons.set(id, str);
    }
    // The army's starting region is the player's from turn one.
    this.graph.setOwner(this.armyRegionId, this.playerFaction);
  }

  get army(): string { return this.armyRegionId; }
  get strength(): number { return this.armyStrength; }
  get budget(): number { return this.budgetLeft; }
  get faction(): string { return this.playerFaction; }
  get regions(): RegionGraph { return this.graph; }

  garrisonOf(id: string): number { return this.garrisons.get(id) ?? 0; }

  /** Refill the movement budget. Call at the start of each strategic turn. */
  beginTurn(): void { this.budgetLeft = this.moveBudget; }

  private isEnemy(id: string): boolean {
    const o = this.graph.owner(id);
    return o !== undefined && o !== this.playerFaction;
  }

  /**
   * Cheapest cost to reach each region from the army within the current budget,
   * marching only through own/neutral land (enemy regions are reachable only as
   * endpoints). Returns a map id -> cost (excludes the army's own region).
   */
  private frontier(): Map<string, number> {
    const best = new Map<string, number>([[this.armyRegionId, 0]]);
    const open: string[] = [this.armyRegionId];
    while (open.length > 0) {
      open.sort((a, b) => best.get(a)! - best.get(b)! || (a < b ? -1 : a > b ? 1 : 0));
      const cur = open.shift()!;
      // Enemy regions are terminal: you attack INTO them but do not march on.
      if (cur !== this.armyRegionId && this.isEnemy(cur)) continue;
      const curCost = best.get(cur)!;
      for (const nb of this.graph.neighbours(cur)) {
        if (this.graph.isBlocked(nb)) continue;
        const next = curCost + this.graph.enterCost(nb);
        if (next > this.budgetLeft) continue;
        const prev = best.get(nb);
        if (prev === undefined || next < prev) {
          best.set(nb, next);
          if (!open.includes(nb)) open.push(nb);
        }
      }
    }
    best.delete(this.armyRegionId);
    return best;
  }

  /** Region ids the army can move to this turn, with the cost, sorted by id. */
  reachableTargets(): Array<{ id: string; cost: number; enemy: boolean }> {
    return [...this.frontier().entries()]
      .map(([id, cost]) => ({ id, cost, enemy: this.isEnemy(id) }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  canMoveTo(id: string): boolean {
    return this.graph.has(id) && this.frontier().has(id);
  }

  /**
   * Move the army to `to`. Throws if `to` is unreachable within budget. On a
   * contested destination resolves a battle: a win captures the region and the
   * army occupies it; a loss leaves the army where it was and ends its movement
   * for the turn. Neutral/own destinations are occupied and claimed.
   */
  moveArmy(to: string, rng: Rng): StrategicMove {
    if (!this.graph.has(to)) throw new RangeError(`Unknown region: ${to}`);
    const reach = this.frontier();
    const cost = reach.get(to);
    if (cost === undefined) {
      throw new RangeError(`Region ${to} is not reachable this turn (budget ${this.budgetLeft})`);
    }
    const from = this.armyRegionId;

    if (this.isEnemy(to)) {
      const defender = this.garrisonOf(to);
      const won = this.resolver(this.armyStrength, defender, rng);
      if (won) {
        this.graph.setOwner(to, this.playerFaction);
        this.garrisons.delete(to);
        this.armyRegionId = to;
        this.budgetLeft -= cost;
        return { from, to, moved: true, costPaid: cost, battle: { attacker: this.armyStrength, defender, won }, captured: true };
      }
      // Repulsed: army holds its ground, movement spent for the turn.
      this.budgetLeft = 0;
      return { from, to, moved: false, costPaid: 0, battle: { attacker: this.armyStrength, defender, won }, captured: false };
    }

    // Neutral or own: occupy and claim.
    this.graph.setOwner(to, this.playerFaction);
    this.armyRegionId = to;
    this.budgetLeft -= cost;
    return { from, to, moved: true, costPaid: cost, captured: false };
  }

  snapshot(): StrategicSnapshot {
    const garrisons: Record<string, number> = {};
    for (const [id, s] of this.garrisons) garrisons[id] = s;
    return {
      armyRegion: this.armyRegionId,
      budgetLeft: this.budgetLeft,
      owners: this.graph.snapshot().owners,
      garrisons,
    };
  }

  restore(snap: StrategicSnapshot): this {
    this.armyRegionId = snap.armyRegion;
    this.budgetLeft = snap.budgetLeft;
    this.graph.restore({ owners: snap.owners });
    this.garrisons.clear();
    for (const [id, s] of Object.entries(snap.garrisons)) {
      if (this.graph.has(id)) this.garrisons.set(id, s);
    }
    return this;
  }
}
