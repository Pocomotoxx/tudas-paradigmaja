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
// Rule: EU members -> NUTS level 1 regions; non-EU European countries ->
// one region per country. Pass the NUTS-1 GeoJSON and, optionally, a countries
// GeoJSON (GISCO CNTR) to supply the non-EU single-country polygons.
//
// Inputs (EPSG:4326 lon/lat). Download locally (web egress is blocked in the
// cloud sandbox), e.g. from Eurostat GISCO:
//   NUTS_RG_20M_2021_4326_LEVL_1.geojson   (NUTS level 1)
//   CNTR_RG_20M_2021_4326.geojson          (countries, for non-EU)
//
// Usage:
//   node art/worldgen/nuts1-to-pack.mjs <nuts1.geojson> web/world/europe [countries.geojson]
//
// No third-party deps — pure Node.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SRC = process.argv[2];
const OUT = process.argv[3] || "web/world/europe";
const CNTR = process.argv[4]; // optional countries geojson for non-EU single regions
if (!SRC) { console.error("usage: node nuts1-to-pack.mjs <nuts1.geojson> [outDir] [countries.geojson]"); process.exit(1); }
mkdirSync(OUT, { recursive: true });

// EU-27 country codes (their NUTS 1 is used; excluded from the countries file).
const EU27 = new Set(["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","EL","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"]);
// Non-EU European countries to include as one region each (ISO2 / GISCO CNTR_ID).
// Most are already NUTS-1 regions in the NUTS file; the countries file mainly
// supplies the UK (dropped from NUTS after Brexit) plus the microstates.
// UA/BY/MD are left out so the eastern edge doesn't dominate the board.
const NON_EU = new Set(["NO","CH","IS","LI","UK","GB","RS","BA","ME","MK","AL","XK","AD","MC","SM","VA","TR"]);

const W = 1000, H = 760, MARGIN = 20;
const fc = JSON.parse(readFileSync(SRC, "utf8"));

// --- simple Europe-friendly projection: equirectangular with x compressed
// by cos(lat0). Good enough for a game board (not a survey map). ----------
const LAT0 = 52 * Math.PI / 180, COS0 = Math.cos(LAT0);
const proj = ([lon, lat]) => [lon * COS0, -lat];

// Mainland-Europe window (lon/lat). Overseas territories (French RUP, Canarias,
// Azores, Madeira, Svalbard...) fall outside and are dropped, so the board is
// continental Europe at a usable scale.
const WIN = { lonMin: -25, lonMax: 45, latMin: 34, latMax: 72 };
function centroidLonLat(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates]
             : geom.type === "MultiPolygon" ? geom.coordinates : [];
  if (!polys.length) return null;
  const ring = polys[0][0]; let lon = 0, lat = 0;
  for (const [x, y] of ring) { lon += x; lat += y; }
  return [lon / ring.length, lat / ring.length];
}
const inWindow = (c) => c && c[0] >= WIN.lonMin && c[0] <= WIN.lonMax && c[1] >= WIN.latMin && c[1] <= WIN.latMax;

// Fit box comes from the window corners, not data extremes, so partial outliers
// (e.g. Svalbard on NO) just clip at the viewBox edge instead of shrinking all.
const minX = WIN.lonMin * COS0, maxX = WIN.lonMax * COS0;
const minY = -WIN.latMax, maxY = -WIN.latMin;

function ringsOf(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates]
             : geom.type === "MultiPolygon" ? geom.coordinates : [];
  return polys.map(poly => poly.map(ring => ring.map(proj)));
}
const feats = [];
// EU: NUTS level 1 regions (3-char NUTS_ID, e.g. "DE1"), within the window.
for (const f of fc.features) {
  const id = f.properties.NUTS_ID || f.properties.id;
  const name = f.properties.NAME_LATN || f.properties.NUTS_NAME || f.properties.name || id;
  if (!id || !f.geometry) continue;
  if ((id.length || 0) !== 3) continue;
  if (!inWindow(centroidLonLat(f.geometry))) continue;
  feats.push({ id, name, country: id.slice(0, 2), level: "nuts1", polys: ringsOf(f.geometry) });
}
if (!feats.length) { console.error("no NUTS-1 features (need 3-char NUTS_ID)"); process.exit(1); }

// Non-EU: one region per country, from the countries GeoJSON if provided.
let nonEuCount = 0;
if (CNTR) {
  const cc = JSON.parse(readFileSync(CNTR, "utf8"));
  for (const f of cc.features) {
    const id = f.properties.CNTR_ID || f.properties.ISO2 || f.properties.id;
    const name = f.properties.NAME_ENGL || f.properties.CNTR_NAME || f.properties.name || id;
    if (!id || !f.geometry) continue;
    if (EU27.has(id) || !NON_EU.has(id)) continue; // skip EU (NUTS1 used) + non-European
    if (feats.some(x => x.country === id)) continue; // already present as a NUTS-1 region
    if (!inWindow(centroidLonLat(f.geometry))) continue;
    feats.push({ id, name, country: id, level: "country", polys: ringsOf(f.geometry) });
    nonEuCount++;
  }
}

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

// --- patchwork-quilt region colouring (graph colouring) ------------------
// Every region (NUTS 1 region OR non-EU country) gets its OWN colour from a
// varied mid-bright palette; adjacent regions never share a colour, so the map
// reads like a patchwork quilt rather than solid country blocks. Welsh–Powell
// greedy colouring over the border adjacency (deterministic: by degree desc,
// ties by index). The palette has far more colours than any region needs.
const QUILT = [
  "#d1605e","#e08a3c","#d9b64a","#b7c24a","#78b44e","#4faa6e","#3bb1a0","#4aa6c9",
  "#5a84c8","#7a6fc4","#a66bc0","#c766a8","#d4789a","#c98f6a","#8fae5c","#5fb59b",
  "#6f9bd0","#9f7ec2","#c583b0","#bfa24e","#7bbd86","#56a8bd","#8a93cf","#cf7f7f",
];
const adjList = feats.map((_, i) => adjOf(i));
const order = feats.map((_, i) => i).sort((a, b) => adjList[b].length - adjList[a].length || a - b);
const colorIdx = new Array(feats.length).fill(-1);
for (const i of order) {
  const used = new Set(adjList[i].map(j => colorIdx[j]).filter(c => c >= 0));
  // Rotate the start per region so the WHOLE palette gets used (not just the
  // first few indices): a greedy "smallest free" would bias the map warm.
  const start = (i * 7) % QUILT.length;
  let c = start;
  for (let k = 0; k < QUILT.length; k++) { const idx = (start + k) % QUILT.length; if (!used.has(idx)) { c = idx; break; } }
  colorIdx[i] = c;
}
const regionColor = colorIdx.map(c => QUILT[c]);

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
  // SVG is already a patchwork; the web layer may still recolour by faction.
  svgPaths += `<path id="prov_${i}" class="prov" data-faction="${f.country}" fill="${regionColor[i]}" d="${pathD(f.polys)}"/>\n`;
  return { id: i, nutsId: f.id, name: f.name, level: f.level, cx, cy, faction: f.country, country: f.country, color: regionColor[i], capital: false, adj: adjList[i] };
});

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- A Tudás Paradigmája — Europe NUTS 1 pack. Geometry: NUTS boundaries,
     © EuroGeographics (GISCO) / OSM (ODbL). NOT MIT — see map.json.meta. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" id="world">
<style>.prov{ stroke:#2b323b; stroke-width:0.5; stroke-linejoin:round; }</style>
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
    attribution: "Administrative boundaries: © EuroGeographics © OpenStreetMap contributors © Turkstat · Cartography: Eurostat — GISCO.",
    rule: "EU: NUTS level 1; non-EU European countries: one region each.",
  },
  viewBox: [0, 0, W, H], factions, provinces,
};
writeFileSync(`${OUT}/map.json`, JSON.stringify(data, null, 1));
console.log(`regions=${provinces.length} (EU NUTS-1 + ${nonEuCount} non-EU countries) countries=${countries.length} -> ${OUT}`);
