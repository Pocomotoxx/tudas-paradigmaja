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
import { Unit, type UnitInit } from "../units/Unit.js";
import { TechTree } from "../units/TechTree.js";
import { RecruitmentRoster } from "../units/Recruitment.js";
import { UnitLadder, type LadderTier } from "../units/UnitLadder.js";
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
import { CaptureGate, CaptureStatus } from "../capture/CaptureGate.js";
import type { ScenarioDef, KnowledgeCenterPlacement } from "./Scenario.js";

export interface GameSave {
  readonly version: 2;
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
  readonly capturedCenters: string[];
  readonly recruits: (UnitInit & { bonuses: Bonus[] })[];
  readonly recruitProvenance: { unitId: string; locationId: string; templateId: string }[];
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
  private readonly centerPlacements = new Map<string, KnowledgeCenterPlacement>();
  private readonly capturedCenters = new Set<string>();
  private pendingCapture: CaptureGate | null = null;
  private readonly garrisons = new Map<string, RecruitmentRoster>();
  private readonly ladders = new Map<string, UnitLadder>();
  private readonly recruits: Unit[] = [];
  private readonly recruitProvenance = new Map<string, { locationId: string; templateId: string }>();

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

    for (const g of scenario.garrisons ?? []) {
      if (this.garrisons.has(g.locationId)) {
        throw new TypeError(`Duplicate garrison for location: ${g.locationId}`);
      }
      this.garrisons.set(g.locationId, new RecruitmentRoster(g.templates));
      // If every template carries tier info and one subject, the garrison is an
      // upgradable ladder.
      const asLadder = g.templates as readonly LadderTier[];
      if (asLadder.length > 0 && asLadder.every((t) => Number.isInteger(t.tier))) {
        const subject = asLadder[0]!.subject;
        if (asLadder.every((t) => t.subject === subject)) {
          this.ladders.set(g.locationId, new UnitLadder(subject, asLadder));
        }
      }
    }

    this.centers = (scenario.knowledgeCenters ?? []).map((p) => {
      this.centerHex.set(p.id, new Hex(p.hex.q, p.hex.r));
      this.centerPlacements.set(p.id, p);
      if (!p.requiresCapture) this.capturedCenters.add(p.id); // owned from start
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
      // Unified economy: token production is the sum of CAPTURED centers'
      // stepped stability output (rebelled centers output 0 — supply cut off).
      for (const c of this.centers) {
        if (this.capturedCenters.has(c.id)) this.tokens.produce(c.tokenOutput());
      }
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

  isCenterCaptured(id: string): boolean {
    this.center(id); // validates id
    return this.capturedCenters.has(id);
  }

  /** Captured centers whose maintenance check is due at the current turn. */
  maintenanceDueIds(): string[] {
    return this.centers
      .filter((c) => this.capturedCenters.has(c.id) && c.isCheckDue(this.turnNumber))
      .map((c) => c.id);
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
    const c = this.center(id); // validates id (RangeError if unknown)
    if (!this.capturedCenters.has(id)) {
      throw new PhaseError(`Center ${id} is not captured yet`);
    }
    c.answer(correct, this.turnNumber);
  }

  // --- three-question timed capture (vision §11) ---
  get hasPendingCapture(): boolean { return this.pendingCapture !== null; }

  /**
   * Begin capturing a center via the three-question timed gate. The center must
   * require capture and not already be captured. `nowMs` is the caller-supplied
   * clock (core stays clock-free). Guarded against TACTICAL phase.
   */
  beginCapture(centerId: string, nowMs: number): QuestionItem {
    if (this.phase.current === GamePhase.TACTICAL) {
      throw new PhaseError("Capture is not allowed during combat");
    }
    if (this.pendingCapture !== null) {
      throw new PhaseError("A capture is already in progress");
    }
    const c = this.center(centerId);
    const placement = this.centerPlacements.get(centerId)!;
    if (!placement.requiresCapture) {
      throw new PhaseError(`Center ${centerId} does not require capture`);
    }
    if (this.capturedCenters.has(centerId)) {
      throw new PhaseError(`Center ${centerId} is already captured`);
    }
    const gate = new CaptureGate({
      targetId: centerId,
      subject: c.subject,
      bank: this.bank,
      rasch: this.rasch,
      windowMs: placement.captureWindowMs ?? 30000,
      ...(placement.captureRequiredCorrect !== undefined
        ? { requiredCorrect: placement.captureRequiredCorrect }
        : {}),
    });
    const q = gate.start(nowMs);
    this.pendingCapture = gate;
    return q;
  }

  /** Submit an answer to the pending capture at `nowMs`; grants control on success. */
  submitCapture(correct: boolean, nowMs: number): { status: CaptureStatus; captured: boolean } {
    if (this.pendingCapture === null) throw new PhaseError("No capture in progress");
    const res = this.pendingCapture.submit(correct, nowMs);
    let captured = false;
    if (res.status === CaptureStatus.SUCCESS) {
      this.capturedCenters.add(this.pendingCapture.targetId);
      captured = true;
    }
    if (res.status !== CaptureStatus.PENDING) this.pendingCapture = null;
    return { status: res.status, captured };
  }

  /** Current pending capture status, or null if none. */
  captureStatus(): CaptureStatus | null {
    return this.pendingCapture?.status ?? null;
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
    if (!this.capturedCenters.has(centerId)) {
      throw new PhaseError(`Center ${centerId} is not captured yet`);
    }
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
  // --- recruitment (military locations) ---
  get armySize(): number { return 1 + this.recruits.length; }
  armyUnitIds(): string[] { return [this.unit.id, ...this.recruits.map((u) => u.id)]; }
  garrisonTemplateIds(locationId: string): string[] {
    return this.garrison(locationId).ids();
  }

  private garrison(locationId: string): RecruitmentRoster {
    const r = this.garrisons.get(locationId);
    if (r === undefined) throw new RangeError(`No garrison at location: ${locationId}`);
    return r;
  }

  /**
   * Recruit a unit from a military location's roster, paying its KK cost in the
   * template's subject. The new unit joins the army with a unique instance id.
   */
  recruit(locationId: string, templateId: string): Unit {
    if (this.phase.current === GamePhase.TACTICAL) {
      throw new PhaseError("Cannot recruit during combat");
    }
    const template = this.garrison(locationId).template(templateId);
    this.kk.spend(template.subject, template.kkCost); // throws if insufficient
    const unit = new Unit({
      id: `${templateId}#${this.recruits.length + 1}`,
      name: template.name,
      subject: template.subject,
      base: template.base,
    });
    this.recruits.push(unit);
    this.recruitProvenance.set(unit.id, { locationId, templateId });
    return unit;
  }

  /** The current ladder template id of a recruited unit, or null if not ladder-sourced. */
  recruitTemplateId(unitId: string): string | null {
    return this.recruitProvenance.get(unitId)?.templateId ?? null;
  }

  /**
   * Upgrade a recruited unit one tier up its garrison's ladder, paying the KK
   * cost in the unit's subject. Stats rise to the next tier; the instance id and
   * any applied bonuses are preserved. Throws if the unit is not ladder-sourced,
   * already at the top tier, or KK is insufficient. Not allowed during combat.
   */
  upgradeUnit(unitId: string): Unit {
    if (this.phase.current === GamePhase.TACTICAL) {
      throw new PhaseError("Cannot upgrade during combat");
    }
    const prov = this.recruitProvenance.get(unitId);
    if (prov === undefined) throw new RangeError(`Unit ${unitId} is not an upgradable recruit`);
    const ladder = this.ladders.get(prov.locationId);
    if (ladder === undefined) throw new RangeError(`Location ${prov.locationId} has no upgrade ladder`);
    const next = ladder.next(prov.templateId);
    if (next === null) throw new RangeError(`Unit ${unitId} is already at the top tier`);

    this.kk.spend(next.subject, ladder.upgradeCost(prov.templateId)); // throws if insufficient
    const idx = this.recruits.findIndex((u) => u.id === unitId);
    const old = this.recruits[idx]!;
    const upgraded = new Unit({ id: old.id, name: next.name, subject: next.subject, base: next.base });
    for (const b of old.bonuses) upgraded.addBonus(b);
    this.recruits[idx] = upgraded;
    this.recruitProvenance.set(unitId, { locationId: prov.locationId, templateId: next.id });
    return upgraded;
  }

  /** Fight the scenario's enemy guard with the whole army; records outcome. */
  fight(): BattleResult {
    this.phase.transition(GamePhase.TACTICAL);
    const army = [this.unit, ...this.recruits].map((u) =>
      combatantFromUnit(u, BattleSide.PLAYER),
    );
    const result = simulateBattle(
      [...army, { ...this.scenario.enemy, side: BattleSide.ENEMY }],
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
      version: 2,
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
      capturedCenters: [...this.capturedCenters].sort(),
      recruits: this.recruits.map((u) => u.toSnapshot()),
      recruitProvenance: [...this.recruitProvenance.entries()]
        .map(([unitId, p]) => ({ unitId, locationId: p.locationId, templateId: p.templateId }))
        .sort((a, b) => (a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0)),
    };
  }

  static load(save: GameSave, scenario: ScenarioDef): Game {
    if (save.version !== 2) throw new TypeError(`Unsupported save version: ${save.version}`);
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
    if (save.capturedCenters !== undefined) {
      g.capturedCenters.clear();
      for (const id of save.capturedCenters) g.capturedCenters.add(id);
    }
    for (const snap of save.recruits ?? []) g.recruits.push(Unit.fromSnapshot(snap));
    for (const p of save.recruitProvenance ?? []) {
      g.recruitProvenance.set(p.unitId, { locationId: p.locationId, templateId: p.templateId });
    }
    return g;
  }
}
