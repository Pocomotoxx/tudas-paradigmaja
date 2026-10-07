import { describe, it, expect } from "vitest";
import { Subject, ALL_SUBJECTS } from "../economy/KKLedger.js";
import {
  LocationType,
  LOCATION_META,
  isKnowledgeLocation,
  locationSubject,
  knowledgeCentersFromLocations,
  type WorldLocation,
} from "./LocationType.js";

describe("Subject model — nine disciplines (I18)", () => {
  it("has exactly nine subjects including the split and additions", () => {
    expect(ALL_SUBJECTS).toHaveLength(9);
    expect(ALL_SUBJECTS).toContain(Subject.FIZIKA);
    expect(ALL_SUBJECTS).toContain(Subject.KEMIA);
    expect(ALL_SUBJECTS).toContain(Subject.MAGYAR);
    expect(ALL_SUBJECTS).toContain(Subject.INFORMATIKA);
    expect(ALL_SUBJECTS).toContain(Subject.IDEGEN_NYELV);
  });

  it("new location types map to the new subjects", () => {
    expect(locationSubject({ id: "lib", type: LocationType.LIBRARY, hex: { q: 0, r: 0 } })).toBe(Subject.MAGYAR);
    expect(locationSubject({ id: "dc", type: LocationType.DATA_CENTER, hex: { q: 1, r: 0 } })).toBe(Subject.INFORMATIKA);
    expect(locationSubject({ id: "emb", type: LocationType.EMBASSY, hex: { q: 0, r: 1 } })).toBe(Subject.IDEGEN_NYELV);
    expect(locationSubject({ id: "lab", type: LocationType.LABORATORY, hex: { q: 1, r: -1 } })).toBe(Subject.KEMIA);
  });
});

describe("LocationType — alternative-Europe typed locations (I15)", () => {
  it("every location type has metadata", () => {
    for (const t of Object.values(LocationType)) {
      expect(LOCATION_META[t]).toBeDefined();
      expect(typeof LOCATION_META[t].role).toBe("string");
    }
  });

  it("classifies knowledge vs non-knowledge locations", () => {
    expect(isKnowledgeLocation(LocationType.UNIVERSITY)).toBe(true);
    expect(isKnowledgeLocation(LocationType.OBSERVATORY)).toBe(true);
    expect(isKnowledgeLocation(LocationType.FORTRESS)).toBe(false);
    expect(isKnowledgeLocation(LocationType.CITY)).toBe(false);
  });

  it("resolves subject from explicit value or type default", () => {
    expect(locationSubject({ id: "a", type: LocationType.OBSERVATORY, hex: { q: 0, r: 0 } })).toBe(Subject.MATEMATIKA);
    expect(locationSubject({ id: "b", type: LocationType.HISTORICAL_SITE, hex: { q: 1, r: 0 } })).toBe(Subject.TORTENELEM);
    expect(locationSubject({ id: "c", type: LocationType.LABORATORY, hex: { q: 0, r: 1 } })).toBe(Subject.KEMIA);
    // explicit override wins
    expect(locationSubject({ id: "d", type: LocationType.UNIVERSITY, hex: { q: 2, r: 0 }, subject: Subject.BIOLOGIA })).toBe(Subject.BIOLOGIA);
    // non-knowledge -> null
    expect(locationSubject({ id: "e", type: LocationType.FORTRESS, hex: { q: 0, r: 2 } })).toBeNull();
  });

  it("derives knowledge-center placements, skipping non-knowledge locations", () => {
    const locations: WorldLocation[] = [
      { id: "obs", type: LocationType.OBSERVATORY, hex: { q: 0, r: 0 } },
      { id: "fort", type: LocationType.FORTRESS, hex: { q: 1, r: 0 } },
      { id: "hist", type: LocationType.HISTORICAL_SITE, hex: { q: 0, r: 1 }, requiresCapture: true, stability: 80 },
    ];
    const centers = knowledgeCentersFromLocations(locations);
    expect(centers.map((c) => c.id)).toEqual(["obs", "hist"]); // fortress skipped
    const hist = centers.find((c) => c.id === "hist")!;
    expect(hist.subject).toBe(Subject.TORTENELEM);
    expect(hist.requiresCapture).toBe(true);
    expect(hist.stability).toBe(80);
  });

  // Negative tests.
  it("throws for a knowledge type with no subject and no default", () => {
    expect(() => locationSubject({ id: "u", type: LocationType.UNIVERSITY, hex: { q: 0, r: 0 } })).toThrow(TypeError);
    expect(() => locationSubject({ id: "r", type: LocationType.RESEARCH_CENTER, hex: { q: 1, r: 0 } })).toThrow(TypeError);
  });

  it("throws on duplicate location ids", () => {
    const locs: WorldLocation[] = [
      { id: "dup", type: LocationType.OBSERVATORY, hex: { q: 0, r: 0 } },
      { id: "dup", type: LocationType.LABORATORY, hex: { q: 1, r: 0 } },
    ];
    expect(() => knowledgeCentersFromLocations(locs)).toThrow(TypeError);
  });
});
