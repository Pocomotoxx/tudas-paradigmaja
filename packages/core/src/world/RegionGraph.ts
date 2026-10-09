// RegionGraph — the strategic (campaign) layer: a graph of provinces/regions.
//
// This is the Total-War-style strategic map. Nodes are regions (e.g. NUTS 1
// regions on the Europe pack, or Voronoi provinces on the fantasy pack); edges
// are land adjacencies. Armies move region -> region across edges; a region may
// hold a knowledge centre (the discipline/capital). BATTLES ARE NOT RESOLVED
// HERE — when two forces meet, the tactical hex layer (HexMap + simulateBattle)
// takes over. The graph only answers "who owns what", "what is adjacent", and
// "how far / which path" between regions.
//
// Determinism: neighbours are visited in each region's declared adjacency order
// and the Dijkstra/BFS frontier breaks ties by the stable region id, so the
// same inputs always yield the same movement result — a prerequisite for
// reproducible tests and save/replay. No DOM, no fetch, no global random.

export interface RegionInit {
  /** Stable, unique region id (e.g. a NUTS 1 code like "HU1", or "prov_12"). */
  readonly id: string;
  /** Display name (content, not used for logic). */
  readonly name?: string;
  /** Faction/owner id, or undefined for neutral/unowned. */
  readonly owner?: string;
  /** Ids of adjacent regions. Non-existent ids are rejected at build time. */
  readonly adjacent: readonly string[];
  /**
   * Movement points consumed to ENTER this region. Positive integer; defaults
   * to 1. (Terrain/supply modifiers can raise it later.)
   */
  readonly enterCost?: number;
  /** Optional knowledge-centre id sited in this region (the discipline/capital). */
  readonly centerId?: string;
  /** If true, the region cannot be entered (impassable: sea, blocked). */
  readonly blocked?: boolean;
}

interface Region {
  readonly id: string;
  readonly name: string | undefined;
  owner: string | undefined;
  readonly adjacent: readonly string[];
  readonly enterCost: number;
  readonly centerId: string | undefined;
  readonly blocked: boolean;
}

export interface ReachableRegion {
  readonly id: string;
  /** Total movement cost from the start region to this region. */
  readonly cost: number;
}

/** A serialisable snapshot of mutable region state (owners), for save/load. */
export interface RegionGraphSnapshot {
  readonly owners: Readonly<Record<string, string>>;
}

export class RegionGraph {
  private readonly regions = new Map<string, Region>();

  constructor(regions: readonly RegionInit[]) {
    for (const r of regions) {
      if (!r.id) throw new TypeError("Region id must be a non-empty string");
      if (this.regions.has(r.id)) {
        throw new Error(`Duplicate region id: ${r.id}`);
      }
      const enterCost = r.enterCost ?? 1;
      if (!Number.isInteger(enterCost) || enterCost < 1) {
        throw new TypeError(
          `Region ${r.id} enterCost must be a positive integer, got ${enterCost}`,
        );
      }
      this.regions.set(r.id, {
        id: r.id,
        name: r.name,
        owner: r.owner,
        adjacent: [...r.adjacent],
        enterCost,
        centerId: r.centerId,
        blocked: r.blocked ?? false,
      });
    }
    // Validate adjacency references now that all ids are known.
    for (const r of this.regions.values()) {
      for (const nb of r.adjacent) {
        if (!this.regions.has(nb)) {
          throw new Error(`Region ${r.id} is adjacent to unknown region ${nb}`);
        }
        if (nb === r.id) {
          throw new Error(`Region ${r.id} is adjacent to itself`);
        }
      }
    }
  }

  /** Number of regions in the graph. */
  get size(): number {
    return this.regions.size;
  }

  has(id: string): boolean {
    return this.regions.has(id);
  }

  private require(id: string): Region {
    const r = this.regions.get(id);
    if (r === undefined) throw new RangeError(`Unknown region: ${id}`);
    return r;
  }

  name(id: string): string | undefined {
    return this.require(id).name;
  }

  owner(id: string): string | undefined {
    return this.require(id).owner;
  }

  centerId(id: string): string | undefined {
    return this.require(id).centerId;
  }

  enterCost(id: string): number {
    return this.require(id).enterCost;
  }

  isBlocked(id: string): boolean {
    return this.require(id).blocked;
  }

  /** Adjacent region ids, in declared order. */
  neighbours(id: string): readonly string[] {
    return this.require(id).adjacent;
  }

  /** True if `b` is directly adjacent to `a`. */
  areAdjacent(a: string, b: string): boolean {
    return this.require(a).adjacent.includes(b);
  }

  /** Set (or clear, with undefined) a region's owner. Returns this. */
  setOwner(id: string, owner: string | undefined): this {
    this.require(id).owner = owner;
    return this;
  }

  /** All region ids owned by `owner`, sorted by id for determinism. */
  regionsOf(owner: string): string[] {
    const out: string[] = [];
    for (const r of this.regions.values()) if (r.owner === owner) out.push(r.id);
    return out.sort();
  }

  /**
   * All regions reachable from `start` within `budget` movement points,
   * mapped to their minimum entry cost. The start region is included at cost 0.
   * Blocked regions are never entered (but the start may itself be blocked —
   * it is still reported at cost 0 so the caller can see where the army stands).
   * Deterministic: a Dijkstra expansion that visits neighbours in declared
   * order and breaks frontier ties by region id.
   */
  reachable(start: string, budget: number): ReachableRegion[] {
    this.require(start);
    if (!Number.isFinite(budget) || budget < 0) {
      throw new RangeError(`budget must be a non-negative number, got ${budget}`);
    }
    const best = new Map<string, number>([[start, 0]]);
    // Simple array frontier; graphs here are small (hundreds of regions).
    const frontier: string[] = [start];
    while (frontier.length > 0) {
      // Pick the lowest-cost node, ties by id — stable ordering.
      frontier.sort((a, b) => best.get(a)! - best.get(b)! || (a < b ? -1 : a > b ? 1 : 0));
      const cur = frontier.shift()!;
      const curCost = best.get(cur)!;
      for (const nb of this.require(cur).adjacent) {
        const region = this.require(nb);
        if (region.blocked) continue;
        const next = curCost + region.enterCost;
        if (next > budget) continue;
        const prev = best.get(nb);
        if (prev === undefined || next < prev) {
          best.set(nb, next);
          if (!frontier.includes(nb)) frontier.push(nb);
        }
      }
    }
    return [...best.entries()]
      .map(([id, cost]) => ({ id, cost }))
      .sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  /**
   * The cheapest path from `start` to `goal` as an ordered list of region ids
   * (inclusive of both ends), or null if unreachable. Entry cost applies to
   * every region after the start; blocked regions (other than the start) are
   * never traversed. Deterministic tie-breaking by region id.
   */
  findPath(start: string, goal: string): string[] | null {
    this.require(start);
    this.require(goal);
    if (start === goal) return [start];
    const best = new Map<string, number>([[start, 0]]);
    const prev = new Map<string, string>();
    const frontier: string[] = [start];
    while (frontier.length > 0) {
      frontier.sort((a, b) => best.get(a)! - best.get(b)! || (a < b ? -1 : a > b ? 1 : 0));
      const cur = frontier.shift()!;
      if (cur === goal) break;
      const curCost = best.get(cur)!;
      for (const nb of this.require(cur).adjacent) {
        const region = this.require(nb);
        if (region.blocked) continue; // blocked regions are never traversed
        const next = curCost + region.enterCost;
        const known = best.get(nb);
        if (known === undefined || next < known) {
          best.set(nb, next);
          prev.set(nb, cur);
          if (!frontier.includes(nb)) frontier.push(nb);
        }
      }
    }
    if (!best.has(goal)) return null;
    const path: string[] = [goal];
    let node = goal;
    while (node !== start) {
      const p = prev.get(node);
      if (p === undefined) return null; // goal unreachable (e.g. start isolated)
      path.push(p);
      node = p;
    }
    return path.reverse();
  }

  /** Total movement cost of the cheapest path, or null if unreachable. */
  pathCost(start: string, goal: string): number | null {
    const path = this.findPath(start, goal);
    if (path === null) return null;
    let cost = 0;
    for (let i = 1; i < path.length; i++) cost += this.require(path[i]!).enterCost;
    return cost;
  }

  /** Serialisable owner map for save/load (geometry/adjacency are static). */
  snapshot(): RegionGraphSnapshot {
    const owners: Record<string, string> = {};
    for (const r of this.regions.values()) if (r.owner !== undefined) owners[r.id] = r.owner;
    return { owners };
  }

  /** Restore mutable owner state from a snapshot (unknown ids are ignored). */
  restore(snap: RegionGraphSnapshot): this {
    for (const r of this.regions.values()) r.owner = undefined;
    for (const [id, owner] of Object.entries(snap.owners)) {
      const r = this.regions.get(id);
      if (r !== undefined) r.owner = owner;
    }
    return this;
  }
}
