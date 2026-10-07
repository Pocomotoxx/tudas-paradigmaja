import { describe, it, expect } from "vitest";
import { Subject } from "../economy/KKLedger.js";
import { KnowledgeCenter, StabilityBand } from "./KnowledgeCenter.js";

const center = (stability?: number) =>
  new KnowledgeCenter({ id: "egyetem", subject: Subject.MATEMATIKA, ...(stability !== undefined ? { stability } : {}) });

describe("KnowledgeCenter — stepped output by band (I8 E1)", () => {
  it("maps stability to HIGH/MID/LOW bands and stepped token output", () => {
    expect(center(100).band()).toBe(StabilityBand.HIGH);
    expect(center(100).tokenOutput()).toBe(3);
    expect(center(50).band()).toBe(StabilityBand.MID);
    expect(center(50).tokenOutput()).toBe(2);
    expect(center(20).band()).toBe(StabilityBand.LOW);
    expect(center(20).tokenOutput()).toBe(1);
  });
});

describe("KnowledgeCenter — maintenance cadence (I8 E2)", () => {
  it("checks more often at lower stability", () => {
    expect(center(100).checkInterval()).toBe(3); // HIGH
    expect(center(50).checkInterval()).toBe(2); // MID
    expect(center(20).checkInterval()).toBe(1); // LOW
  });

  it("isCheckDue respects the interval and the last check turn", () => {
    const c = center(100); // interval 3, lastChecked 0
    expect(c.isCheckDue(2)).toBe(false);
    expect(c.isCheckDue(3)).toBe(true);
    c.answer(true, 3); // records lastChecked = 3 (stays HIGH at max)
    expect(c.isCheckDue(5)).toBe(false);
    expect(c.isCheckDue(6)).toBe(true);
  });
});

describe("KnowledgeCenter — stability transitions", () => {
  it("correct raises, wrong lowers, clamped to [0, max]", () => {
    const c = center(90);
    c.answer(true, 1); // +20 -> clamp 100
    expect(c.stability).toBe(100);
    c.answer(false, 2); // -25 -> 75
    expect(c.stability).toBe(75);
  });

  // Rebellion (negative/safety path).
  it("stability 0 triggers rebellion and cuts output (no retroactive loss here)", () => {
    const c = center(20); // LOW
    c.answer(false, 1); // -25 -> 0
    expect(c.stability).toBe(0);
    expect(c.rebelled).toBe(true);
    expect(c.band()).toBe(StabilityBand.REBELLED);
    expect(c.tokenOutput()).toBe(0);
  });

  // E3: recoverable with hysteresis.
  it("a rebelled center recovers only after climbing back to the threshold (E3)", () => {
    const c = center(20);
    c.answer(false, 1); // -> 0, rebelled
    expect(c.rebelled).toBe(true);
    c.answer(true, 2); // +20 -> 20, still below recovery (34)
    expect(c.stability).toBe(20);
    expect(c.rebelled).toBe(true); // hysteresis: not yet recovered
    expect(c.tokenOutput()).toBe(0);
    c.answer(true, 3); // +20 -> 40, >= 34 recovery
    expect(c.rebelled).toBe(false);
    expect(c.band()).toBe(StabilityBand.MID);
    expect(c.tokenOutput()).toBe(2);
  });

  it("constructing at stability 0 starts rebelled", () => {
    expect(center(0).rebelled).toBe(true);
  });
});

describe("KnowledgeCenter — serialization", () => {
  it("round-trips via snapshot", () => {
    const c = center(100);
    c.answer(false, 1); // 75
    c.answer(false, 2); // 50
    const snap = c.toSnapshot();
    const restored = KnowledgeCenter.fromSnapshot(snap);
    expect(restored.toSnapshot()).toEqual(snap);
    expect(restored.stability).toBe(50);
    expect(restored.band()).toBe(StabilityBand.MID);
  });
});

describe("KnowledgeCenter — construction safety (negative tests)", () => {
  it("rejects empty id and unknown subject", () => {
    expect(() => new KnowledgeCenter({ id: "", subject: Subject.MATEMATIKA })).toThrow(TypeError);
    expect(() => new KnowledgeCenter({ id: "x", subject: "NOPE" as never })).toThrow(TypeError);
  });

  it("rejects stability out of range", () => {
    expect(() => new KnowledgeCenter({ id: "x", subject: Subject.MATEMATIKA, stability: 200 })).toThrow(RangeError);
    expect(() => new KnowledgeCenter({ id: "x", subject: Subject.MATEMATIKA, stability: -1 })).toThrow(RangeError);
  });

  it("rejects invalid config", () => {
    expect(() => new KnowledgeCenter({ id: "x", subject: Subject.MATEMATIKA, config: { maxStability: 0 } })).toThrow(TypeError);
    expect(() => new KnowledgeCenter({ id: "x", subject: Subject.MATEMATIKA, config: { gainPerCorrect: 0 } })).toThrow(TypeError);
    expect(() => new KnowledgeCenter({ id: "x", subject: Subject.MATEMATIKA, config: { maxStability: 100, recoveryThreshold: 200 } })).toThrow(RangeError);
  });

  it("rejects a negative turn in answer/isCheckDue", () => {
    const c = center(100);
    expect(() => c.answer(true, -1)).toThrow(RangeError);
    expect(() => c.isCheckDue(-1)).toThrow(RangeError);
  });
});
