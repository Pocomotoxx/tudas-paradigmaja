import { describe, it, expect } from "vitest";
import { SeededRng } from "../rng/SeededRng.js";
import { RegionGraph, type RegionInit } from "../world/RegionGraph.js";
import { StrategicLoop, defaultBattleResolver } from "./StrategicLoop.js";

//  home(player) - mid(neutral) - enemyA(red) - deep(red)
//                     |
//                  island(neutral)
function graph(): RegionGraph {
  const regions: RegionInit[] = [
    { id: "home", owner: "player", adjacent: ["mid"] },
    { id: "mid", adjacent: ["home", "enemyA", "island"] },
    { id: "enemyA", owner: "red", adjacent: ["mid", "deep"] },
    { id: "deep", owner: "red", adjacent: ["enemyA"] },
    { id: "island", adjacent: ["mid"] },
  ];
  return new RegionGraph(regions);
}

function loop(extra: Partial<Parameters<typeof makeCfg>[0]> = {}) {
  return new StrategicLoop(makeCfg(extra));
}
function makeCfg(extra: { budget?: number; resolver?: any } = {}) {
  return {
    graph: graph(),
    playerFaction: "player",
    armyRegion: "home",
    armyStrength: 10,
    moveBudget: extra.budget ?? 2,
    garrisons: { enemyA: 4, deep: 8 },
    subjects: { home: "MATEMATIKA", mid: "FIZIKA", island: "MATEMATIKA", enemyA: "KEMIA" },
    kkYields: { home: 2, mid: 1, island: 3, enemyA: 5 },
    ...(extra.resolver ? { resolver: extra.resolver } : {}),
  };
}

describe("StrategicLoop (I43) — campaign turn on the region graph", () => {
  it("marches freely through own/neutral land within budget", () => {
    const s = loop({ budget: 2 });
    const targets = s.reachableTargets().map((t) => t.id);
    // home->mid(1)->island(2) and enemyA(2, as a terminal); deep is behind enemy.
    expect(targets).toEqual(["enemyA", "island", "mid"]);
    expect(s.reachableTargets().find((t) => t.id === "enemyA")!.enemy).toBe(true);
    expect(s.canMoveTo("deep")).toBe(false); // can't march through enemyA
  });

  it("occupies and claims a neutral region on entry", () => {
    const s = loop();
    const m = s.moveArmy("island", new SeededRng(1));
    expect(m.moved).toBe(true);
    expect(m.captured).toBe(false);
    expect(s.army).toBe("island");
    expect(s.regions.owner("island")).toBe("player"); // claimed where it stops
    expect(s.regions.owner("mid")).toBeUndefined();   // only marched through
    expect(s.budget).toBe(0); // spent 2
  });

  it("captures an enemy region on a won battle and occupies it", () => {
    const s = loop({ resolver: () => true });
    const m = s.moveArmy("enemyA", new SeededRng(1));
    expect(m.captured).toBe(true);
    expect(m.battle).toEqual({ attacker: 10, defender: 4, won: true });
    expect(s.army).toBe("enemyA");
    expect(s.regions.owner("enemyA")).toBe("player");
    expect(s.garrisonOf("enemyA")).toBe(0);
  });

  it("holds its ground and ends movement on a lost battle", () => {
    const s = loop({ resolver: () => false });
    const m = s.moveArmy("enemyA", new SeededRng(1));
    expect(m.moved).toBe(false);
    expect(m.captured).toBe(false);
    expect(s.army).toBe("home");
    expect(s.regions.owner("enemyA")).toBe("red"); // still enemy
    expect(s.budget).toBe(0); // movement spent
  });

  it("rejects moving beyond the budget and refills on a new turn", () => {
    const s = loop({ budget: 1 });
    expect(s.canMoveTo("island")).toBe(false); // costs 2
    expect(() => s.moveArmy("island", new SeededRng(1))).toThrow(/not reachable/);
    s.moveArmy("mid", new SeededRng(1)); // costs 1
    expect(s.army).toBe("mid");
    expect(s.budget).toBe(0);
    s.beginTurn();
    expect(s.budget).toBe(1);
  });

  it("default resolver is deterministic and ratio-weighted", () => {
    const rng = new SeededRng(42);
    const wins = Array.from({ length: 1000 }, () => defaultBattleResolver(30, 10, rng)).filter(Boolean).length;
    expect(wins).toBeGreaterThan(680); // ~75% expected
    expect(wins).toBeLessThan(820);
    expect(defaultBattleResolver(10, 0, new SeededRng(1))).toBe(true);  // undefended
    expect(defaultBattleResolver(0, 10, new SeededRng(1))).toBe(false); // no attacker
  });

  it("sums owned regions' KK yield by subject", () => {
    const s = loop();
    // Only "home" is owned at start (MATEMATIKA, yield 2).
    expect(s.ownedKKYield()).toEqual([{ subject: "MATEMATIKA", amount: 2 }]);
    expect(s.subjectOf("enemyA")).toBe("KEMIA");
    expect(s.kkYieldOf("island")).toBe(3);
    // Occupy island (MATEMATIKA, yield 3) -> same subject accumulates.
    s.moveArmy("island", new SeededRng(1));
    expect(s.ownedKKYield()).toEqual([{ subject: "MATEMATIKA", amount: 5 }]);
  });

  it("round-trips through snapshot/restore", () => {
    const s = loop({ resolver: () => true });
    s.moveArmy("enemyA", new SeededRng(1));
    const snap = s.snapshot();
    expect(snap.armyRegion).toBe("enemyA");

    const s2 = loop({ resolver: () => true });
    s2.restore(snap);
    expect(s2.army).toBe("enemyA");
    expect(s2.regions.owner("enemyA")).toBe("player");
    expect(s2.garrisonOf("enemyA")).toBe(0);
    expect(s2.budget).toBe(snap.budgetLeft);
  });
});
