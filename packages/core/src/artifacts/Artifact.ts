// Artifact — strategic items that grant army-wide bonuses while held (vision §13).
//
// An artifact is not necessarily free loot: it may require winning the
// three-question timed capture gate to take. While held it confers armyBonuses
// on the whole army (through the generic BonusSystem — the same mechanism as
// synergies and leaders). Content-defined; the engine is name-agnostic.

import type { Subject } from "../economy/KKLedger.js";
import { validateBonus, type Bonus } from "../units/BonusSystem.js";

export interface ArtifactCaptureSpec {
  readonly subject: Subject;
  readonly windowMs: number;
  readonly requiredCorrect?: number;
}

export interface ArtifactDef {
  readonly id: string;
  readonly name: string;
  /** Army-wide bonuses granted while the artifact is held. */
  readonly armyBonuses: readonly Bonus[];
  /** If present, the artifact must be won via the capture gate; else acquired directly. */
  readonly capture?: ArtifactCaptureSpec;
}

export function validateArtifact(def: ArtifactDef): ArtifactDef {
  if (typeof def.id !== "string" || def.id.length === 0) {
    throw new TypeError("ArtifactDef.id must be a non-empty string");
  }
  if (typeof def.name !== "string" || def.name.length === 0) {
    throw new TypeError(`Artifact ${def.id} must have a non-empty name`);
  }
  def.armyBonuses.forEach(validateBonus);
  if (def.capture !== undefined) {
    if (!Number.isInteger(def.capture.windowMs) || def.capture.windowMs < 1) {
      throw new TypeError(`Artifact ${def.id} capture.windowMs must be a positive integer`);
    }
  }
  return def;
}
