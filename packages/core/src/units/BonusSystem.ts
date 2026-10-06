// BonusSystem — the single, generic modifier mechanism.
//
// Every stat change in the game — a tech-tree upgrade, a morale buff, a poison
// debuff, a synergy bonus, terrain effects — is expressed as a Bonus applied to
// a StatBlock, never as bespoke per-effect code. This mirrors the data-driven
// "engine = rules, content = data" principle: new effects are data.
//
// Application is deterministic and order-independent of insertion: for each
// stat we first sum all ADD bonuses, then apply all MUL bonuses (sorted by id
// for a stable multiply order), then floor to an integer and clamp at 0.

export type Stat = "attack" | "defense" | "health" | "speed" | "initiative";

export const STATS: readonly Stat[] = [
  "attack",
  "defense",
  "health",
  "speed",
  "initiative",
];

export type StatBlock = Readonly<Record<Stat, number>>;

export enum BonusOp {
  ADD = "ADD",
  MUL = "MUL",
}

export interface Bonus {
  readonly id: string;
  readonly stat: Stat;
  readonly op: BonusOp;
  readonly value: number;
  /** Where the bonus came from (tech node id, spell, terrain …), for display/debug. */
  readonly source: string;
}

export function validateBonus(b: Bonus): Bonus {
  if (typeof b.id !== "string" || b.id.length === 0) {
    throw new TypeError("Bonus.id must be a non-empty string");
  }
  if (!STATS.includes(b.stat)) {
    throw new TypeError(`Bonus.stat invalid: ${String(b.stat)} (id=${b.id})`);
  }
  if (b.op !== BonusOp.ADD && b.op !== BonusOp.MUL) {
    throw new TypeError(`Bonus.op invalid: ${String(b.op)} (id=${b.id})`);
  }
  if (typeof b.value !== "number" || !Number.isFinite(b.value)) {
    throw new TypeError(`Bonus.value must be finite (id=${b.id})`);
  }
  return b;
}

export class BonusSystem {
  /**
   * Apply `bonuses` to `base`, returning a new StatBlock. Per stat: sum of ADDs
   * applied first, then MULs (in id order), then Math.floor and clamp at 0.
   */
  static apply(base: StatBlock, bonuses: readonly Bonus[]): StatBlock {
    const out = {} as Record<Stat, number>;
    for (const stat of STATS) {
      const relevant = bonuses.filter((b) => b.stat === stat);
      let value = base[stat];
      for (const b of relevant.filter((b) => b.op === BonusOp.ADD)) {
        value += b.value;
      }
      const muls = relevant
        .filter((b) => b.op === BonusOp.MUL)
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      for (const b of muls) value *= b.value;
      out[stat] = Math.max(0, Math.floor(value));
    }
    return out;
  }
}
