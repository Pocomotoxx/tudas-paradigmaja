// UnitLadder — a faction's seven-tier unit progression (vision faction design).
//
// Each discipline city has a ladder of unit templates from tier 1 (basic) up to
// tier 7 (master), e.g. Numeris: Számőr -> Geometrista -> ... -> Axiomatikus.
// A ladder validates that its tiers are contiguous from 1 and that each tier's
// `upgradesTo` points at the next tier's template (the top tier has none). It
// exposes tier lookup, the upgrade path, and the KK cost to upgrade one step.
//
// This is pure structure/data; Game integration (recruit at tier, upgrade a
// unit) builds on it in a later iteration. LadderTier is UnitTemplate-compatible
// so a ladder's tiers can also feed a RecruitmentRoster directly.

import type { Subject } from "../economy/KKLedger.js";
import { validateUnitTemplate, type UnitTemplate } from "./Recruitment.js";

export interface LadderTier extends UnitTemplate {
  /** Position in the ladder, contiguous from 1. */
  readonly tier: number;
  /** Template id of the next tier, or undefined for the top tier. */
  readonly upgradesTo?: string;
}

export class UnitLadder {
  readonly subject: Subject;
  private readonly byTierMap = new Map<number, LadderTier>();
  private readonly byIdMap = new Map<string, LadderTier>();

  constructor(subject: Subject, tiers: readonly LadderTier[]) {
    this.subject = subject;
    if (tiers.length === 0) throw new TypeError("UnitLadder needs at least one tier");

    const sorted = [...tiers].sort((a, b) => a.tier - b.tier);
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i]!;
      validateUnitTemplate(t);
      if (t.subject !== subject) {
        throw new TypeError(`Ladder tier ${t.id} subject ${t.subject} != ladder subject ${subject}`);
      }
      if (t.tier !== i + 1) {
        throw new TypeError(`Ladder tiers must be contiguous from 1; expected ${i + 1}, got ${t.tier} (${t.id})`);
      }
      if (this.byIdMap.has(t.id)) throw new TypeError(`Duplicate ladder tier id: ${t.id}`);
      this.byTierMap.set(t.tier, t);
      this.byIdMap.set(t.id, t);
    }

    // Validate the upgrade chain: each non-top tier points at the next tier's id.
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i]!;
      const isTop = i === sorted.length - 1;
      if (isTop) {
        if (t.upgradesTo !== undefined) {
          throw new TypeError(`Top tier ${t.id} must not have upgradesTo`);
        }
      } else {
        const expected = sorted[i + 1]!.id;
        if (t.upgradesTo !== expected) {
          throw new TypeError(`Tier ${t.id} upgradesTo must be ${expected}, got ${String(t.upgradesTo)}`);
        }
      }
    }
  }

  get size(): number {
    return this.byTierMap.size;
  }

  tiers(): LadderTier[] {
    return [...this.byTierMap.values()].sort((a, b) => a.tier - b.tier);
  }

  byTier(tier: number): LadderTier {
    const t = this.byTierMap.get(tier);
    if (t === undefined) throw new RangeError(`No tier ${tier} in ladder`);
    return t;
  }

  byId(id: string): LadderTier {
    const t = this.byIdMap.get(id);
    if (t === undefined) throw new RangeError(`Unknown ladder tier id: ${id}`);
    return t;
  }

  /** The next tier up from `id`, or null if `id` is the top tier. */
  next(id: string): LadderTier | null {
    const t = this.byId(id);
    if (t.upgradesTo === undefined) return null;
    return this.byId(t.upgradesTo);
  }

  /** KK cost to upgrade one step from `id` (the next tier's kkCost). Throws at the top. */
  upgradeCost(id: string): number {
    const n = this.next(id);
    if (n === null) throw new RangeError(`Tier ${id} is the top tier; cannot upgrade`);
    return n.kkCost;
  }
}
