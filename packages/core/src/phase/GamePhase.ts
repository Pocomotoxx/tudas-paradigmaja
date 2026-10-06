// GamePhase — the finite phase model that enforces flow protection.
//
// The game alternates between three phases. The hard design rule (GDD pillar 2)
// is: knowledge tests happen ONLY in the ACADEMIC phase, never during tactical
// combat. The academic phase is player-driven and asynchronous — the player
// decides when to enter it and spend accumulated test tokens.
//
// Allowed transitions:
//   STRATEGIC <-> ACADEMIC   (player enters/leaves the academic phase)
//   STRATEGIC <-> TACTICAL   (combat starts/ends)
//   ACADEMIC  <-> TACTICAL   is FORBIDDEN (you never jump straight between
//                             learning and fighting).

export enum GamePhase {
  STRATEGIC = "STRATEGIC",
  ACADEMIC = "ACADEMIC",
  TACTICAL = "TACTICAL",
}

/** Raised when an illegal phase transition or a phase-guarded action is attempted. */
export class PhaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhaseError";
  }
}

const ALLOWED: Readonly<Record<GamePhase, readonly GamePhase[]>> = {
  [GamePhase.STRATEGIC]: [GamePhase.ACADEMIC, GamePhase.TACTICAL],
  [GamePhase.ACADEMIC]: [GamePhase.STRATEGIC],
  [GamePhase.TACTICAL]: [GamePhase.STRATEGIC],
};

export class PhaseMachine {
  private phase: GamePhase;

  constructor(initial: GamePhase = GamePhase.STRATEGIC) {
    this.phase = initial;
  }

  get current(): GamePhase {
    return this.phase;
  }

  canTransition(to: GamePhase): boolean {
    return ALLOWED[this.phase].includes(to);
  }

  /** Transition to `to`, or throw PhaseError if the transition is illegal. */
  transition(to: GamePhase): void {
    if (to === this.phase) {
      throw new PhaseError(`Already in phase ${to}`);
    }
    if (!this.canTransition(to)) {
      throw new PhaseError(`Illegal transition ${this.phase} -> ${to}`);
    }
    this.phase = to;
  }

  /** Knowledge tests are permitted only in the ACADEMIC phase. */
  canStartTest(): boolean {
    return this.phase === GamePhase.ACADEMIC;
  }

  /** Guard used by the education subsystem; throws if a test is not allowed now. */
  assertCanStartTest(): void {
    if (!this.canStartTest()) {
      throw new PhaseError(
        `Tests may only start in ACADEMIC phase, current phase is ${this.phase}`,
      );
    }
  }
}
