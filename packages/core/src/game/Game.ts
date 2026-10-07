// Game — the facade that composes the vertical slice into one playable loop
// and provides deterministic save/load.
//
// Slice loop: move on the hex map and own the token building -> produce tokens
// each turn -> enter the academic phase -> spend tokens on tests -> earn KK ->
// research a tech node (unit grows stronger) -> fight the enemy guard -> win.
//
// Determinism: the single SeededRng drives every random draw (only combat here).
// save()/load() round-trip the full dynamic state, so a loaded game continues
// identically (AC12).

import { SeededRng } from "../rng/SeededRng.js";
import { Hex, type HexCoord } from "../hex/Hex.js";
import { HexMap } from "../hex/HexMap.js";
import { GamePhase, PhaseMachine, PhaseError } from "../phase/GamePhase.js";
import { TokenLedger } from "../economy/TokenLedger.js";
import { KKLedger, Subject } from "../economy/KKLedger.js";
import { RaschEstimator } from "../education/RaschEstimator.js";
import { QuestionBank, type QuestionItem } from "../education/QuestionBank.js";
import { TestSession, type TestResult } from "../education/TestSession.js";
import { Unit } from "../units/Unit.js";
import { TechTree } from "../units/TechTree.js";
import type { Bonus, StatBlock } from "../units/BonusSystem.js";
import {
  simulateBattle,
  combatantFromUnit,
  BattleSide,
  BattleOutcome,
  type BattleResult,
} from "../combat/Battle.js";
import {
  KnowledgeCenter,
  type KnowledgeCenterSnapshot,
} from "../knowledge/KnowledgeCenter.js";
import type { ScenarioDef } from "./Scenario.js";

export interface GameSave {
  readonly version: 1;
  readonly scenarioId: string;
  readonly turn: number;
  readonly phase: GamePhase;
  readonly rngState: number;
  readonly heroPos: { q: number; r: number };
  readonly tokens: number;
  readonly kk: Record<Subject, number>;
  readonly thetas: Record<Subject, number>;
  readonly researched: string[];
  readonly unitBonuses: Bonus[];
  readonly lastOutcome: BattleOutcome | null;
  readonly centers: KnowledgeCenterSnapshot[];
  readonly maintenanceUsed: string[];
}

export interface MaintenanceResult {
  readonly centerId: string;
  readonly question: QuestionItem;
  readonly correct: boolean;
  readonly newTheta: number;
  readonly stability: number;
  readonly rebelled: boolean;
}

export class Game {
  private readonly scenario: ScenarioDef;
  private readonly map: HexMap;
  private readonly phase: PhaseMachine;
  private readonly rng: SeededRng;
  private readonly tokens: TokenLedger;
  private readonly kk: KKLedger;
  private readonly rasch: RaschEstimator;
  private readonly bank: QuestionBank;
  private readonly testSession: TestSession;
  private readonly techTree: TechTree;
  private readonly unit: Unit;

  private readonly centers: KnowledgeCenter[];
  private readonly centerHex = new Map<string, Hex>();

  private heroPos: Hex;
  private turnNumber = 1;
  private lastOutcome: BattleOutcome | null = null;
  private pendingMaintenance: { centerId: string; question: QuestionItem } | null = null;
  private readonly usedMaintenanceIds = new Set<string>();

  constructor(scenario: ScenarioDef, seed: number) {
    this.scenario = scenario;
    this.map = new HexMap(scenario.tiles);
    this.phase = new PhaseMachine(GamePhase.STRATEGIC);
    this.rng = new SeededRng(seed);
    this.tokens = new TokenLedger(scenario.tokenCap, 0);
    this.kk = new KKLedger();
    this.rasch = new RaschEstimator();
    this.bank = new QuestionBank(scenario.questions);
    this.techTree = new TechTree(scenario.techNodes);
    this.unit = new Unit(scenario.playerUnit);
    this.testSession = new TestSession({
      phase: this.phase,
      tokens: this.tokens,
      kk: this.kk,
      rasch: this.rasch,
      bank: this.bank,
      tokenCostPerTest: scenario.tokenCostPerTest,
    });
    this.heroPos = new Hex(scenario.heroStart.q, scenario.heroStart.r);

    this.centers = (scenario.knowledgeCenters ?? []).map((p) => {
      this.centerHex.set(p.id, new Hex(p.hex.q, p.hex.r));
      return new KnowledgeCenter({
        id: p.id,
        subject: p.subject,
        ...(p.stability !== undefined ? { stability: p.stability } : {}),
        ...(p.config !== undefined ? { config: p.config } : {}),
      });
    });
  }

  private center(id: string): KnowledgeCenter {
    const c = this.centers.find((x) => x.id === id);
    if (c === undefined) throw new RangeError(`Unknown knowledge center: ${id}`);
    return c;
  }

  // --- read-only accessors ---
  get currentPhase(): GamePhase { return this.phase.current; }
  get turn(): number { return this.turnNumber; }
  get tokenBalance(): number { return this.tokens.balance; }
  get outcome(): BattleOutcome | null { return this.lastOutcome; }
  kkOf(subject: Subject): number { return this.kk.balanceOf(subject); }
  unitStats(): StatBlock { return this.unit.effectiveStats(); }
  heroAt(): Hex { return this.heroPos; }
  get scenarioId(): string { return this.scenario.id; }
  /** Read-only view of the scenario's map tiles (static data) for rendering. */
  mapTiles(): readonly { q: number; r: number; blocked?: boolean }[] {
    return this.scenario.tiles.map((t) => ({ q: t.q, r: t.r, ...(t.blocked ? { blocked: true } : {}) }));
  }
  tokenBuildingAt(): Hex {
    return new Hex(this.scenario.tokenBuilding.q, this.scenario.tokenBuilding.r);
  }
  ownsTokenBuilding(): boolean {
    return this.heroPos.equals(this.scenario.tokenBuilding);
  }

  // --- strategic phase ---
  /** Move the hero to `to` if a path exists on the map (STRATEGIC only). */
  moveHero(to: HexCoord): void {
    if (this.phase.current !== GamePhase.STRATEGIC) {
      throw new PhaseError("Hero can move only in STRATEGIC phase");
    }
    const path = this.map.findPath(this.heroPos, to);
    if (path === null) throw new RangeError(`No path to (${to.q}, ${to.r})`);
    this.heroPos = new Hex(to.q, to.r);
  }

  /** End the strategic turn: produce tokens if the building is owned. */
  endTurn(): void {
    if (this.phase.current !== GamePhase.STRATEGIC) {
      throw new PhaseError("endTurn is only valid in STRATEGIC phase");
    }
    if (this.centers.length > 0) {
      // Unified economy: token production is the sum of centers' stepped
      // stability output (rebelled centers output 0 — supply cut off).
      for (const c of this.centers) this.tokens.produce(c.tokenOutput());
    } else if (this.ownsTokenBuilding()) {
      // Legacy path for scenarios without knowledge centers.
      this.tokens.produce(this.scenario.tokensPerTurn);
    }
    this.turnNumber++;
    this.testSession.newTurn();
  }

  // --- knowledge-center maintenance (unified economy) ---
  get hasCenters(): boolean { return this.centers.length > 0; }
  centerIds(): string[] { return this.centers.map((c) => c.id); }
  centerStability(id: string): number { return this.center(id).stability; }
  centerRebelled(id: string): boolean { return this.center(id).rebelled; }
  centerTokenOutput(id: string): number { return this.center(id).tokenOutput(); }

  /** Centers whose maintenance check is due at the current turn. */
  maintenanceDueIds(): string[] {
    return this.centers.filter((c) => c.isCheckDue(this.turnNumber)).map((c) => c.id);
  }

  /**
   * Answer a center's maintenance check. Allowed in any phase EXCEPT TACTICAL
   * (flow protection: no knowledge checks during combat). Correct raises the
   * center's stability, wrong lowers it (may trigger rebellion / recovery).
   */
  answerMaintenance(id: string, correct: boolean): void {
    if (this.phase.current === GamePhase.TACTICAL) {
      throw new PhaseError("Maintenance checks are not allowed during combat");
    }
    this.center(id).answer(correct, this.turnNumber);
  }

  get hasPendingMaintenance(): boolean { return this.pendingMaintenance !== null; }

  /**
   * Begin a question-based maintenance check for a center: draws a question
   * from the bank for the center's subject, adaptively by the player's current
   * ability (theta). Guarded against TACTICAL phase. Throws if a maintenance is
   * already open or no question remains.
   */
  startMaintenance(centerId: string): QuestionItem {
    if (this.phase.current === GamePhase.TACTICAL) {
      throw new PhaseError("Maintenance checks are not allowed during combat");
    }
    if (this.pendingMaintenance !== null) {
      throw new PhaseError("A maintenance check is already open; resolve it first");
    }
    const c = this.center(centerId);
    const question = this.bank.selectFor(c.subject, this.rasch.thetaOf(c.subject), this.usedMaintenanceIds);
    if (question === null) {
      throw new RangeError(`No remaining question for center ${centerId} (${c.subject})`);
    }
    this.pendingMaintenance = { centerId, question };
    return question;
  }

  /**
   * Resolve the open maintenance check: updates the player's ability (theta)
   * AND the center's stability (rebellion/recovery). A correct answer raises
   * both; a wrong answer lowers both. Returns the combined result.
   */
  resolveMaintenance(correct: boolean): MaintenanceResult {
    const pending = this.pendingMaintenance;
    if (pending === null) throw new PhaseError("No open maintenance check to resolve");
    const c = this.center(pending.centerId);
    const newTheta = this.rasch.update(c.subject, pending.question.b, correct);
    c.answer(correct, this.turnNumber);
    this.usedMaintenanceIds.add(pending.question.id);
    this.pendingMaintenance = null;
    return {
      centerId: c.id,
      question: pending.question,
      correct,
      newTheta,
      stability: c.stability,
      rebelled: c.rebelled,
    };
  }

  // --- academic phase ---
  enterAcademic(): void { this.phase.transition(GamePhase.ACADEMIC); }
  leaveAcademic(): void { this.phase.transition(GamePhase.STRATEGIC); }

  takeTest(subject: Subject, correct: boolean): TestResult {
    this.testSession.startTest(subject);
    return this.testSession.resolve(correct);
  }

  research(nodeId: string): void {
    this.techTree.research(nodeId, this.kk, this.unit);
  }

  // --- tactical phase ---
  /** Fight the scenario's enemy guard; returns the result and records outcome. */
  fight(): BattleResult {
    this.phase.transition(GamePhase.TACTICAL);
    const result = simulateBattle(
      [
        combatantFromUnit(this.unit, BattleSide.PLAYER),
        { ...this.scenario.enemy, side: BattleSide.ENEMY },
      ],
      this.rng,
    );
    this.lastOutcome = result.outcome;
    this.phase.transition(GamePhase.STRATEGIC);
    return result;
  }

  get won(): boolean {
    return this.lastOutcome === BattleOutcome.PLAYER;
  }

  // --- save / load ---
  save(): GameSave {
    return {
      version: 1,
      scenarioId: this.scenario.id,
      turn: this.turnNumber,
      phase: this.phase.current,
      rngState: this.rng.getState(),
      heroPos: { q: this.heroPos.q, r: this.heroPos.r },
      tokens: this.tokens.balance,
      kk: this.kk.snapshot(),
      thetas: this.rasch.snapshot(),
      researched: this.techTree.researchedIds(),
      unitBonuses: [...this.unit.bonuses],
      lastOutcome: this.lastOutcome,
      centers: this.centers.map((c) => c.toSnapshot()),
      maintenanceUsed: [...this.usedMaintenanceIds].sort(),
    };
  }

  static load(save: GameSave, scenario: ScenarioDef): Game {
    if (save.version !== 1) throw new TypeError(`Unsupported save version: ${save.version}`);
    if (save.scenarioId !== scenario.id) {
      throw new TypeError(
        `Save scenario ${save.scenarioId} does not match provided scenario ${scenario.id}`,
      );
    }
    const g = new Game(scenario, 0);
    // Restore mutable state in place, keeping TestSession's references valid.
    g.rng.restore(save.rngState);
    g.turnNumber = save.turn;
    g.phase.restore(save.phase);
    g.heroPos = new Hex(save.heroPos.q, save.heroPos.r);
    g.tokens.restore(save.tokens);
    g.kk.restore(save.kk);
    g.rasch.restore(save.thetas);
    g.techTree.markResearched(save.researched);
    for (const b of save.unitBonuses) g.unit.addBonus(b);
    g.lastOutcome = save.lastOutcome;
    // Restore knowledge-center state in place (ids match the scenario).
    g.centers.length = 0;
    for (const snap of save.centers ?? []) g.centers.push(KnowledgeCenter.fromSnapshot(snap));
    for (const id of save.maintenanceUsed ?? []) g.usedMaintenanceIds.add(id);
    return g;
  }
}
