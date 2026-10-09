import { describe, it, expect } from "vitest";
import { buildRegionGraph, regionIdOf, type MapPack } from "./regionWorld.js";

// Minimal Europe-style pack: three regions, HU1 adjacent to AT1 and SK0.
const EUROPE: MapPack = {
  meta: { id: "europe", kind: "europe" },
  provinces: [
    { id: 0, name: "Közép-Magyarország", faction: "HU", capital: true, nutsId: "HU1", adj: [1, 2, 2] },
    { id: 1, name: "Ostösterreich", faction: "AT", nutsId: "AT1", adj: [0] },
    { id: 2, name: "Slovensko", faction: "SK", nutsId: "SK0", adj: [0] },
  ],
};

// Fantasy-style pack (no nutsId -> synthetic ids).
const FANTASY: MapPack = {
  meta: { id: "fantasy", kind: "fantasy" },
  provinces: [
    { id: 0, faction: "academia", capital: true, adj: [1] },
    { id: 1, faction: "academia", adj: [0, 2] },
    { id: 2, faction: "numeris", adj: [1] },
  ],
};

describe("regionWorld — build a RegionGraph from a map pack (I42)", () => {
  it("uses NUTS ids and de-duplicates adjacency on the Europe pack", () => {
    const g = buildRegionGraph(EUROPE);
    expect(g.size).toBe(3);
    expect(g.has("HU1")).toBe(true);
    expect(g.owner("HU1")).toBe("HU");
    expect(g.name("AT1")).toBe("Ostösterreich");
    // duplicate index 2 collapses to a single SK0 edge
    expect(g.neighbours("HU1")).toEqual(["AT1", "SK0"]);
    expect(g.areAdjacent("HU1", "AT1")).toBe(true);
  });

  it("sites a knowledge centre on capital regions", () => {
    const g = buildRegionGraph(EUROPE);
    expect(g.centerId("HU1")).toBe("kc_HU1");
    expect(g.centerId("AT1")).toBeUndefined();
  });

  it("answers strategic movement queries on the real adjacency", () => {
    const g = buildRegionGraph(EUROPE);
    // AT1 -> HU1 -> SK0, all enterCost 1.
    expect(g.findPath("AT1", "SK0")).toEqual(["AT1", "HU1", "SK0"]);
    expect(g.pathCost("AT1", "SK0")).toBe(2);
    expect(g.reachable("HU1", 1).map((r) => r.id)).toEqual(["HU1", "AT1", "SK0"]);
  });

  it("falls back to synthetic ids for a pack without NUTS codes", () => {
    const g = buildRegionGraph(FANTASY);
    expect(regionIdOf(FANTASY.provinces[2]!)).toBe("prov_2");
    expect(g.has("prov_0")).toBe(true);
    expect(g.regionsOf("academia")).toEqual(["prov_0", "prov_1"]);
    expect(g.findPath("prov_0", "prov_2")).toEqual(["prov_0", "prov_1", "prov_2"]);
  });
});
