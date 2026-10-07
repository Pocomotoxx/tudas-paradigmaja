import { describe, it, expect } from "vitest";
import { Subject, validateScientist } from "@tudas-paradigmaja/core";
import { scientistsPack, scientistBirthLabels } from "./scientistsPack.js";

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
});
