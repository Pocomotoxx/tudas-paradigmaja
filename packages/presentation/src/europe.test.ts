import { describe, it, expect } from "vitest";
import { Game, Subject } from "@tudas-paradigmaja/core";
import { europeScenario, renderWorldMap } from "./europe.js";

describe("europe — sample alternative-Europe scenario (I16)", () => {
  it("builds knowledge centers from knowledge locations, excluding fortress/city", () => {
    const { scenario } = europeScenario();
    const ids = (scenario.knowledgeCenters ?? []).map((c) => c.id).sort();
    expect(ids).toEqual(["bioterra", "chronos", "kemia-lab", "mathis-obs"]);
    // fortress (vesta) and city (aurelia) are not centers
    expect(ids).not.toContain("vesta");
    expect(ids).not.toContain("aurelia");
  });

  it("assigns subjects by location type (and explicit override)", () => {
    const { scenario } = europeScenario();
    const by = new Map((scenario.knowledgeCenters ?? []).map((c) => [c.id, c.subject]));
    expect(by.get("mathis-obs")).toBe(Subject.MATEMATIKA); // observatory default
    expect(by.get("kemia-lab")).toBe(Subject.FIZIKA_KEMIA); // laboratory default
    expect(by.get("chronos")).toBe(Subject.TORTENELEM); // historical default
    expect(by.get("bioterra")).toBe(Subject.BIOLOGIA); // university explicit override
  });

  it("capture-required centers start uncaptured and produce nothing until taken", () => {
    const { scenario } = europeScenario();
    const game = new Game(scenario, 1);
    expect(game.isCenterCaptured("mathis-obs")).toBe(false);
    // kemia-lab does not require capture -> owned from start
    expect(game.isCenterCaptured("kemia-lab")).toBe(true);

    // Capture the observatory via the 3-question gate, then it is owned.
    game.beginCapture("mathis-obs", 0);
    game.submitCapture(true, 10);
    game.submitCapture(true, 20);
    game.submitCapture(true, 30);
    expect(game.isCenterCaptured("mathis-obs")).toBe(true);
  });

  it("renders the world map with location glyphs and the hero", () => {
    const { scenario, locations } = europeScenario();
    const game = new Game(scenario, 1);
    const map = renderWorldMap(locations, game);
    expect(map).toContain("@"); // hero at Aurelia (0,0)
    expect(map).toContain("O"); // observatory
    expect(map).toContain("F"); // fortress
    expect(map).toContain("H"); // historical site
  });

  it("is deterministic", () => {
    const a = new Game(europeScenario().scenario, 5);
    const b = new Game(europeScenario().scenario, 5);
    expect(a.save()).toEqual(b.save());
  });
});
