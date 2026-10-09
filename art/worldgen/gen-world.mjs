// gen-world.mjs — generate a FICTIONAL continent of Voronoi provinces.
// Output: our own asset (MIT). Geometry -> map.svg, game data -> map.json.
// Deterministic (seeded). Battles stay on the hex layer; this is the
// strategic region graph. No dark fills (they merge); grey, not black.
import { Delaunay } from "d3-delaunay";
import { writeFileSync, mkdirSync } from "node:fs";

const W = 900, H = 500;
const OUT = process.argv[2] || ".";
mkdirSync(OUT, { recursive: true });

// --- seeded RNG (mulberry32) ---------------------------------------------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const SEED = 0x7a7d05; const rnd = mulberry32(SEED);

// --- fictional landmass mask (star-ish blob, elliptical base) -------------
const s1=rnd()*6.28, s2=rnd()*6.28, s3=rnd()*6.28, s4=rnd()*6.28;
function blobR(theta){
  return 0.80 + 0.17*Math.sin(3*theta+s1) + 0.11*Math.sin(5*theta+s2)
       + 0.07*Math.sin(7*theta+s3) + 0.05*Math.sin(2*theta+s4);
}
function isLand(x,y){
  const nx=(x-450)/400, ny=(y-250)/225;
  const r=Math.hypot(nx,ny); const th=Math.atan2(ny,nx);
  return r < blobR(th);
}

// --- scatter jittered-grid points; keep land + a sea ring to bound coast --
const STEP = 40;                       // grid spacing -> province size
const pts = [];                        // all points (land + sea)
const land = [];                       // indices into pts that are land
for(let y=STEP/2; y<H; y+=STEP){
  for(let x=STEP/2; x<W; x+=STEP){
    const jx = x + (rnd()-0.5)*STEP*0.8;
    const jy = y + (rnd()-0.5)*STEP*0.8;
    if(jx<4||jx>W-4||jy<4||jy>H-4) continue;
    const idx = pts.length;
    const lnd = isLand(jx,jy);
    pts.push([jx,jy,lnd]);
    if(lnd) land.push(idx);
  }
}

// --- Lloyd relaxation (even province sizes) -------------------------------
function voronoiOf(points){
  const d = Delaunay.from(points.map(p=>[p[0],p[1]]));
  return { d, v: d.voronoi([0,0,W,H]) };
}
for(let it=0; it<3; it++){
  const { v } = voronoiOf(pts);
  for(let i=0;i<pts.length;i++){
    const cell = v.cellPolygon(i); if(!cell) continue;
    let ax=0, ay=0, n=0;
    for(const [cx,cy] of cell){ ax+=cx; ay+=cy; n++; }
    // move toward centroid but keep points inside domain
    pts[i][0] = Math.max(4,Math.min(W-4, ax/n));
    pts[i][1] = Math.max(4,Math.min(H-4, ay/n));
  }
}
const { d, v } = voronoiOf(pts);

// --- 9 discipline factions + capitals (spread land points) ----------------
// Nine evenly-spaced, mid-brightness hues — all clearly distinct, none dark.
const FACTIONS = [
  { id:"academia",    name:"Academia",    subject:"Magyar",       color:"#d15a52" }, // red
  { id:"terranova",   name:"Terranova",   subject:"Földrajz",     color:"#d68f3e" }, // orange
  { id:"dynamis",     name:"Dynamis",     subject:"Fizika",       color:"#bcb43f" }, // olive-gold
  { id:"viridia",     name:"Viridia",     subject:"Biológia",     color:"#5fae5a" }, // green
  { id:"nexum",       name:"Nexum",       subject:"Informatika",  color:"#3bb08c" }, // teal
  { id:"numeris",     name:"Numeris",     subject:"Matematika",   color:"#3ca8c4" }, // cyan
  { id:"chronopolis", name:"Chronopolis", subject:"Történelem",   color:"#5a74c8" }, // blue
  { id:"catalyss",    name:"Catalyss",    subject:"Kémia",        color:"#9a66c4" }, // violet
  { id:"lingua",      name:"Lingua",      subject:"Idegen nyelv", color:"#c662a4" }, // magenta
];
// Choose capitals: farthest-point sampling over land for good spread.
const capIdx = [];
capIdx.push(land[Math.floor(rnd()*land.length)]);
while(capIdx.length < FACTIONS.length){
  let best=-1, bestD=-1;
  for(const li of land){
    let dmin=1e9;
    for(const ci of capIdx){ const dx=pts[li][0]-pts[ci][0], dy=pts[li][1]-pts[ci][1]; dmin=Math.min(dmin,dx*dx+dy*dy); }
    if(dmin>bestD){ bestD=dmin; best=li; }
  }
  capIdx.push(best);
}
// Assign each land province to nearest capital's faction.
function factionOf(li){
  let best=0, bestD=1e18;
  for(let f=0;f<capIdx.length;f++){
    const dx=pts[li][0]-pts[capIdx[f]][0], dy=pts[li][1]-pts[capIdx[f]][1];
    const dd=dx*dx+dy*dy; if(dd<bestD){bestD=dd;best=f;}
  }
  return best;
}

// --- fictional province names --------------------------------------------
const PRE=["Ael","Bor","Cael","Dun","Esh","Fenn","Gol","Hald","Iri","Jor","Kel","Lor","Mor","Nar","Ole","Pyr","Quel","Rha","Sel","Tor","Ulv","Ver","Wyn","Xan","Yra","Zel"];
const SUF=["mark","heim","gard","vald","ren","dor","mere","fell","stad","wick","thal"," by","holt","ness","fen","grad","burg","lund"];
function nameFor(i){ return PRE[(i*7+SEED)%PRE.length] + SUF[(i*13+(SEED>>3))%SUF.length]; }

// --- build province records + adjacency (land-only neighbours) ------------
const landSet = new Set(land);
const idxToProv = new Map();
land.forEach((li,pi)=>idxToProv.set(li,pi));
const provinces = [];
let svgPaths = "";
land.forEach((li,pi)=>{
  const poly = v.cellPolygon(li); if(!poly) return;
  const f = factionOf(li);
  const isCap = capIdx[f]===li;
  // neighbours: delaunay neighbours that are land
  const adj=[];
  for(const nb of d.neighbors(li)) if(landSet.has(nb)) adj.push(idxToProv.get(nb));
  const dpath = "M"+poly.map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join("L")+"Z";
  provinces.push({ id:pi, name:nameFor(pi), cx:+pts[li][0].toFixed(1), cy:+pts[li][1].toFixed(1), faction:FACTIONS[f].id, capital:isCap, adj });
  svgPaths += `<path id="prov_${pi}" class="prov" data-faction="${FACTIONS[f].id}"${isCap?' data-capital="1"':''} d="${dpath}"/>\n`;
});

// --- write SVG (neutral geometry; colouring is done from JSON in the web) -
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- A Tudás Paradigmája — fictional continent (own asset, MIT). Seeded Voronoi. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" id="world">
<style>
  .prov{ fill:#c3ccd4; stroke:#4a525c; stroke-width:0.5; stroke-linejoin:round; }
</style>
<rect id="sea" x="0" y="0" width="${W}" height="${H}" fill="#223039"/>
<g id="provinces">
${svgPaths}</g>
</svg>
`;
writeFileSync(`${OUT}/map.svg`, svg);

const data = {
  meta: {
    id: "fantasy",
    name: "Fantáziavilág (kitalált kontinens)",
    kind: "fantasy",
    supportsHeroes: false, // no real birthplaces -> no scientist/explorer heroes
    license: "MIT",
    attribution: "Saját, generált tartalom (seedelt Voronoi).",
  },
  viewBox: [0, 0, W, H], seed: SEED, factions: FACTIONS, provinces,
};
writeFileSync(`${OUT}/map.json`, JSON.stringify(data,null,1));
console.log(`provinces=${provinces.length} factions=${FACTIONS.length} capitals=${capIdx.length}`);
