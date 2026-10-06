// TechTree — asymmetric, subject-bound development nodes.
//
// A node costs Kognitív Kredit in ONE subject and, when researched, grants a
// set of bonuses to a unit of that subject. Nodes may have prerequisites
// (other node ids), enabling branching, asymmetric trees: a player can go wide
// (polymath) or deep (specialist). Researching deducts KK and is irreversible
// within a game.
//
// This iteration models single-unit development (AC8: KK -> node -> stat
// increase). Synergy nodes (cross-subject) and per-army application build on
// the same structure in later iterations.

import { KKLedger, Subject } from "../economy/KKLedger.js";
import { validateBonus, type Bonus } from "./BonusSystem.js";
import { Unit } from "./Unit.js";

export interface TechNode {
  readonly id: string;
  readonly subject: Subject;
  readonly kkCost: number;
  readonly bonuses: readonly Bonus[];
  readonly prerequisites?: readonly string[];
}

export class TechTree {
  private readonly nodes = new Map<string, TechNode>();
  private readonly researched = new Set<string>();

  constructor(nodes: readonly TechNode[]) {
    for (const node of nodes) {
      if (typeof node.id !== "string" || node.id.length === 0) {
        throw new TypeError("TechNode.id must be a non-empty string");
      }
      if (this.nodes.has(node.id)) {
        throw new TypeError(`Duplicate tech node id: ${node.id}`);
      }
      if (!Number.isInteger(node.kkCost) || node.kkCost < 0) {
        throw new TypeError(`TechNode.kkCost must be a non-negative integer (id=${node.id})`);
      }
      node.bonuses.forEach(validateBonus);
      this.nodes.set(node.id, node);
    }
    // Validate prerequisite references now that all nodes are known.
    for (const node of this.nodes.values()) {
      for (const pre of node.prerequisites ?? []) {
        if (!this.nodes.has(pre)) {
          throw new TypeError(`TechNode ${node.id} references unknown prerequisite ${pre}`);
        }
      }
    }
  }

  isResearched(id: string): boolean {
    return this.researched.has(id);
  }

  canResearch(id: string, kk: KKLedger): boolean {
    const node = this.nodes.get(id);
    if (node === undefined || this.researched.has(id)) return false;
    for (const pre of node.prerequisites ?? []) {
      if (!this.researched.has(pre)) return false;
    }
    return kk.canSpend(node.subject, node.kkCost);
  }

  /**
   * Research `id` and apply its bonuses to `unit`. Validates that the unit's
   * subject matches, prerequisites are met, and enough KK exists; spends the
   * KK and returns the node. Throws on any violation.
   */
  research(id: string, kk: KKLedger, unit: Unit): TechNode {
    const node = this.nodes.get(id);
    if (node === undefined) throw new RangeError(`Unknown tech node: ${id}`);
    if (this.researched.has(id)) throw new RangeError(`Already researched: ${id}`);
    if (unit.subject !== node.subject) {
      throw new TypeError(
        `Unit ${unit.id} (${unit.subject}) cannot take ${node.subject} node ${id}`,
      );
    }
    for (const pre of node.prerequisites ?? []) {
      if (!this.researched.has(pre)) {
        throw new RangeError(`Prerequisite not researched: ${pre} (for ${id})`);
      }
    }
    kk.spend(node.subject, node.kkCost); // throws if insufficient
    for (const bonus of node.bonuses) unit.addBonus(bonus);
    this.researched.add(id);
    return node;
  }
}
