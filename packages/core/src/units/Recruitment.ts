// Recruitment — military locations (fortress/city) supply units for KK.
//
// A military location holds a roster of unit templates it can provide. Each
// template costs Kognitív Kredit in a subject (knowledge is the economy: you
// recruit with what you know, not with gold). The roster validates and prices;
// the Game assigns unique instance ids and spends KK when recruiting.

import { Subject, ALL_SUBJECTS } from "../economy/KKLedger.js";
import { STATS, type StatBlock } from "./BonusSystem.js";

export interface UnitTemplate {
  readonly id: string;
  readonly name: string;
  readonly subject: Subject;
  readonly base: StatBlock;
  /** KK cost, paid in `subject`. */
  readonly kkCost: number;
}

export function validateUnitTemplate(t: UnitTemplate): UnitTemplate {
  if (typeof t.id !== "string" || t.id.length === 0) {
    throw new TypeError("UnitTemplate.id must be a non-empty string");
  }
  if (!ALL_SUBJECTS.includes(t.subject)) {
    throw new TypeError(`UnitTemplate.subject invalid: ${String(t.subject)} (id=${t.id})`);
  }
  if (!Number.isInteger(t.kkCost) || t.kkCost < 0) {
    throw new TypeError(`UnitTemplate.kkCost must be a non-negative integer (id=${t.id})`);
  }
  for (const s of STATS) {
    const v = t.base[s];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      throw new TypeError(`UnitTemplate.base.${s} must be a non-negative finite number (id=${t.id})`);
    }
  }
  return t;
}

export class RecruitmentRoster {
  private readonly templates = new Map<string, UnitTemplate>();

  constructor(templates: readonly UnitTemplate[]) {
    for (const t of templates) {
      validateUnitTemplate(t);
      if (this.templates.has(t.id)) throw new TypeError(`Duplicate template id: ${t.id}`);
      this.templates.set(t.id, t);
    }
  }

  ids(): string[] {
    return [...this.templates.keys()];
  }

  has(id: string): boolean {
    return this.templates.has(id);
  }

  template(id: string): UnitTemplate {
    const t = this.templates.get(id);
    if (t === undefined) throw new RangeError(`Unknown unit template: ${id}`);
    return t;
  }
}
