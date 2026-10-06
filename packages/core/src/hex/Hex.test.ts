import { describe, it, expect } from "vitest";
import { Hex, HEX_DIRECTIONS } from "./Hex.js";

describe("Hex — axial coordinate", () => {
  it("computes s as -q-r", () => {
    expect(new Hex(2, -3).s).toBe(1);
  });

  it("has a stable key round-trip", () => {
    const h = new Hex(-4, 7);
    expect(Hex.fromKey(h.key()).equals(h)).toBe(true);
  });

  it("has exactly 6 neighbours at distance 1", () => {
    const h = new Hex(0, 0);
    const ns = h.neighbours();
    expect(ns).toHaveLength(6);
    for (const n of ns) expect(h.distance(n)).toBe(1);
    expect(ns).toHaveLength(HEX_DIRECTIONS.length);
  });

  it("computes hex distance correctly", () => {
    expect(new Hex(0, 0).distance(new Hex(0, 0))).toBe(0);
    expect(new Hex(0, 0).distance(new Hex(3, 0))).toBe(3);
    expect(new Hex(0, 0).distance(new Hex(-1, -1))).toBe(2);
  });

  it("rejects non-integer coordinates", () => {
    expect(() => new Hex(0.5, 1)).toThrow(TypeError);
  });
});
