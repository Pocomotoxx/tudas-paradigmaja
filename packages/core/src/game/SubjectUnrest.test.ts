import { describe, it, expect } from "vitest";
import { SeededRng } from "../rng/SeededRng.js";
import { Subject } from "../economy/KKLedger.js";
import { SubjectUnrest } from "./SubjectUnrest.js";

const F = Subject.FIZIKA, K = Subject.KEMIA;

describe("SubjectUnrest (I48) — levels 3–4 cascade", () => {
  it("does nothing when disabled (difficulty 1–2)", () => {
    const u = new SubjectUnrest({ enabled: false });
    for (let i = 0; i < 10; i++) u.recordAnswer(F, false);
    expect(u.unrestOf(F)).toBe(0);
    expect(u.desertionChance(F)).toBe(0);
    expect(u.unrestfulSubjects()).toEqual([]);
  });

  it("raises unrest only after several wrong answers (threshold)", () => {
    const u = new SubjectUnrest({ enabled: true, wrongThreshold: 3, unrestStep: 1 });
    u.recordAnswer(F, false); u.recordAnswer(F, false); u.recordAnswer(F, false);
    expect(u.unrestOf(F)).toBe(0); // 3 wrong = at threshold, not past it
    u.recordAnswer(F, false); // 4th
    expect(u.unrestOf(F)).toBe(1);
    u.recordAnswer(F, false); // 5th
    expect(u.unrestOf(F)).toBe(2);
    expect(u.unrestOf(K)).toBe(0); // other subjects untouched
  });

  it("desertion chance grows with unrest and correct answers cool it", () => {
    const u = new SubjectUnrest({ enabled: true, wrongThreshold: 0, unrestStep: 1, desertionPerUnrest: 0.1 });
    u.recordAnswer(F, false); // unrest 1
    u.recordAnswer(F, false); // unrest 2
    expect(u.desertionChance(F)).toBeCloseTo(0.2, 6);
    u.recordAnswer(F, true); // cool by 1 -> unrest 1
    expect(u.desertionChance(F)).toBeCloseTo(0.1, 6);
    expect(u.unrestfulSubjects()).toEqual([F]);
  });

  it("caps unrest and its desertion chance at 1", () => {
    const u = new SubjectUnrest({ enabled: true, wrongThreshold: 0, unrestStep: 5, maxUnrest: 10, desertionPerUnrest: 0.5 });
    for (let i = 0; i < 10; i++) u.recordAnswer(F, false);
    expect(u.unrestOf(F)).toBe(10);
    expect(u.desertionChance(F)).toBe(1);
  });

  it("rolls more desertions as unrest rises, deterministically", () => {
    const u = new SubjectUnrest({ enabled: true, wrongThreshold: 0, unrestStep: 1, desertionPerUnrest: 0.1 });
    for (let i = 0; i < 5; i++) u.recordAnswer(F, false); // unrest 5 -> 50%
    const a = u.rollDesertions(F, 100, new SeededRng(1));
    const b = u.rollDesertions(F, 100, new SeededRng(1));
    expect(a).toBe(b);             // deterministic
    expect(a).toBeGreaterThan(30); // ~50 of 100
    expect(a).toBeLessThan(70);
    expect(u.rollDesertions(F, 0, new SeededRng(1))).toBe(0);
  });

  it("round-trips through snapshot/restore", () => {
    const u = new SubjectUnrest({ enabled: true, wrongThreshold: 1 });
    u.recordAnswer(F, false); u.recordAnswer(F, false); u.recordAnswer(K, false);
    const snap = u.snapshot();
    const u2 = new SubjectUnrest({ enabled: true, wrongThreshold: 1 });
    u2.restore(snap);
    expect(u2.unrestOf(F)).toBe(u.unrestOf(F));
    expect(u2.snapshot()).toEqual(snap);
  });
});
