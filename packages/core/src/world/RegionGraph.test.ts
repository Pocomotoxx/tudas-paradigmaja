import { describe, it, expect } from "vitest";
import { RegionGraph, type RegionInit } from "./RegionGraph.js";

// A small strategic map:  A - B - C
//                              |
//                              D (enterCost 2)   E (isolated)
const MAP: RegionInit[] = [
  { id: "A", owner: "blue", adjacent: ["B"], centerId: "kc-a" },
  { id: "B", adjacent: ["A", "C", "D"] },
  { id: "C", owner: "red", adjacent: ["B"] },
  { id: "D", adjacent: ["B"], enterCost: 2 },
  { id: "E", adjacent: [] },
];

describe("RegionGraph (I42) — strategic region layer", () => {
  it("builds and exposes region properties", () => {
    const g = new RegionGraph(MAP);
    expect(g.size).toBe(5);
    expect(g.owner("A")).toBe("blue");
    expect(g.owner("B")).toBeUndefined();
    expect(g.centerId("A")).toBe("kc-a");
    expect(g.enterCost("D")).toBe(2);
    expect(g.neighbours("B")).toEqual(["A", "C", "D"]);
    expect(g.areAdjacent("B", "D")).toBe(true);
    expect(g.areAdjacent("A", "C")).toBe(false);
  });

  it("rejects duplicate ids, self-loops and dangling adjacency", () => {
    expect(() => new RegionGraph([{ id: "X", adjacent: [] }, { id: "X", adjacent: [] }])).toThrow(/Duplicate/);
    expect(() => new RegionGraph([{ id: "X", adjacent: ["X"] }])).toThrow(/itself/);
    expect(() => new RegionGraph([{ id: "X", adjacent: ["Y"] }])).toThrow(/unknown region Y/);
    expect(() => new RegionGraph([{ id: "X", adjacent: [], enterCost: 0 }])).toThrow(/positive integer/);
  });

  it("lists regions owned by a faction, sorted", () => {
    const g = new RegionGraph(MAP);
    g.setOwner("D", "blue");
    expect(g.regionsOf("blue")).toEqual(["A", "D"]);
    expect(g.regionsOf("red")).toEqual(["C"]);
  });

  it("computes reachable regions within a movement budget (entry costs)", () => {
    const g = new RegionGraph(MAP);
    // From A, budget 2: A(0) -> B(1) -> C(2); D costs 1+2=3 > 2.
    const r = g.reachable("A", 2);
    expect(r).toEqual([
      { id: "A", cost: 0 },
      { id: "B", cost: 1 },
      { id: "C", cost: 2 },
    ]);
    // budget 3 now reaches D (1 + 2).
    expect(g.reachable("A", 3).map((x) => x.id)).toEqual(["A", "B", "C", "D"]);
    // E is isolated.
    expect(g.reachable("E", 99)).toEqual([{ id: "E", cost: 0 }]);
  });

  it("finds the cheapest path and its cost, inclusive of both ends", () => {
    const g = new RegionGraph(MAP);
    expect(g.findPath("A", "D")).toEqual(["A", "B", "D"]);
    expect(g.pathCost("A", "D")).toBe(3); // B(1) + D(2)
    expect(g.findPath("A", "A")).toEqual(["A"]);
    expect(g.findPath("A", "E")).toBeNull();
    expect(g.pathCost("A", "E")).toBeNull();
  });

  it("never traverses blocked regions, but still reports a blocked start", () => {
    const g = new RegionGraph([
      { id: "A", adjacent: ["B"] },
      { id: "B", adjacent: ["A", "C"], blocked: true }, // a sea/wall between A and C
      { id: "C", adjacent: ["B"] },
    ]);
    expect(g.findPath("A", "C")).toBeNull();
    expect(g.reachable("A", 99).map((x) => x.id)).toEqual(["A"]);
  });

  it("round-trips owner state through snapshot/restore", () => {
    const g = new RegionGraph(MAP);
    g.setOwner("B", "blue").setOwner("D", "red");
    const snap = g.snapshot();
    expect(snap.owners).toEqual({ A: "blue", B: "blue", C: "red", D: "red" });

    const g2 = new RegionGraph(MAP); // fresh (A=blue, C=red from init)
    g2.restore(snap);
    expect(g2.owner("A")).toBe("blue");
    expect(g2.owner("B")).toBe("blue");
    expect(g2.owner("D")).toBe("red");
    // ids not in the snapshot are cleared on restore
    g2.setOwner("A", "green");
    g2.restore({ owners: { C: "red" } });
    expect(g2.owner("A")).toBeUndefined();
    expect(g2.owner("C")).toBe("red");
  });

  it("is deterministic across equal queries", () => {
    const g = new RegionGraph(MAP);
    expect(g.reachable("A", 3)).toEqual(g.reachable("A", 3));
    expect(g.findPath("C", "D")).toEqual(g.findPath("C", "D"));
    expect(g.findPath("C", "D")).toEqual(["C", "B", "D"]);
  });
});
