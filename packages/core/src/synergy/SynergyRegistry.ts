// SynergyRegistry — cross-subject synergies (vision §6).
//
// Disciplines are not isolated skill trees: combining mastery of two (or more)
// subjects unlocks unique research. E.g. Biológia + Kémia -> biochemical units;
// Matematika + Fizika -> engineering tech; Történelem + Földrajz -> geopolitics.
//
// A synergy declares REQUIREMENTS (minimum KK held per subject — the mastery
// gate) and a COST (KK spent per subject to unlock). Unlocking yields an
// `unlocks` ability id. This module is a pure, stateless validator/pricer; the
// Game tracks which synergies are unlocked (for save/load).

import { Subject, ALL_SUBJECTS, type KKLedger } from "../economy/KKLedger.js";
import { validateBonus, type Bonus } from "../units/BonusSystem.js";

export interface SubjectAmount {
  readonly subject: Subject;
  readonly kk: number;
}

export interface SynergyDef {
  readonly id: string;
  readonly name: string;
  /** Minimum KK the player must currently hold in each subject (mastery gate). */
  readonly requires: readonly SubjectAmount[];
  /** KK spent per subject on unlock. */
  readonly cost: readonly SubjectAmount[];
  /** Ability / research id this synergy unlocks (content-defined). */
  readonly unlocks: string;
  /** Optional army-wide bonuses granted while this synergy is unlocked. */
  readonly armyBonuses?: readonly Bonus[];
}

function assertAmounts(list: readonly SubjectAmount[], field: string, id: string): void {
  for (const a of list) {
    if (!ALL_SUBJECTS.includes(a.subject)) {
      throw new TypeError(`Synergy ${id} ${field} has invalid subject ${String(a.subject)}`);
    }
    if (!Number.isInteger(a.kk) || a.kk < 0) {
      throw new TypeError(`Synergy ${id} ${field} kk must be a non-negative integer`);
    }
  }
}

export function validateSynergy(def: SynergyDef): SynergyDef {
  if (typeof def.id !== "string" || def.id.length === 0) {
    throw new TypeError("SynergyDef.id must be a non-empty string");
  }
  if (typeof def.unlocks !== "string" || def.unlocks.length === 0) {
    throw new TypeError(`Synergy ${def.id} must declare a non-empty unlocks id`);
  }
  const subjects = new Set(def.requires.map((r) => r.subject));
  if (subjects.size < 2) {
    throw new TypeError(`Synergy ${def.id} must require at least two distinct subjects`);
  }
  assertAmounts(def.requires, "requires", def.id);
  assertAmounts(def.cost, "cost", def.id);
  (def.armyBonuses ?? []).forEach(validateBonus);
  return def;
}

export class SynergyRegistry {
  private readonly defs = new Map<string, SynergyDef>();

  constructor(defs: readonly SynergyDef[]) {
    for (const def of defs) {
      validateSynergy(def);
      if (this.defs.has(def.id)) throw new TypeError(`Duplicate synergy id: ${def.id}`);
      this.defs.set(def.id, def);
    }
  }

  ids(): string[] {
    return [...this.defs.keys()];
  }

  get(id: string): SynergyDef {
    const def = this.defs.get(id);
    if (def === undefined) throw new RangeError(`Unknown synergy: ${id}`);
    return def;
  }

  /** True when every requirement is met and the full cost is affordable. */
  canUnlock(id: string, kk: KKLedger): boolean {
    const def = this.get(id);
    for (const r of def.requires) {
      if (kk.balanceOf(r.subject) < r.kk) return false;
    }
    for (const c of def.cost) {
      if (!kk.canSpend(c.subject, c.kk)) return false;
    }
    return true;
  }

  /**
   * Unlock a synergy: verifies requirements, spends the cost, and returns the
   * def. Throws if requirements are unmet or the cost is unaffordable. The
   * caller records the unlocked id (double-unlock is the caller's guard).
   */
  unlock(id: string, kk: KKLedger): SynergyDef {
    const def = this.get(id);
    for (const r of def.requires) {
      if (kk.balanceOf(r.subject) < r.kk) {
        throw new RangeError(`Synergy ${id} requires ${r.kk} ${r.subject} KK`);
      }
    }
    for (const c of def.cost) {
      if (!kk.canSpend(c.subject, c.kk)) {
        throw new RangeError(`Synergy ${id} cannot afford ${c.kk} ${c.subject} KK`);
      }
    }
    for (const c of def.cost) kk.spend(c.subject, c.kk);
    return def;
  }
}
