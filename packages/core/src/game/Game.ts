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
import { QuestionBank } from "../education/QuestionBank.js";
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

  private heroPos: Hex;
  private turnNumber = 1;
  private lastOutcome: BattleOutcome | null = null;

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
  }

  // --- read-only accessors ---
  get currentPhase(): GamePhase { return this.phase.current; }
  get turn(): number { return this.turnNumber; }
  get tokenBalance(): number { return this.tokens.balance; }
  get outcome(): BattleOutcome | null { return this.lastOutcome; }
  kkOf(subject: Subject): number { return this.kk.balanceOf(subject); }
  unitStats(): StatBlock { return this.unit.effectiveStats(); }
  heroAt(): Hex { return this.heroPos; }
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
    if (this.ownsTokenBuilding()) this.tokens.produce(this.scenario.tokensPerTurn);
    this.turnNumber++;
    this.testSession.newTurn();
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
    return g;
  }
}
