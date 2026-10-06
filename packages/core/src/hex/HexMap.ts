// HexMap — the walkable battlefield/world surface and its movement queries.
//
// A map is a set of tiles keyed by hex. Each tile has an "enter cost" (the
// movement points consumed to step ONTO it). A hex that is not in the map is
// off-map and impassable; a tile may also be explicitly blocked (e.g. an
// obstacle created by a Terraforming unit), which is likewise impassable.
//
// Movement queries (reachable, findPath) are deterministic: neighbours are
// visited in HEX_DIRECTIONS order and the Dijkstra frontier breaks ties by the
// stable hex key, so the same inputs always yield the same result — a
// prerequisite for reproducible tests and save/replay.

import { Hex, type HexCoord } from "./Hex.js";

export interface Tile {
  /** Movement points consumed to enter this tile. Must be a positive integer. */
  readonly enterCost: number;
  /** If true, the tile exists on the map but cannot be entered. */
  readonly blocked: boolean;
}

export interface ReachableHex {
  readonly hex: Hex;
  /** Total movement cost from the start to this hex. */
  readonly cost: number;
}

interface TileInput {
  readonly q: number;
  readonly r: number;
  readonly enterCost?: number;
  readonly blocked?: boolean;
}

export class HexMap {
  private readonly tiles = new Map<string, Tile>();

  /**
   * @param tiles Tile definitions. Omitted enterCost defaults to 1; omitted
   *   blocked defaults to false.
   */
  constructor(tiles: readonly TileInput[]) {
    for (const t of tiles) {
      const enterCost = t.enterCost ?? 1;
      if (!Number.isInteger(enterCost) || enterCost < 1) {
        throw new TypeError(
          `Tile (${t.q}, ${t.r}) enterCost must be a positive integer, got ${enterCost}`,
        );
      }
      this.tiles.set(new Hex(t.q, t.r).key(), {
        enterCost,
        blocked: t.blocked ?? false,
      });
    }
  }

  has(hex: HexCoord): boolean {
    return this.tiles.has(new Hex(hex.q, hex.r).key());
  }

  /** A hex is passable when it is on the map and not blocked. */
  isPassable(hex: HexCoord): boolean {
    const t = this.tiles.get(new Hex(hex.q, hex.r).key());
    return t !== undefined && !t.blocked;
  }

  getTile(hex: HexCoord): Tile | undefined {
    return this.tiles.get(new Hex(hex.q, hex.r).key());
  }

  /**
   * All hexes reachable from `start` within `movementPoints`, with the minimal
   * cost to each. The start hex is always included at cost 0 (even if start
   * itself is blocked — you are allowed to stand where you are). Result is
   * sorted by (cost, key) for deterministic output.
   */
  reachable(start: HexCoord, movementPoints: number): ReachableHex[] {
    if (!Number.isInteger(movementPoints) || movementPoints < 0) {
      throw new RangeError(
        `movementPoints must be a non-negative integer, got ${movementPoints}`,
      );
    }
    const startHex = new Hex(start.q, start.r);
    const best = new Map<string, number>([[startHex.key(), 0]]);

    // Deterministic Dijkstra: pick the frontier entry with the lowest cost,
    // breaking ties by stable key.
    const frontier: { key: string; cost: number }[] = [
      { key: startHex.key(), cost: 0 },
    ];
    const settled = new Set<string>();

    while (frontier.length > 0) {
      frontier.sort((a, b) => (a.cost - b.cost) || (a.key < b.key ? -1 : 1));
      const current = frontier.shift()!;
      if (settled.has(current.key)) continue;
      settled.add(current.key);

      const hex = Hex.fromKey(current.key);
      for (const n of hex.neighbours()) {
        if (!this.isPassable(n)) continue;
        const tile = this.getTile(n)!;
        const nextCost = current.cost + tile.enterCost;
        if (nextCost > movementPoints) continue;
        const known = best.get(n.key());
        if (known === undefined || nextCost < known) {
          best.set(n.key(), nextCost);
          frontier.push({ key: n.key(), cost: nextCost });
        }
      }
    }

    return [...best.entries()]
      .map(([key, cost]) => ({ hex: Hex.fromKey(key), cost }))
      .sort((a, b) => (a.cost - b.cost) || (a.hex.key() < b.hex.key() ? -1 : 1));
  }

  /**
   * Minimal-cost path from `start` to `goal` (inclusive of both), or null if
   * the goal is unreachable. Path is the ordered list of hexes to traverse.
   */
  findPath(start: HexCoord, goal: HexCoord): Hex[] | null {
    const startHex = new Hex(start.q, start.r);
    const goalHex = new Hex(goal.q, goal.r);
    if (startHex.equals(goalHex)) return [startHex];
    if (!this.isPassable(goalHex)) return null;

    const best = new Map<string, number>([[startHex.key(), 0]]);
    const cameFrom = new Map<string, string>();
    const frontier: { key: string; cost: number }[] = [
      { key: startHex.key(), cost: 0 },
    ];
    const settled = new Set<string>();

    while (frontier.length > 0) {
      frontier.sort((a, b) => (a.cost - b.cost) || (a.key < b.key ? -1 : 1));
      const current = frontier.shift()!;
      if (settled.has(current.key)) continue;
      settled.add(current.key);
      if (current.key === goalHex.key()) break;

      const hex = Hex.fromKey(current.key);
      for (const n of hex.neighbours()) {
        if (!this.isPassable(n)) continue;
        const tile = this.getTile(n)!;
        const nextCost = current.cost + tile.enterCost;
        const known = best.get(n.key());
        if (known === undefined || nextCost < known) {
          best.set(n.key(), nextCost);
          cameFrom.set(n.key(), current.key);
          frontier.push({ key: n.key(), cost: nextCost });
        }
      }
    }

    if (!best.has(goalHex.key())) return null;

    const path: Hex[] = [];
    let cursor: string | undefined = goalHex.key();
    while (cursor !== undefined) {
      path.push(Hex.fromKey(cursor));
      cursor = cameFrom.get(cursor);
    }
    return path.reverse();
  }
}
