// nuts1-to-pack.mjs — convert a real NUTS 1 GeoJSON into a map-pack
// (map.svg + map.json) in the SAME schema as the fantasy pack, so the web
// demo can switch between them. Europe is REAL geography, so this pack
// enables scientist/explorer heroes (birthplaces resolve to NUTS 1 regions).
//
// The NUTS geometry is NOT our asset: Eurostat/GISCO NUTS boundaries are
// © EuroGeographics (free to use with attribution); if you build it from OSM
// instead, it is ODbL (attribution + share-alike on the database). The engine
// stays MIT; this pack carries its own licence/attribution in map.json.meta.
//
// Input: a NUTS level-1 GeoJSON FeatureCollection in EPSG:4326 (lon/lat),
// features with properties NUTS_ID + NAME_LATN (GISCO naming). Download it
// locally (web egress is blocked in the cloud sandbox), e.g.:
//   NUTS_RG_20M_2021_4326_LEVL_1.geojson  from Eurostat GISCO
//
// Usage:
//   node art/worldgen/nuts1-to-pack.mjs <nuts1.geojson> web/world/europe
//
// No third-party deps — pure Node.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SRC = process.argv[2];
const OUT = process.argv[3] || "web/world/europe";
if (!SRC) { console.error("usage: node nuts1-to-pack.mjs <nuts1.geojson> [outDir]"); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const W = 1000, H = 760, MARGIN = 20;
const fc = JSON.parse(readFileSync(SRC, "utf8"));

// --- simple Europe-friendly projection: equirectangular with x compressed
// by cos(lat0). Good enough for a game board (not a survey map). ----------
const LAT0 = 52 * Math.PI / 180, COS0 = Math.cos(LAT0);
const proj = ([lon, lat]) => [lon * COS0, -lat];

// Collect rings per feature (outer + holes), projected; track bbox for fit.
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
function ringsOf(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates]
             : geom.type === "MultiPolygon" ? geom.coordinates : [];
  return polys.map(poly => poly.map(ring => ring.map(pt => {
    const p = proj(pt);
    if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
    return p;
  })));
}
const feats = [];
for (const f of fc.features) {
  const id = f.properties.NUTS_ID || f.properties.id;
  const name = f.properties.NAME_LATN || f.properties.NUTS_NAME || f.properties.name || id;
  if (!id || !f.geometry) continue;
  if ((id.length || 0) !== 3) continue; // NUTS level 1 == 3 chars (e.g. "DE1")
  feats.push({ id, name, country: id.slice(0, 2), polys: ringsOf(f.geometry) });
}
if (!feats.length) { console.error("no NUTS-1 features (need 3-char NUTS_ID)"); process.exit(1); }

// Fit projected coords into the viewBox (preserve aspect).
const sx = (W - 2 * MARGIN) / (maxX - minX);
const sy = (H - 2 * MARGIN) / (maxY - minY);
const s = Math.min(sx, sy);
const offX = MARGIN + ((W - 2 * MARGIN) - (maxX - minX) * s) / 2;
const offY = MARGIN + ((H - 2 * MARGIN) - (maxY - minY) * s) / 2;
const tx = x => offX + (x - minX) * s;
const ty = y => offY + (y - minY) * s;

// --- adjacency by shared vertices (rounded to a grid) --------------------
const KEY = (x, y) => Math.round(x * 2) + "," + Math.round(y * 2); // ~0.5 unit grid
const vertOwners = new Map(); // vertexKey -> Set(featIndex)
feats.forEach((f, i) => {
  const seen = new Set();
  for (const poly of f.polys) for (const ring of poly) for (const [x, y] of ring) {
    const k = KEY(tx(x), ty(y));
    if (seen.has(k)) continue; seen.add(k);
    if (!vertOwners.has(k)) vertOwners.set(k, new Set());
    vertOwners.get(k).add(i);
  }
});
const shared = feats.map(() => new Map()); // i -> Map(j -> count)
for (const owners of vertOwners.values()) {
  const a = [...owners];
  for (let m = 0; m < a.length; m++) for (let n = m + 1; n < a.length; n++) {
    const i = a[m], j = a[n];
    shared[i].set(j, (shared[i].get(j) || 0) + 1);
    shared[j].set(i, (shared[j].get(i) || 0) + 1);
  }
}
const adjOf = i => [...shared[i].entries()].filter(([, c]) => c >= 2).map(([j]) => j); // >=2 shared verts = a border

// --- one distinct, non-dark colour per country ---------------------------
function hslToHex(h, sPct, lPct) {
  const sN = sPct / 100, lN = lPct / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = lN - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  const hx = v => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return "#" + hx(r) + hx(g) + hx(b);
}
const countries = [...new Set(feats.map(f => f.country))].sort();
const factionColor = {};
countries.forEach((cc, i) => { factionColor[cc] = hslToHex((i * 360 / countries.length) % 360, 52, 58); }); // all mid-bright, none dark
const factions = countries.map(cc => ({ id: cc, name: cc, color: factionColor[cc] }));

// --- build SVG paths + province records ----------------------------------
function pathD(polys) {
  let d = "";
  for (const poly of polys) for (const ring of poly) {
    d += "M" + ring.map(([x, y]) => tx(x).toFixed(1) + "," + ty(y).toFixed(1)).join("L") + "Z";
  }
  return d;
}
let svgPaths = "";
const provinces = feats.map((f, i) => {
  // representative point = centroid of first outer ring (projected px)
  const ring = f.polys[0][0]; let ax = 0, ay = 0;
  for (const [x, y] of ring) { ax += tx(x); ay += ty(y); }
  const cx = +(ax / ring.length).toFixed(1), cy = +(ay / ring.length).toFixed(1);
  svgPaths += `<path id="prov_${i}" class="prov" data-faction="${f.country}" d="${pathD(f.polys)}"/>\n`;
  return { id: i, nutsId: f.id, name: f.name, cx, cy, faction: f.country, country: f.country, capital: false, adj: adjOf(i) };
});

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- A Tudás Paradigmája — Europe NUTS 1 pack. Geometry: NUTS boundaries,
     © EuroGeographics (GISCO) / OSM (ODbL). NOT MIT — see map.json.meta. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" id="world">
<style>.prov{ fill:#c3ccd4; stroke:#4a525c; stroke-width:0.6; stroke-linejoin:round; }</style>
<rect id="sea" x="0" y="0" width="${W}" height="${H}" fill="#223039"/>
<g id="provinces">
${svgPaths}</g>
</svg>
`;
writeFileSync(`${OUT}/map.svg`, svg);

const data = {
  meta: {
    id: "europe", name: "Európa — NUTS 1 nagyrégiók (valós)", kind: "europe",
    supportsHeroes: true, // real birthplaces -> scientist/explorer heroes
    license: "NUTS boundaries © EuroGeographics (GISCO), free to use with attribution; if built from OSM, ODbL. Engine is MIT.",
    attribution: "© EuroGeographics / Eurostat GISCO (NUTS) · © OpenStreetMap contributors (ODbL).",
  },
  viewBox: [0, 0, W, H], factions, provinces,
};
writeFileSync(`${OUT}/map.json`, JSON.stringify(data, null, 1));
console.log(`NUTS-1 regions=${provinces.length} countries=${countries.length} -> ${OUT}`);
