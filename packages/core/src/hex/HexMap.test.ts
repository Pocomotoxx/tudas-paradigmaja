import { describe, it, expect } from "vitest";
import { Hex } from "./Hex.js";
import { HexMap } from "./HexMap.js";

/** Build a solid rectangular-ish hex field of radius `rad` around the origin. */
function filledMap(rad: number, enterCost = 1): HexMap {
  const tiles = [];
  for (let q = -rad; q <= rad; q++) {
    for (let r = -rad; r <= rad; r++) {
      if (Math.abs(-q - r) <= rad) tiles.push({ q, r, enterCost });
    }
  }
  return new HexMap(tiles);
}

describe("HexMap — movement (I1 AC1)", () => {
  it("reachable within MP respects uniform enter cost", () => {
    const map = filledMap(3);
    const r1 = map.reachable({ q: 0, r: 0 }, 1);
    // start + 6 neighbours, all cost-1
    expect(r1).toHaveLength(7);
    expect(r1.find((x) => x.hex.equals(new Hex(0, 0)))!.cost).toBe(0);
    expect(r1.every((x) => x.cost <= 1)).toBe(true);
  });

  it("obstacles block movement and routes around them", () => {
    // A wall of blocked tiles at q=1 for r in [-1..1] separates origin from (2,0).
    const tiles = [];
    for (let q = -1; q <= 3; q++) {
      for (let r = -2; r <= 2; r++) {
        if (Math.abs(-q - r) <= 3) {
          const blocked = q === 1 && r >= -1 && r <= 1;
          tiles.push({ q, r, blocked });
        }
      }
    }
    const map = new HexMap(tiles);

    // With MP=2 you cannot cross the 3-wide wall (must detour), so (2,0) is NOT reachable.
    const reach2 = map.reachable({ q: 0, r: 0 }, 2);
    expect(reach2.some((x) => x.hex.equals(new Hex(2, 0)))).toBe(false);

    // A blocked tile is never in the reachable set.
    expect(reach2.some((x) => x.hex.equals(new Hex(1, 0)))).toBe(false);

    // findPath detours around the wall rather than through it.
    const path = map.findPath({ q: 0, r: 0 }, { q: 2, r: 0 });
    expect(path).not.toBeNull();
    expect(path!.some((h) => h.equals(new Hex(1, 0)))).toBe(false);
    expect(path![0].equals(new Hex(0, 0))).toBe(true);
    expect(path![path!.length - 1].equals(new Hex(2, 0))).toBe(true);
  });

  it("weighted terrain costs more to enter", () => {
    // Direct neighbour (1,0) costs 3 to enter; detour via cost-1 tiles is cheaper.
    const map = new HexMap([
      { q: 0, r: 0 },
      { q: 1, r: 0, enterCost: 3 },
      { q: 0, r: 1, enterCost: 1 },
      { q: 1, r: -1, enterCost: 1 },
    ]);
    const path = map.findPath({ q: 0, r: 0 }, { q: 1, r: 0 });
    // Shortest by COST is the detour (1+1+? ) vs direct (3). Direct is cost 3;
    // detour 0->(1,-1)=1 ->(1,0)=3 total 4, or 0->(0,1)=1->(1,0)=4. So direct wins here.
    // Assert the minimal-cost path is the direct single step.
    expect(path).toEqual([new Hex(0, 0), new Hex(1, 0)]);
  });

  it("unreachable goal returns null; off-map is impassable", () => {
    const map = new HexMap([{ q: 0, r: 0 }, { q: 1, r: 0 }]);
    expect(map.findPath({ q: 0, r: 0 }, { q: 5, r: 5 })).toBeNull();
    expect(map.isPassable({ q: 9, r: 9 })).toBe(false);
  });

  it("is deterministic: identical inputs yield identical reachable output", () => {
    const map = filledMap(4);
    const a = map.reachable({ q: 0, r: 0 }, 3).map((x) => `${x.hex.key()}:${x.cost}`);
    const b = map.reachable({ q: 0, r: 0 }, 3).map((x) => `${x.hex.key()}:${x.cost}`);
    expect(a).toEqual(b);
  });

  // Negative / safety tests (Krista TEST_PLAN requirement).
  it("rejects negative movement points", () => {
    const map = filledMap(1);
    expect(() => map.reachable({ q: 0, r: 0 }, -1)).toThrow(RangeError);
  });

  it("rejects a non-positive enter cost at construction", () => {
    expect(() => new HexMap([{ q: 0, r: 0, enterCost: 0 }])).toThrow(TypeError);
  });

  it("start hex is included even when blocked", () => {
    const map = new HexMap([{ q: 0, r: 0, blocked: true }, { q: 1, r: 0 }]);
    const reach = map.reachable({ q: 0, r: 0 }, 1);
    expect(reach.some((x) => x.hex.equals(new Hex(0, 0)) && x.cost === 0)).toBe(true);
  });
});
