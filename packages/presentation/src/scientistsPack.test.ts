import { describe, it, expect } from "vitest";
import { Subject, validateScientist } from "@tudas-paradigmaja/core";
import { scientistsPack, scientistBirthLabels, scientistHeroRegions, scientistHeroRoster } from "./scientistsPack.js";

describe("scientistsPack — 59 unit-named scientists as heroes (I24)", () => {
  it("contains 59 valid, uniquely-id'd scientists", () => {
    const pack = scientistsPack();
    expect(pack).toHaveLength(59);
    const ids = new Set(pack.map((s) => s.id));
    expect(ids.size).toBe(59);
    for (const s of pack) expect(() => validateScientist(s)).not.toThrow();
  });

  it("distributes scientists across the expected disciplines", () => {
    const pack = scientistsPack();
    const count = (subj: Subject) => pack.filter((s) => s.subject === subj).length;
    expect(count(Subject.FIZIKA)).toBe(34);
    expect(count(Subject.KEMIA)).toBe(7);
    expect(count(Subject.MATEMATIKA)).toBe(17);
    expect(count(Subject.BIOLOGIA)).toBe(1);
  });

  it("maps each scientist's birthplace to their discipline's city", () => {
    const pack = scientistsPack();
    const byId = new Map(pack.map((s) => [s.id, s]));
    expect(byId.get("newton")!.birthplaceLocationId).toBe("dynamis"); // physics
    expect(byId.get("curie")!.birthplaceLocationId).toBe("catalyss"); // chemistry
    expect(byId.get("euler")!.birthplaceLocationId).toBe("numeris"); // maths
    expect(byId.get("szentgyorgyi")!.birthplaceLocationId).toBe("viridia"); // biology
  });

  it("gives every scientist a home bonus and a foreign malus", () => {
    for (const s of scientistsPack()) {
      const home = s.affinities.find((a) => a.subject === s.subject);
      const foreign = s.affinities.find((a) => a.subject === "*");
      expect(home!.bonuses.length).toBeGreaterThan(0);
      expect(foreign!.bonuses.some((b) => b.value < 0)).toBe(true);
    }
  });

  it("keeps real birthplaces as flavour labels", () => {
    const labels = scientistBirthLabels();
    expect(labels["newton"]).toContain("Woolsthorpe");
    expect(Object.keys(labels)).toHaveLength(59);
  });

  it("binds birthplaces to NUTS 1 regions on the Europe map", () => {
    const r = scientistHeroRegions();
    expect(r["newton"]).toBe("UK");      // Woolsthorpe, England
    expect(r["einstein"]).toBe("DE1");   // Ulm, Baden-Württemberg
    expect(r["curie"]).toBe("PL9");      // Warsaw, Mazowieckie
    expect(r["euler"]).toBe("CH0");      // Basel
  });

  it("keeps Hungarian-heritage scientists recruitable in Hungary (HU1)", () => {
    const r = scientistHeroRegions();
    // Bolyai was born in Kolozsvár (Cluj, today Romania) but stays Hungarian.
    expect(r["bolyai"]).toBe("HU1");
    for (const id of ["szilard", "eotvos", "neumann", "wigner", "szentgyorgyi"]) {
      expect(r[id]).toBe("HU1");
    }
  });

  it("omits scientists born outside the European window", () => {
    const r = scientistHeroRegions();
    for (const id of ["rutherford", "mengyelejev", "oganessian", "euklidesz", "eratoszthenesz", "hilbert"]) {
      expect(r[id]).toBeUndefined();
    }
    // Roster view only lists Europe-recruitable scientists.
    const roster = scientistHeroRoster();
    expect(roster.every((h) => h.region.length >= 2)).toBe(true);
    expect(roster.length).toBe(Object.keys(r).length);
  });
});
