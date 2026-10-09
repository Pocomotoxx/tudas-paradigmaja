// scientistsPack — content: 59 European scientists named after units of
// measurement / constants / concepts, as hero ScientistDefs.
//
// Content, not engine: real historical names and birthplaces are DATA. Each
// scientist's in-game birthplace is their discipline's city (so the controlled-
// birthplace gate and the nine-city system apply directly); the real birthplace
// is kept as `birthLabel` flavour only. Subjects are a primary-named-concept
// classification and are easy to override per entry. The affinity is a uniform
// starting balance (home bonus + light foreign malus) to tune later.
//
// Source list simplified by the project owner. Some birth dates in the source
// spreadsheet were corrupted (Excel serials) and are intentionally not encoded
// here — only names, discipline and birthplace matter in game.

import { Subject, BonusOp, type ScientistDef, type Bonus } from "@tudas-paradigmaja/core";

/** In-game city (birthplace location id) per discipline. */
const CITY: Partial<Record<Subject, string>> = {
  [Subject.FIZIKA]: "dynamis",
  [Subject.KEMIA]: "catalyss",
  [Subject.MATEMATIKA]: "numeris",
  [Subject.BIOLOGIA]: "viridia",
};

interface Row {
  readonly id: string;
  readonly name: string;
  readonly subject: Subject;
  /** Real birthplace, flavour only. */
  readonly birthLabel: string;
}

const F = Subject.FIZIKA, K = Subject.KEMIA, M = Subject.MATEMATIKA, B = Subject.BIOLOGIA;

// --- Europe (NUTS 1) birthplace binding -----------------------------------
// Real birthplace -> NUTS 1 region id (as in web/world/europe/map.json). Used
// only by the Europe map pack; the fantasy pack keeps discipline-city birth.
// Scientists born outside the European window (e.g. New Zealand, Tobolsk,
// Alexandria) have no region and are simply not recruitable on the Europe map.
const REGION: Record<string, string> = {
  // FIZIKA
  newton: "UK", pascal: "FRK", watt: "UK", volta: "ITC", ampere: "FRK",
  ohm: "DE2", faraday: "UK", joule: "UK", hertz: "DE6", kelvin: "UK",
  tesla: "HR0", coulomb: "FRI", rontgen: "DEA", becquerel: "FR1", sievert: "SE1",
  gray: "UK", siemens: "DE9", weber: "DEE", celsius: "SE1", fahrenheit: "PL6",
  reaumur: "FRI", torricelli: "ITH", mach: "CZ0", stokes: "IE0", poiseuille: "FR1",
  avogadro: "ITC", boltzmann: "AT1", planck: "DEF", einstein: "DE1", fermi: "ITI",
  meitner: "AT1", szilard: "HU1", gauss: "DE9", eotvos: "HU1",
  // KEMIA
  curie: "PL9", nobel: "SE1", copernicus: "PL6", bohr: "DK0",
  // (mengyelejev, oganessian, rutherford: born outside Europe window)
  // MATEMATIKA
  bolyai: "HU1", neumann: "HU1", wigner: "HU1", euler: "CH0", leibniz: "DED",
  pythagoras: "EL4", arkhimedesz: "ITG", poisson: "FRB", laplace: "FRD",
  fourier: "FRC", cauchy: "FR1", riemann: "DE9", galois: "FR1", mandelbrot: "PL9",
  // (euklidesz, eratoszthenesz: Egypt/Libya; hilbert: Königsberg, now Russia)
  // BIOLOGIA
  szentgyorgyi: "HU1",
};

// Hungarian-heritage scientists stay recruitable in Hungary (HU1 — Budapest /
// Közép-Magyarország) even when their birthplace now lies in another country
// (e.g. Bolyai: Kolozsvár/Cluj, today Romania). This overrides REGION.
const HUNGARIAN = new Set(["szilard", "eotvos", "bolyai", "neumann", "wigner", "szentgyorgyi"]);
const HU_REGION = "HU1";

const ROSTER: readonly Row[] = [
  { id: "newton", name: "Sir Isaac Newton", subject: F, birthLabel: "Woolsthorpe (Angol)" },
  { id: "pascal", name: "Blaise Pascal", subject: F, birthLabel: "Clermont-Ferrand (Francia)" },
  { id: "watt", name: "James Watt", subject: F, birthLabel: "Greenock (Skót)" },
  { id: "volta", name: "Alessandro Volta", subject: F, birthLabel: "Como (Olasz)" },
  { id: "ampere", name: "André-Marie Ampère", subject: F, birthLabel: "Lyon (Francia)" },
  { id: "ohm", name: "Georg Simon Ohm", subject: F, birthLabel: "Erlangen (Német)" },
  { id: "faraday", name: "Michael Faraday", subject: F, birthLabel: "London (Angol)" },
  { id: "joule", name: "James Prescott Joule", subject: F, birthLabel: "Salford (Angol)" },
  { id: "hertz", name: "Heinrich Hertz", subject: F, birthLabel: "Hamburg (Német)" },
  { id: "kelvin", name: "Lord Kelvin (William Thomson)", subject: F, birthLabel: "Belfast (Ír/Brit)" },
  { id: "tesla", name: "Nikola Tesla", subject: F, birthLabel: "Smiljan (Szerb)" },
  { id: "coulomb", name: "Charles-Augustin de Coulomb", subject: F, birthLabel: "Angoulême (Francia)" },
  { id: "rontgen", name: "Wilhelm Röntgen", subject: F, birthLabel: "Lennep (Német)" },
  { id: "becquerel", name: "Henri Becquerel", subject: F, birthLabel: "Párizs (Francia)" },
  { id: "sievert", name: "Rolf Maximilian Sievert", subject: F, birthLabel: "Stockholm (Svéd)" },
  { id: "gray", name: "Louis Harold Gray", subject: F, birthLabel: "London (Brit)" },
  { id: "siemens", name: "Werner von Siemens", subject: F, birthLabel: "Lenthe (Német)" },
  { id: "weber", name: "Wilhelm Eduard Weber", subject: F, birthLabel: "Wittenberg (Német)" },
  { id: "celsius", name: "Anders Celsius", subject: F, birthLabel: "Uppsala (Svéd)" },
  { id: "fahrenheit", name: "Daniel Gabriel Fahrenheit", subject: F, birthLabel: "Gdańsk (Német/Lengyel)" },
  { id: "reaumur", name: "René Antoine Ferchault de Réaumur", subject: F, birthLabel: "La Rochelle (Francia)" },
  { id: "torricelli", name: "Evangelista Torricelli", subject: F, birthLabel: "Faenza (Olasz)" },
  { id: "mach", name: "Ernst Mach", subject: F, birthLabel: "Chrlice (Osztrák/Cseh)" },
  { id: "stokes", name: "George Gabriel Stokes", subject: F, birthLabel: "Skreen (Ír/Brit)" },
  { id: "poiseuille", name: "Jean Léonard Marie Poiseuille", subject: F, birthLabel: "Párizs (Francia)" },
  { id: "avogadro", name: "Amedeo Avogadro", subject: F, birthLabel: "Torino (Olasz)" },
  { id: "boltzmann", name: "Ludwig Boltzmann", subject: F, birthLabel: "Bécs (Osztrák)" },
  { id: "planck", name: "Max Planck", subject: F, birthLabel: "Kiel (Német)" },
  { id: "einstein", name: "Albert Einstein", subject: F, birthLabel: "Ulm (Német)" },
  { id: "fermi", name: "Enrico Fermi", subject: F, birthLabel: "Róma (Olasz)" },
  { id: "meitner", name: "Lise Meitner", subject: F, birthLabel: "Bécs (Osztrák/Svéd)" },
  { id: "szilard", name: "Szilárd Leó", subject: F, birthLabel: "Budapest (Magyar)" },
  { id: "gauss", name: "Carl Friedrich Gauss", subject: F, birthLabel: "Braunschweig (Német)" },
  { id: "eotvos", name: "Eötvös Loránd", subject: F, birthLabel: "Buda (Magyar)" },

  { id: "curie", name: "Marie Curie", subject: K, birthLabel: "Varsó (Lengyel/Francia)" },
  { id: "mengyelejev", name: "Dmitrij Mengyelejev", subject: K, birthLabel: "Tobolszk (Orosz)" },
  { id: "nobel", name: "Alfred Nobel", subject: K, birthLabel: "Stockholm (Svéd)" },
  { id: "copernicus", name: "Nicolaus Copernicus", subject: K, birthLabel: "Toruń (Lengyel)" },
  { id: "oganessian", name: "Yuri Oganessian", subject: K, birthLabel: "Rostov-on-Don (Orosz/Örmény)" },
  { id: "rutherford", name: "Ernest Rutherford", subject: K, birthLabel: "Brightwater (Brit/Új-Zélandi)" },
  { id: "bohr", name: "Niels Bohr", subject: K, birthLabel: "Koppenhága (Dán)" },

  { id: "bolyai", name: "Bolyai János", subject: M, birthLabel: "Kolozsvár (Magyar)" },
  { id: "neumann", name: "Neumann János", subject: M, birthLabel: "Budapest (Magyar)" },
  { id: "wigner", name: "Wigner Jenő", subject: M, birthLabel: "Budapest (Magyar)" },
  { id: "euler", name: "Leonhard Euler", subject: M, birthLabel: "Bázel (Svájci)" },
  { id: "leibniz", name: "Gottfried Wilhelm Leibniz", subject: M, birthLabel: "Lipcse (Német)" },
  { id: "pythagoras", name: "Püthagorasz", subject: M, birthLabel: "Szamosz (Görög)" },
  { id: "euklidesz", name: "Eukleidész", subject: M, birthLabel: "Alexandria (Görög)" },
  { id: "arkhimedesz", name: "Arkhimédesz", subject: M, birthLabel: "Szürakuszai (Görög)" },
  { id: "eratoszthenesz", name: "Eratoszthenész", subject: M, birthLabel: "Küréné (Görög)" },
  { id: "poisson", name: "Siméon Denis Poisson", subject: M, birthLabel: "Pithiviers (Francia)" },
  { id: "laplace", name: "Pierre-Simon Laplace", subject: M, birthLabel: "Beaumont-en-Auge (Francia)" },
  { id: "fourier", name: "Jean-Baptiste Joseph Fourier", subject: M, birthLabel: "Auxerre (Francia)" },
  { id: "cauchy", name: "Augustin-Louis Cauchy", subject: M, birthLabel: "Párizs (Francia)" },
  { id: "riemann", name: "Bernhard Riemann", subject: M, birthLabel: "Breselenz (Német)" },
  { id: "hilbert", name: "David Hilbert", subject: M, birthLabel: "Wehlau (Német)" },
  { id: "galois", name: "Évariste Galois", subject: M, birthLabel: "Bourg-la-Reine (Francia)" },
  { id: "mandelbrot", name: "Benoît Mandelbrot", subject: M, birthLabel: "Varsó (Lengyel/Francia)" },

  { id: "szentgyorgyi", name: "Szent-Györgyi Albert", subject: B, birthLabel: "Budapest (Magyar)" },
];

function affinities(id: string, subject: Subject): ScientistDef["affinities"] {
  const home: Bonus[] = [
    { id: `${id}-atk`, stat: "attack", op: BonusOp.ADD, value: 2, source: id },
    { id: `${id}-ini`, stat: "initiative", op: BonusOp.ADD, value: 1, source: id },
  ];
  const foreign: Bonus[] = [
    { id: `${id}-slow`, stat: "speed", op: BonusOp.ADD, value: -1, source: id },
  ];
  return [
    { subject, bonuses: home },
    { subject: "*", bonuses: foreign },
  ];
}

/** All 59 scientists as ScientistDefs, birthplace = their discipline's city. */
export function scientistsPack(): ScientistDef[] {
  return ROSTER.map((r) => {
    const city = CITY[r.subject];
    if (city === undefined) throw new Error(`No city mapped for subject ${r.subject}`);
    return {
      id: r.id,
      name: r.name,
      subject: r.subject,
      birthplaceLocationId: city,
      cost: { subject: r.subject, kk: 3 },
      affinities: affinities(r.id, r.subject),
    };
  });
}

/** The real-birthplace flavour labels, keyed by scientist id (content only). */
export function scientistBirthLabels(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of ROSTER) out[r.id] = r.birthLabel;
  return out;
}

/**
 * Europe (NUTS 1) recruitment regions, keyed by scientist id. Hungarian-
 * heritage scientists are pinned to Hungary (HU1) regardless of their real
 * birthplace; others map to the NUTS 1 region of their birthplace. Scientists
 * born outside the European window are omitted.
 */
export function scientistHeroRegions(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of ROSTER) {
    const region = HUNGARIAN.has(r.id) ? HU_REGION : REGION[r.id];
    if (region) out[r.id] = region;
  }
  return out;
}

/** Full Europe hero roster for the presentation layer (content view). */
export function scientistHeroRoster(): Array<{
  id: string; name: string; subject: Subject; region: string; birthLabel: string;
}> {
  const regions = scientistHeroRegions();
  const out: Array<{ id: string; name: string; subject: Subject; region: string; birthLabel: string }> = [];
  for (const r of ROSTER) {
    const region = regions[r.id];
    if (region === undefined) continue;
    out.push({ id: r.id, name: r.name, subject: r.subject, region, birthLabel: r.birthLabel });
  }
  return out;
}
