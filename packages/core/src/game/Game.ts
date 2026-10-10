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
import { SupplyLedger } from "../economy/SupplyLedger.js";
import { BonusOp } from "../units/BonusSystem.js";
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
  BattleSide,
  BattleOutcome,
  type BattleResult,
} from "../combat/Battle.js";
import {
  KnowledgeCenter,
  type KnowledgeCenterSnapshot,
} from "../knowledge/KnowledgeCenter.js";
import { CaptureGate, CaptureStatus } from "../capture/CaptureGate.js";
import { leaderBonusesFor, type ScientistDef } from "../heroes/Scientist.js";
import { SynergyRegistry, type SynergyDef } from "../synergy/SynergyRegistry.js";
import { BonusSystem } from "../units/BonusSystem.js";
import { validateArtifact, type ArtifactDef } from "../artifacts/Artifact.js";
import type { ScenarioDef, KnowledgeCenterPlacement } from "./Scenario.js";
import { RegionGraph, type RegionInit } from "../world/RegionGraph.js";
import { StrategicLoop, type StrategicMove, type StrategicSnapshot } from "./StrategicLoop.js";
import { Difficulty, difficultyParams, type DifficultyParams } from "./Difficulty.js";
import { SubjectUnrest, type SubjectUnrestSnapshot } from "./SubjectUnrest.js";

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
  readonly hiredScientists: string[];
  readonly leaderId: string | null;
  readonly unlockedSynergies: string[];
  readonly heldArtifacts: string[];
  readonly supply: number;
  readonly starving: boolean;
  /** Strategic (region-graph) campaign state, when the scenario has one. */
  readonly strategic?: StrategicSnapshot;
  /** Subject-unrest cascade state (difficulty 3–4). */
  readonly subjectUnrest?: SubjectUnrestSnapshot;
  /** Per-center turn of the last allowed rebellion (rebellion-interval gate). */
  readonly lastRebellionTurns?: Record<string, number>;
}

/** Build a battle combatant from an abstract strategic strength value. */
function strategicCombatant(id: string, side: BattleSide, strength: number): { id: string; side: BattleSide; stats: StatBlock } {
  const s = Math.max(1, Math.round(strength));
  return {
    id,
    side,
    stats: {
      attack: s,
      defense: Math.max(1, Math.round(s / 2)),
      health: s * 3,
      speed: 4,
      initiative: 4,
    },
  };
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
  private readonly scientists = new Map<string, ScientistDef>();
  private readonly hiredScientists = new Set<string>();
  private leaderId: string | null = null;
  private readonly synergyRegistry: SynergyRegistry;
  private readonly unlockedSynergies = new Set<string>();
  private readonly artifacts = new Map<string, ArtifactDef>();
  private readonly heldArtifacts = new Set<string>();
  private pendingArtifactCapture: { id: string; gate: CaptureGate } | null = null;
  private readonly hardMode: boolean;
  private readonly supply: SupplyLedger;
  private readonly supplyPerTurn: number;
  private readonly unitUpkeep: number;
  private starving = false;
  private readonly garrisons = new Map<string, RecruitmentRoster>();
  private readonly ladders = new Map<string, UnitLadder>();
  private readonly recruits: Unit[] = [];
  private readonly recruitProvenance = new Map<string, { locationId: string; templateId: string }>();

  private strategic: StrategicLoop | null = null;
  private readonly diff: DifficultyParams;
  private readonly subjectUnrest: SubjectUnrest;
  private readonly lastRebellionTurn = new Map<string, number>();

  private heroPos: Hex;
  private turnNumber = 1;
  private lastOutcome: BattleOutcome | null = null;
  private pendingMaintenance: { centerId: string; question: QuestionItem } | null = null;
  private readonly usedMaintenanceIds = new Set<string>();

  constructor(scenario: ScenarioDef, seed: number) {
    this.scenario = scenario;
    this.diff = difficultyParams(scenario.difficulty ?? Difficulty.ONE);
    this.subjectUnrest = new SubjectUnrest({ enabled: this.diff.subjectUnrestCascade });
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

    for (const s of scenario.scientists ?? []) {
      if (this.scientists.has(s.id)) throw new TypeError(`Duplicate scientist: ${s.id}`);
      this.scientists.set(s.id, s);
    }

    this.synergyRegistry = new SynergyRegistry(scenario.synergies ?? []);

    this.hardMode = scenario.hardMode ?? false;
    this.supplyPerTurn = scenario.supplyPerTurn ?? 0;
    this.unitUpkeep = scenario.unitUpkeep ?? 1;
    this.supply = new SupplyLedger(scenario.initialSupply ?? 0);

    for (const a of scenario.artifacts ?? []) {
      validateArtifact(a);
      if (this.artifacts.has(a.id)) throw new TypeError(`Duplicate artifact: ${a.id}`);
      this.artifacts.set(a.id, a);
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

    // Optional strategic (region-graph) campaign layer. Army movement happens on
    // the region graph; contested entries are resolved by a real hex battle
    // (simulateBattle) via the shared seeded RNG, keeping the two-layer design.
    if (scenario.strategic !== undefined) {
      const st = scenario.strategic;
      const regions: RegionInit[] = st.regions.map((r) => ({
        id: r.id,
        adjacent: r.adjacent,
        ...(r.name !== undefined ? { name: r.name } : {}),
        ...(r.owner !== undefined ? { owner: r.owner } : {}),
        ...(r.enterCost !== undefined ? { enterCost: r.enterCost } : {}),
        ...(r.centerId !== undefined ? { centerId: r.centerId } : {}),
        ...(r.blocked !== undefined ? { blocked: r.blocked } : {}),
      }));
      const garrisons: Record<string, number> = {};
      const subjects: Record<string, string> = {};
      const kkYields: Record<string, number> = {};
      for (const r of st.regions) {
        if (r.garrison !== undefined) garrisons[r.id] = r.garrison;
        if (r.subject !== undefined) {
          subjects[r.id] = r.subject;
          kkYields[r.id] = r.kkPerTurn ?? 1; // a region with a subject yields KK (default 1)
        }
      }
      this.strategic = new StrategicLoop({
        graph: new RegionGraph(regions),
        playerFaction: st.playerFaction,
        armyRegion: st.armyRegion,
        armyStrength: st.armyStrength,
        moveBudget: st.moveBudget,
        garrisons,
        subjects,
        kkYields,
        resolver: (atk, def, rng) =>
          simulateBattle(
            [strategicCombatant("army", BattleSide.PLAYER, atk), strategicCombatant("garrison", BattleSide.ENEMY, def)],
            rng as SeededRng,
          ).outcome === BattleOutcome.PLAYER,
      });
    }
  }

  /**
   * Apply a maintenance answer to a center: feed the subject-unrest cascade,
   * then let the center update. A newly-triggered rebellion is suppressed when
   * the difficulty's rebellion interval has not yet elapsed since this center's
   * last rebellion (the answer is reverted so no rebellion occurs this turn).
   * Returns the authoritative center instance (may be a restored one).
   */
  private applyCenterAnswer(id: string, correct: boolean): KnowledgeCenter {
    let c = this.center(id);
    this.subjectUnrest.recordAnswer(c.subject, correct);
    const wasRebelled = c.rebelled;
    const before = c.toSnapshot();
    c.answer(correct, this.turnNumber);
    if (!wasRebelled && c.rebelled) {
      const last = this.lastRebellionTurn.get(id);
      if (last !== undefined && this.turnNumber - last < this.diff.rebellionIntervalTurns) {
        // Rebellions can occur at most every rebellionIntervalTurns turns.
        const idx = this.centers.findIndex((x) => x.id === id);
        c = KnowledgeCenter.fromSnapshot(before);
        this.centers[idx] = c;
      } else {
        this.lastRebellionTurn.set(id, this.turnNumber);
      }
    }
    return c;
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
    if (this.hardMode) {
      // Hard mode: produce supply, then pay army upkeep; unmet upkeep starves.
      this.supply.produce(this.supplyPerTurn);
      const upkeep = this.armySize * this.unitUpkeep;
      if (this.supply.canSpend(upkeep)) {
        this.supply.spend(upkeep);
        this.starving = false;
      } else {
        this.supply.restore(0);
        this.starving = true;
      }
    }
    // Strategic KK income: each owned region produces its subject's KK.
    if (this.strategic !== null) {
      for (const { subject, amount } of this.strategic.ownedKKYield()) {
        this.kk.earn(subject as Subject, amount);
      }
    }
    // Subject-unrest cascade (difficulty 3–4): a subject under unrest sheds
    // some of its own units to desertion, at a chance that grows with unrest.
    if (this.subjectUnrest.isEnabled) {
      for (const subj of this.subjectUnrest.unrestfulSubjects()) {
        const units = this.recruits.filter((u) => u.subject === subj).sort((a, b) => (a.id < b.id ? -1 : 1));
        const n = this.subjectUnrest.rollDesertions(subj, units.length, this.rng);
        for (let i = 0; i < n; i++) {
          const gone = units[i]!;
          const idx = this.recruits.findIndex((u) => u.id === gone.id);
          if (idx >= 0) this.recruits.splice(idx, 1);
          this.recruitProvenance.delete(gone.id);
        }
      }
    }
    this.turnNumber++;
    this.testSession.newTurn();
    this.strategic?.beginTurn(); // refill the army's movement budget
  }

  // --- difficulty & subject unrest (I47/I48) ---
  get difficulty(): Difficulty { return this.diff.level; }
  get choiceCount(): number { return this.diff.choiceCount; }
  get rebellionIntervalTurns(): number { return this.diff.rebellionIntervalTurns; }
  /** Current unrest for a subject (0 unless difficulty 3–4 with wrong answers). */
  unrestOf(subject: Subject): number { return this.subjectUnrest.unrestOf(subject); }
  /** Desertion chance for a subject's units this turn (0..1). */
  desertionChance(subject: Subject): number { return this.subjectUnrest.desertionChance(subject); }

  // --- strategic (region-graph) campaign layer ---
  get hasStrategicLayer(): boolean { return this.strategic !== null; }

  private requireStrategic(): StrategicLoop {
    if (this.strategic === null) throw new Error("This scenario has no strategic layer");
    return this.strategic;
  }

  /** The region the player army currently occupies. */
  get armyRegion(): string { return this.requireStrategic().army; }

  /** Movement points the army has left this turn. */
  get movementBudget(): number { return this.requireStrategic().budget; }

  /** Regions the army can move to this turn (id, cost, whether enemy-held). */
  strategicTargets(): Array<{ id: string; cost: number; enemy: boolean }> {
    return this.requireStrategic().reachableTargets();
  }

  /** Owner faction of a strategic region, or undefined if neutral. */
  regionOwner(id: string): string | undefined {
    return this.requireStrategic().regions.owner(id);
  }

  /** The discipline a region teaches/produces, or undefined. */
  regionSubject(id: string): Subject | undefined {
    const s = this.requireStrategic().subjectOf(id);
    return s as Subject | undefined;
  }

  /** KK a region yields per turn in its subject while owned. */
  regionKKYield(id: string): number {
    return this.requireStrategic().kkYieldOf(id);
  }

  /**
   * Questions to answer when capturing a region: `count` items drawn from the
   * region's subject, adapted to the player's current theta for that subject,
   * each distinct. Empty if the region has no subject or the bank lacks items.
   */
  captureQuestions(regionId: string, count = 3): QuestionItem[] {
    const subject = this.regionSubject(regionId);
    if (subject === undefined) return [];
    const theta = this.rasch.thetaOf(subject);
    const picked: QuestionItem[] = [];
    const used = new Set<string>();
    for (let i = 0; i < count; i++) {
      const q = this.bank.selectFor(subject, theta, used);
      if (q === null) break;
      picked.push(q);
      used.add(q.id);
    }
    return picked;
  }

  /**
   * Move the army to a region. Neutral/own regions are occupied; an enemy region
   * triggers a hex battle (seeded) — a win captures it, a loss holds the line.
   */
  moveArmy(to: string): StrategicMove {
    return this.requireStrategic().moveArmy(to, this.rng);
  }

  // --- hard mode (Ellátmány / supply logistics) ---
  get isHardMode(): boolean { return this.hardMode; }
  get supplyBalance(): number { return this.supply.balance; }
  get isStarving(): boolean { return this.starving; }

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
    this.center(id); // validates id (RangeError if unknown)
    if (!this.capturedCenters.has(id)) {
      throw new PhaseError(`Center ${id} is not captured yet`);
    }
    this.applyCenterAnswer(id, correct);
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
    const subject = this.center(pending.centerId).subject;
    const newTheta = this.rasch.update(subject, pending.question.b, correct);
    const c = this.applyCenterAnswer(pending.centerId, correct);
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

  // --- scientist heroes ---
  scientistIds(): string[] { return [...this.scientists.keys()]; }
  isScientistHired(id: string): boolean { return this.hiredScientists.has(id); }
  get currentLeaderId(): string | null { return this.leaderId; }

  private scientist(id: string): ScientistDef {
    const s = this.scientists.get(id);
    if (s === undefined) throw new RangeError(`Unknown scientist: ${id}`);
    return s;
  }

  /** A location is controlled if it is a captured center or a garrison location. */
  private controlsLocation(locationId: string): boolean {
    return this.capturedCenters.has(locationId) || this.garrisons.has(locationId);
  }

  /**
   * Hire a scientist at their birthplace. Requires the birthplace location to be
   * under the player's control (a captured center or a garrison). Spends the KK
   * cost; not allowed during combat.
   */
  hireScientist(id: string): ScientistDef {
    if (this.phase.current === GamePhase.TACTICAL) {
      throw new PhaseError("Cannot hire a scientist during combat");
    }
    const def = this.scientist(id);
    if (this.hiredScientists.has(id)) throw new RangeError(`Scientist ${id} already hired`);
    if (!this.controlsLocation(def.birthplaceLocationId)) {
      throw new RangeError(`Birthplace ${def.birthplaceLocationId} of ${id} is not controlled`);
    }
    this.kk.spend(def.cost.subject, def.cost.kk); // throws if insufficient
    this.hiredScientists.add(id);
    return def;
  }

  /** Assign a hired scientist to lead the army, or null to clear. */
  setLeader(id: string | null): void {
    if (id === null) { this.leaderId = null; return; }
    if (!this.hiredScientists.has(id)) throw new RangeError(`Scientist ${id} is not hired`);
    this.leaderId = id;
  }

  // --- synergies (cross-subject research) ---
  synergyIds(): string[] { return this.synergyRegistry.ids(); }
  isSynergyUnlocked(id: string): boolean { return this.unlockedSynergies.has(id); }
  canUnlockSynergy(id: string): boolean {
    return !this.unlockedSynergies.has(id) && this.synergyRegistry.canUnlock(id, this.kk);
  }

  /** Unlock a synergy: spends its KK cost (mastery-gated); records it unlocked. */
  unlockSynergy(id: string): SynergyDef {
    if (this.phase.current === GamePhase.TACTICAL) {
      throw new PhaseError("Cannot unlock a synergy during combat");
    }
    if (this.unlockedSynergies.has(id)) throw new RangeError(`Synergy ${id} already unlocked`);
    const def = this.synergyRegistry.unlock(id, this.kk); // verifies + spends
    this.unlockedSynergies.add(id);
    return def;
  }

  /** Army-wide bonuses from all unlocked synergies. */
  private synergyArmyBonuses(): Bonus[] {
    const out: Bonus[] = [];
    for (const id of this.unlockedSynergies) out.push(...(this.synergyRegistry.get(id).armyBonuses ?? []));
    return out;
  }

  // --- artifacts ---
  artifactIds(): string[] { return [...this.artifacts.keys()]; }
  isArtifactHeld(id: string): boolean { return this.heldArtifacts.has(id); }
  get hasPendingArtifactCapture(): boolean { return this.pendingArtifactCapture !== null; }

  private artifact(id: string): ArtifactDef {
    const a = this.artifacts.get(id);
    if (a === undefined) throw new RangeError(`Unknown artifact: ${id}`);
    return a;
  }

  /** Directly acquire a non-capture artifact (phase != TACTICAL). */
  acquireArtifact(id: string): ArtifactDef {
    if (this.phase.current === GamePhase.TACTICAL) {
      throw new PhaseError("Cannot acquire an artifact during combat");
    }
    const def = this.artifact(id);
    if (def.capture !== undefined) throw new RangeError(`Artifact ${id} must be captured, not acquired directly`);
    if (this.heldArtifacts.has(id)) throw new RangeError(`Artifact ${id} already held`);
    this.heldArtifacts.add(id);
    return def;
  }

  /** Begin the three-question timed capture for a capture-gated artifact. */
  beginArtifactCapture(id: string, nowMs: number): QuestionItem {
    if (this.phase.current === GamePhase.TACTICAL) {
      throw new PhaseError("Cannot capture an artifact during combat");
    }
    if (this.pendingArtifactCapture !== null) throw new PhaseError("An artifact capture is already in progress");
    const def = this.artifact(id);
    if (def.capture === undefined) throw new RangeError(`Artifact ${id} is acquired directly, not captured`);
    if (this.heldArtifacts.has(id)) throw new RangeError(`Artifact ${id} already held`);
    const gate = new CaptureGate({
      targetId: id,
      subject: def.capture.subject,
      bank: this.bank,
      rasch: this.rasch,
      windowMs: def.capture.windowMs,
      ...(def.capture.requiredCorrect !== undefined ? { requiredCorrect: def.capture.requiredCorrect } : {}),
    });
    const q = gate.start(nowMs);
    this.pendingArtifactCapture = { id, gate };
    return q;
  }

  /** Submit an answer to the pending artifact capture; grants it on success. */
  submitArtifactCapture(correct: boolean, nowMs: number): { status: CaptureStatus; held: boolean } {
    if (this.pendingArtifactCapture === null) throw new PhaseError("No artifact capture in progress");
    const { id, gate } = this.pendingArtifactCapture;
    const res = gate.submit(correct, nowMs);
    let held = false;
    if (res.status === CaptureStatus.SUCCESS) {
      this.heldArtifacts.add(id);
      held = true;
    }
    if (res.status !== CaptureStatus.PENDING) this.pendingArtifactCapture = null;
    return { status: res.status, held };
  }

  /** Army-wide bonuses from all held artifacts. */
  private artifactArmyBonuses(): Bonus[] {
    const out: Bonus[] = [];
    for (const id of this.heldArtifacts) out.push(...this.artifact(id).armyBonuses);
    return out;
  }

  /** Fight the scenario's enemy guard with the whole army; records outcome. */
  fight(): BattleResult {
    this.phase.transition(GamePhase.TACTICAL);
    const leader = this.leaderId !== null ? this.scientists.get(this.leaderId) ?? null : null;
    const synergyBonuses = this.synergyArmyBonuses();
    const artifactBonuses = this.artifactArmyBonuses();
    const starvingBonuses: Bonus[] =
      this.hardMode && this.starving
        ? [{ id: "starving", stat: "attack", op: BonusOp.ADD, value: -2, source: "supply" }]
        : [];
    const army = [this.unit, ...this.recruits].map((u) => {
      const leaderB = leader !== null ? leaderBonusesFor(leader, u.subject) : [];
      const stats = BonusSystem.apply(u.base, [...u.bonuses, ...leaderB, ...synergyBonuses, ...artifactBonuses, ...starvingBonuses]);
      return { id: u.id, side: BattleSide.PLAYER, stats };
    });
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
      hiredScientists: [...this.hiredScientists].sort(),
      leaderId: this.leaderId,
      unlockedSynergies: [...this.unlockedSynergies].sort(),
      heldArtifacts: [...this.heldArtifacts].sort(),
      supply: this.supply.balance,
      starving: this.starving,
      ...(this.strategic ? { strategic: this.strategic.snapshot() } : {}),
      subjectUnrest: this.subjectUnrest.snapshot(),
      lastRebellionTurns: Object.fromEntries([...this.lastRebellionTurn.entries()].sort()),
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
    for (const id of save.hiredScientists ?? []) g.hiredScientists.add(id);
    g.leaderId = save.leaderId ?? null;
    for (const id of save.unlockedSynergies ?? []) g.unlockedSynergies.add(id);
    for (const id of save.heldArtifacts ?? []) g.heldArtifacts.add(id);
    if (save.supply !== undefined) g.supply.restore(save.supply);
    g.starving = save.starving ?? false;
    if (save.strategic !== undefined && g.strategic !== null) g.strategic.restore(save.strategic);
    if (save.subjectUnrest !== undefined) g.subjectUnrest.restore(save.subjectUnrest);
    for (const [id, t] of Object.entries(save.lastRebellionTurns ?? {})) g.lastRebellionTurn.set(id, t);
    return g;
  }
}
