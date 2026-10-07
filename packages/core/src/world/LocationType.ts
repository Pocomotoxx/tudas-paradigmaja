// LocationType — typed map locations for the alternative-Europe world map.
//
// The world map is an alternative Europe: recognisable in feel but fictional,
// never the real political map. This module is deliberately NAME-AGNOSTIC — it
// defines what KINDS of location exist and what each kind DOES mechanically;
// the fictional names, positions and labels come from content (a ScenarioDef),
// not from here.
//
// Each location type carries a mechanical function. Knowledge-bearing types map
// to a discipline (Subject) and can be turned into KnowledgeCenter placements;
// military/economic types serve other roles (units, logistics) handled
// elsewhere.

import { Subject } from "../economy/KKLedger.js";
import type { HexCoord } from "../hex/Hex.js";
import type { KnowledgeCenterPlacement } from "../game/Scenario.js";

export enum LocationType {
  CITY = "CITY",
  FORTRESS = "FORTRESS",
  UNIVERSITY = "UNIVERSITY",
  LABORATORY = "LABORATORY",
  OBSERVATORY = "OBSERVATORY",
  HISTORICAL_SITE = "HISTORICAL_SITE",
  INDUSTRIAL = "INDUSTRIAL",
  PORT = "PORT",
  RESEARCH_CENTER = "RESEARCH_CENTER",
}

export interface LocationTypeMeta {
  /** True when occupying this location yields a knowledge center. */
  readonly isKnowledgeCenter: boolean;
  /** Default discipline, when the type implies one. undefined => must be specified per location. */
  readonly defaultSubject?: Subject;
  /** True when the location primarily supplies military units. */
  readonly grantsUnits: boolean;
  /** Short role description (English, for docs/debug; display labels come from content). */
  readonly role: string;
}

export const LOCATION_META: Readonly<Record<LocationType, LocationTypeMeta>> = {
  [LocationType.CITY]: { isKnowledgeCenter: false, grantsUnits: true, role: "population and mixed production" },
  [LocationType.FORTRESS]: { isKnowledgeCenter: false, grantsUnits: true, role: "military units and defense" },
  [LocationType.UNIVERSITY]: { isKnowledgeCenter: true, grantsUnits: false, role: "broad discipline development (subject must be specified)" },
  [LocationType.LABORATORY]: { isKnowledgeCenter: true, defaultSubject: Subject.FIZIKA_KEMIA, grantsUnits: false, role: "chemistry/physics units and tech" },
  [LocationType.OBSERVATORY]: { isKnowledgeCenter: true, defaultSubject: Subject.MATEMATIKA, grantsUnits: false, role: "mathematics/physics tech" },
  [LocationType.HISTORICAL_SITE]: { isKnowledgeCenter: true, defaultSubject: Subject.TORTENELEM, grantsUnits: false, role: "strategic/geopolitical abilities" },
  [LocationType.INDUSTRIAL]: { isKnowledgeCenter: false, grantsUnits: false, role: "logistics/supply (hard mode)" },
  [LocationType.PORT]: { isKnowledgeCenter: false, grantsUnits: false, role: "movement/trade hub" },
  [LocationType.RESEARCH_CENTER]: { isKnowledgeCenter: true, grantsUnits: false, role: "specialised research (subject must be specified)" },
};

export interface WorldLocation {
  readonly id: string;
  readonly type: LocationType;
  readonly hex: HexCoord;
  /** Overrides / supplies the discipline for knowledge-center types. */
  readonly subject?: Subject;
  /** Content display label (fictional); the engine does not interpret it. */
  readonly label?: string;
  /** For knowledge centers: whether it must be taken via the capture gate. */
  readonly requiresCapture?: boolean;
  readonly stability?: number;
  readonly captureWindowMs?: number;
  readonly captureRequiredCorrect?: number;
}

export function isKnowledgeLocation(type: LocationType): boolean {
  return LOCATION_META[type].isKnowledgeCenter;
}

/**
 * Resolve the discipline of a knowledge-bearing location: the explicit subject
 * if given, else the type default. Returns null for non-knowledge types.
 * Throws if a knowledge type has neither an explicit subject nor a default.
 */
export function locationSubject(loc: WorldLocation): Subject | null {
  const meta = LOCATION_META[loc.type];
  if (meta === undefined) throw new TypeError(`Unknown location type: ${String(loc.type)}`);
  if (!meta.isKnowledgeCenter) return null;
  const subject = loc.subject ?? meta.defaultSubject;
  if (subject === undefined) {
    throw new TypeError(
      `Location ${loc.id} (${loc.type}) is a knowledge center but has no subject and no default`,
    );
  }
  return subject;
}

/**
 * Derive KnowledgeCenter placements from the knowledge-bearing locations of a
 * world map. Non-knowledge locations are skipped. This bridges the thematic map
 * to the mechanical center/economy system.
 */
export function knowledgeCentersFromLocations(
  locations: readonly WorldLocation[],
): KnowledgeCenterPlacement[] {
  const out: KnowledgeCenterPlacement[] = [];
  const seen = new Set<string>();
  for (const loc of locations) {
    if (seen.has(loc.id)) throw new TypeError(`Duplicate location id: ${loc.id}`);
    seen.add(loc.id);
    const subject = locationSubject(loc);
    if (subject === null) continue;
    out.push({
      id: loc.id,
      subject,
      hex: loc.hex,
      ...(loc.stability !== undefined ? { stability: loc.stability } : {}),
      ...(loc.requiresCapture !== undefined ? { requiresCapture: loc.requiresCapture } : {}),
      ...(loc.captureWindowMs !== undefined ? { captureWindowMs: loc.captureWindowMs } : {}),
      ...(loc.captureRequiredCorrect !== undefined ? { captureRequiredCorrect: loc.captureRequiredCorrect } : {}),
    });
  }
  return out;
}
