// add-terrain.mjs — stamp a SCHEMATIC terrain category onto an existing
// map.json's provinces: "plain" | "hill" | "mountain". This is not real
// elevation data (we have none for the invented continent, and pulling real
// SRTM/GEBCO data for Europe is a separate, larger task) — it's a cheap,
// deterministic placeholder so the 2.5D map can hint at relief. Seeded on
// each province's id, so re-running is a no-op (same output every time).
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("usage: node add-terrain.mjs <path-to-map.json>"); process.exit(1); }

// --- seeded RNG (mulberry32), seeded per-province from its id ------------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hashStr(s){ let h=0x811c9dc5; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193); } return h>>>0; }

const data = JSON.parse(readFileSync(file, "utf8"));
// Weighted pick: mostly plain, some hill, fewer mountain — loosely clustered
// by giving neighbours of a mountain province a higher hill chance, so relief
// doesn't look like random salt-and-pepper noise.
const byId = Object.fromEntries(data.provinces.map(p => [p.id, p]));
const mountainIds = new Set();
for (const p of data.provinces) {
  const r = mulberry32(hashStr(String(p.id) + (p.nutsId ?? p.name ?? "")))();
  if (r < 0.13) mountainIds.add(p.id);
}
for (const p of data.provinces) {
  if (mountainIds.has(p.id)) { p.terrain = "mountain"; continue; }
  const adjMountain = (p.adj ?? []).some(id => mountainIds.has(id));
  const r = mulberry32(hashStr(String(p.id) + "-hill-" + (p.nutsId ?? p.name ?? "")))();
  p.terrain = (adjMountain ? r < 0.55 : r < 0.22) ? "hill" : "plain";
}

writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
const counts = data.provinces.reduce((acc, p) => (acc[p.terrain] = (acc[p.terrain] ?? 0) + 1, acc), {});
console.log(file, counts);
