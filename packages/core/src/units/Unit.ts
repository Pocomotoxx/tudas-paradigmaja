// Unit — a battlefield unit whose effective stats derive from base + bonuses.
//
// A unit belongs to a discipline (Subject-aligned faction). Its base stats are
// fixed data; everything that changes them (tech upgrades, buffs, debuffs) is a
// Bonus in `bonuses`, so the effective stats are a pure function of base +
// bonuses via BonusSystem. Units are mutable only through addBonus (append-only
// within a unit instance), keeping stat changes auditable by source.

import { Subject } from "../economy/KKLedger.js";
import {
  BonusSystem,
  STATS,
  type Bonus,
  type Stat,
  type StatBlock,
} from "./BonusSystem.js";

export interface UnitInit {
  readonly id: string;
  readonly name: string;
  readonly subject: Subject;
  readonly base: StatBlock;
}

export class Unit {
  readonly id: string;
  readonly name: string;
  readonly subject: Subject;
  readonly base: StatBlock;
  private readonly appliedBonuses: Bonus[] = [];

  constructor(init: UnitInit) {
    if (typeof init.id !== "string" || init.id.length === 0) {
      throw new TypeError("Unit.id must be a non-empty string");
    }
    for (const s of STATS) {
      const v = init.base[s];
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
        throw new TypeError(`Unit.base.${s} must be a non-negative finite number`);
      }
    }
    this.id = init.id;
    this.name = init.name;
    this.subject = init.subject;
    this.base = { ...init.base };
  }

  /** Attach a bonus (from a tech node, buff, etc.). */
  addBonus(bonus: Bonus): void {
    this.appliedBonuses.push(bonus);
  }

  /** The bonuses currently applied, in application order. */
  get bonuses(): readonly Bonus[] {
    return this.appliedBonuses;
  }

  /** Effective stats = base with all bonuses applied (pure, recomputed). */
  effectiveStats(): StatBlock {
    return BonusSystem.apply(this.base, this.appliedBonuses);
  }

  stat(stat: Stat): number {
    return this.effectiveStats()[stat];
  }

  /** Serializable snapshot (id, name, subject, base, applied bonuses). */
  toSnapshot(): UnitInit & { bonuses: Bonus[] } {
    return {
      id: this.id,
      name: this.name,
      subject: this.subject,
      base: { ...this.base },
      bonuses: [...this.appliedBonuses],
    };
  }

  static fromSnapshot(snap: UnitInit & { bonuses?: readonly Bonus[] }): Unit {
    const u = new Unit(snap);
    for (const b of snap.bonuses ?? []) u.addBonus(b);
    return u;
  }
}
