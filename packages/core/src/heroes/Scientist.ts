// Scientist — a hero (scientist/explorer) who leads an army (vision: heroes).
//
// A scientist has a home discipline and discipline AFFINITIES: bonuses to units
// of a given subject, and optionally a malus to foreign subjects (affinity
// subject "*"). Leading an army applies these modifiers on top of each unit's
// own base + bonuses — without mutating the unit (the effect lasts only while
// led). The engine is name-agnostic: names/birthplaces are content.
//
// Everything is expressed through the generic BonusSystem, so a malus is just a
// Bonus with a negative ADD or a <1 MUL. No new effect machinery.

import { Subject, ALL_SUBJECTS } from "../economy/KKLedger.js";
import { BonusSystem, validateBonus, type Bonus, type StatBlock } from "../units/BonusSystem.js";
import type { Unit } from "../units/Unit.js";

/** Affinity target: a specific subject, or "*" for any FOREIGN subject
 * (one that is not the scientist's home discipline). */
export const FOREIGN = "*" as const;
export type AffinityTarget = Subject | typeof FOREIGN;

export interface ScientistAffinity {
  readonly subject: AffinityTarget;
  readonly bonuses: readonly Bonus[];
}

export interface ScientistDef {
  readonly id: string;
  /** Display name — content (may be a real historical figure); engine ignores it. */
  readonly name: string;
  /** Home discipline. */
  readonly subject: Subject;
  /** Location id where the scientist can be recruited (their birthplace). */
  readonly birthplaceLocationId: string;
  /** KK cost to recruit, in a subject. */
  readonly cost: { readonly subject: Subject; readonly kk: number };
  readonly affinities: readonly ScientistAffinity[];
}

export function validateScientist(def: ScientistDef): ScientistDef {
  if (typeof def.id !== "string" || def.id.length === 0) {
    throw new TypeError("ScientistDef.id must be a non-empty string");
  }
  if (typeof def.name !== "string" || def.name.length === 0) {
    throw new TypeError(`Scientist ${def.id} must have a non-empty name`);
  }
  if (!ALL_SUBJECTS.includes(def.subject)) {
    throw new TypeError(`Scientist ${def.id} has invalid subject ${String(def.subject)}`);
  }
  if (typeof def.birthplaceLocationId !== "string" || def.birthplaceLocationId.length === 0) {
    throw new TypeError(`Scientist ${def.id} must have a birthplaceLocationId`);
  }
  if (!ALL_SUBJECTS.includes(def.cost.subject) || !Number.isInteger(def.cost.kk) || def.cost.kk < 0) {
    throw new TypeError(`Scientist ${def.id} has an invalid cost`);
  }
  for (const a of def.affinities) {
    if (a.subject !== FOREIGN && !ALL_SUBJECTS.includes(a.subject)) {
      throw new TypeError(`Scientist ${def.id} affinity has invalid subject ${String(a.subject)}`);
    }
    a.bonuses.forEach(validateBonus);
  }
  return def;
}

/**
 * The leader bonuses a scientist confers on a unit of `unitSubject`:
 * exact-subject affinities that match, plus any FOREIGN ("*") affinity when the
 * unit's subject is not the scientist's home discipline.
 */
export function leaderBonusesFor(def: ScientistDef, unitSubject: Subject): Bonus[] {
  const out: Bonus[] = [];
  for (const a of def.affinities) {
    if (a.subject === unitSubject) out.push(...a.bonuses);
    else if (a.subject === FOREIGN && unitSubject !== def.subject) out.push(...a.bonuses);
  }
  return out;
}

/** A unit's effective stats while led by `def` (base + own bonuses + leader bonuses). */
export function effectiveStatsUnderLeader(unit: Unit, def: ScientistDef): StatBlock {
  return BonusSystem.apply(unit.base, [...unit.bonuses, ...leaderBonusesFor(def, unit.subject)]);
}
