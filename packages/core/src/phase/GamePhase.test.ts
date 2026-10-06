import { describe, it, expect } from "vitest";
import { GamePhase, PhaseMachine, PhaseError } from "./GamePhase.js";

describe("PhaseMachine — flow protection (I2 AC4)", () => {
  it("starts in STRATEGIC by default", () => {
    expect(new PhaseMachine().current).toBe(GamePhase.STRATEGIC);
  });

  it("allows STRATEGIC <-> ACADEMIC and STRATEGIC <-> TACTICAL", () => {
    const m = new PhaseMachine();
    m.transition(GamePhase.ACADEMIC);
    expect(m.current).toBe(GamePhase.ACADEMIC);
    m.transition(GamePhase.STRATEGIC);
    m.transition(GamePhase.TACTICAL);
    expect(m.current).toBe(GamePhase.TACTICAL);
    m.transition(GamePhase.STRATEGIC);
    expect(m.current).toBe(GamePhase.STRATEGIC);
  });

  it("forbids ACADEMIC <-> TACTICAL directly", () => {
    const m = new PhaseMachine(GamePhase.ACADEMIC);
    expect(() => m.transition(GamePhase.TACTICAL)).toThrow(PhaseError);
    const m2 = new PhaseMachine(GamePhase.TACTICAL);
    expect(() => m2.transition(GamePhase.ACADEMIC)).toThrow(PhaseError);
  });

  it("allows starting a test only in ACADEMIC", () => {
    const m = new PhaseMachine(GamePhase.ACADEMIC);
    expect(m.canStartTest()).toBe(true);
    expect(() => m.assertCanStartTest()).not.toThrow();
  });

  // Core negative/safety test (AC4): no tests during combat.
  it("rejects starting a test in TACTICAL phase", () => {
    const m = new PhaseMachine(GamePhase.TACTICAL);
    expect(m.canStartTest()).toBe(false);
    expect(() => m.assertCanStartTest()).toThrow(PhaseError);
  });

  it("rejects starting a test in STRATEGIC phase", () => {
    const m = new PhaseMachine(GamePhase.STRATEGIC);
    expect(() => m.assertCanStartTest()).toThrow(PhaseError);
  });

  it("rejects a no-op transition to the current phase", () => {
    const m = new PhaseMachine(GamePhase.STRATEGIC);
    expect(() => m.transition(GamePhase.STRATEGIC)).toThrow(PhaseError);
  });
});
