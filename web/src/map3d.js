// ── Three.js renderer, pack loader, animations, overlays ──────────────────
import * as THREE from 'three';
import { SVGLoader }     from 'three/examples/jsm/loaders/SVGLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  gs, cascadeEnabled, unrestOf, syncBotOwned,
} from './state.js';
import { showInfo, renderOwnedCard, renderDiffCard, renderBotsCard } from './ui.js';
import { renderUnrestCard } from './unrest.js';

// ── Renderer setup ────────────────────────────────────────────────────────

export const canvas   = document.getElementById('map3d');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x0d1117);

export const scene  = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
camera.up.set(0, 0, 1);

export const controls = new OrbitControls(camera, canvas);
controls.enableDamping  = true;
controls.dampingFactor  = 0.07;
controls.minDistance    = 8;
controls.maxDistance    = 280;
controls.maxPolarAngle  = Math.PI * 0.48;

// Lights
const ambLight  = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambLight);
const sunLight  = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(-35, -25, 90);
scene.add(sunLight);
const fillLight = new THREE.DirectionalLight(0x3355cc, 0.22);
fillLight.position.set(50, 40, 30);
scene.add(fillLight);

const seaMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600),
  new THREE.MeshStandardMaterial({ color: 0x0d1a2b, roughness: 1, metalness: 0 }),
);
seaMesh.position.z = -0.65;
scene.add(seaMesh);
scene.fog = new THREE.Fog(0x0d1117, 60, 170);

// Groups for dynamic overlays
export const unrestGroup  = new THREE.Group();
export const ownGroup     = new THREE.Group();
export const markerGroup  = new THREE.Group();
scene.add(unrestGroup, ownGroup, markerGroup);

// Province state
export const meshById    = new Map(); // id -> Mesh
export const provByMesh  = new Map(); // Mesh -> province
export const origColors  = new Map(); // id -> THREE.Color
export const outlineById = new Map(); // id -> Line

export let hoveredId  = null;
export let selectedId = null;

// SVG→world coordinate transform
let svgCx = 0, svgCy = 0, svgScale = 1;

const SLAB_H       = 0.3;
const TERRAIN_TINT = { plain: 0, hill: -0.06, mountain: -0.13 };

// ── Coordinate helpers ────────────────────────────────────────────────────

export function toWorld(svgX, svgY) {
  return new THREE.Vector2((svgX - svgCx) * svgScale, -(svgY - svgCy) * svgScale);
}

// ── Color helpers ─────────────────────────────────────────────────────────

function baseHex(p) { return p.color || gs.PALETTE[p.faction] || '#c3ccd4'; }

export function applyColor(id) {
  const m = meshById.get(id); if (!m) return;
  const orig = origColors.get(id); if (!orig) return;
  const c = orig.clone();
  if (id === selectedId)     c.lerp(new THREE.Color(0xffffff), 0.38);
  else if (id === hoveredId) c.lerp(new THREE.Color(0xffffff), 0.26);
  m.material.color.copy(c);
}

export function setHover(newId) {
  const old = hoveredId;
  if (old === newId) return;
  hoveredId = newId;
  if (old !== null) applyColor(old);
  if (newId !== null) {
    applyColor(newId);
    const p = gs.byId[newId];
    if (p) showInfo(p);
  }
}

export function setSelect(id) {
  const old = selectedId;
  selectedId = id;
  if (old !== null) applyColor(old);
  if (id  !== null) applyColor(id);
}

// ── Scene clear ───────────────────────────────────────────────────────────

export function clearProvinces() {
  for (const m of meshById.values())  { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  for (const l of outlineById.values()) { scene.remove(l); l.geometry.dispose(); }
  meshById.clear(); provByMesh.clear(); origColors.clear(); outlineById.clear();
  unrestGroup.clear(); ownGroup.clear(); markerGroup.clear();
  hoveredId = null; selectedId = null;
}

// ── Pack loader ───────────────────────────────────────────────────────────

export async function loadPack(dir, pack) {
  const msg = document.getElementById('loading-msg');
  if (msg) { msg.style.display = 'flex'; msg.textContent = 'betöltés…'; }

  let svgText, data;
  try {
    [svgText, data] = await Promise.all([
      fetch('world/' + dir + '/map.svg').then(r => { if (!r.ok) throw 0; return r.text(); }),
      fetch('world/' + dir + '/map.json').then(r => { if (!r.ok) throw 0; return r.json(); }),
    ]);
  } catch (_) {
    if (msg) msg.textContent = '';
    document.getElementById('info-body').innerHTML =
      `<span class="k">A '${pack?.name || dir}' csomag még nincs legenerálva.</span>`;
    document.getElementById('legend').innerHTML = '';
    return;
  }

  clearProvinces();
  gs.DATA = data; gs.byId = {}; gs.HEROES = {};
  gs.unrestWrong = {}; gs.unrestLevel = {};
  gs.owned = new Set();
  for (const k in gs.PALETTE) delete gs.PALETTE[k];
  data.factions.forEach(f => gs.PALETTE[f.id] = f.color);
  data.provinces.forEach(p => gs.byId[p.id] = p);

  const loader = new SVGLoader();
  const parsed = loader.parse(svgText);

  // Compute SVG bounds
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const sp of parsed.paths) {
    if (!sp.userData.node?.id?.startsWith('prov_')) continue;
    for (const sub of sp.subPaths)
      for (const pt of sub.getPoints(6)) {
        if (pt.x < x0) x0 = pt.x; if (pt.x > x1) x1 = pt.x;
        if (pt.y < y0) y0 = pt.y; if (pt.y > y1) y1 = pt.y;
      }
  }
  const W = x1 - x0 || 1, H = y1 - y0 || 1;
  svgScale = 88 / Math.max(W, H);
  svgCx = (x0 + x1) / 2; svgCy = (y0 + y1) / 2;

  const M = new THREE.Matrix4().set(
     svgScale, 0,         0, -svgCx * svgScale,
     0,       -svgScale,  0,  svgCy * svgScale,
     0,        0,         1,  0,
     0,        0,         0,  1,
  );

  const borderMat = new THREE.LineBasicMaterial({ color: 0x14191f, linewidth: 1 });

  for (const sp of parsed.paths) {
    const node = sp.userData.node;
    if (!node?.id?.startsWith('prov_')) continue;
    const id   = parseInt(node.id.slice(5));
    const prov = gs.byId[id]; if (!prov) continue;

    const shapes = SVGLoader.createShapes(sp);
    if (!shapes.length) continue;

    const geom = new THREE.ExtrudeGeometry(shapes, { depth: SLAB_H, bevelEnabled: false, curveSegments: 4 });
    geom.applyMatrix4(M);

    const color = new THREE.Color(baseHex(prov));
    const tint  = TERRAIN_TINT[prov.terrain ?? 'plain'] ?? 0;
    if (tint < 0) color.offsetHSL(0, 0, tint);
    origColors.set(id, color.clone());

    const mat  = new THREE.MeshStandardMaterial({ color: color.clone(), roughness: 0.78, metalness: 0 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData.provinceId = id;
    scene.add(mesh);
    meshById.set(id, mesh);
    provByMesh.set(mesh, prov);

    // Perimeter outline
    const pts = shapes[0].getPoints(5).map(p2 => {
      const w = toWorld(p2.x, p2.y);
      return new THREE.Vector3(w.x, w.y, SLAB_H + 0.06);
    });
    if (pts.length) pts.push(pts[0].clone());
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const line    = new THREE.Line(lineGeo, borderMat);
    scene.add(line);
    outlineById.set(id, line);
  }

  resetCamera();
  buildLegend();
  renderDiffCard();
  renderUnrestCard();
  renderOwnedCard();
  renderUnrestOverlay3D();
  renderOwnershipOverlay3D();
  if (gs.BOTS.length === 0) initBotsFn(1);
  renderBotsCard();
  addCapitals3D();

  const supports = data.meta?.supportsHeroes;
  const heroFlag = document.getElementById('hero-flag');
  if (heroFlag) heroFlag.textContent = supports ? '· hősök: IGEN (valós szülőhelyek)' : '· hősök: nincs (fantáziavilág)';
  document.getElementById('info-body').innerHTML =
    '<span class="k">Vigyél az egeret egy provincia fölé, vagy kattints rá.</span>' +
    (data.meta?.attribution ? '<br><br><span class="k">Forrás: ' + data.meta.attribution + '</span>' : '');

  if (msg) msg.style.display = 'none';

  if (supports) {
    fetch('world/' + dir + '/heroes.json')
      .then(r => r.ok ? r.json() : null)
      .then(h => {
        if (!h?.heroes) return;
        for (const hero of h.heroes) (gs.HEROES[hero.region] ||= []).push(hero);
        addHeroMarkers3D();
      }).catch(() => {});
  }
}

// Late-bound ref for initBots (avoid circular: map3d → bot)
let initBotsFn = () => {};
export function setInitBotsFn(fn) { initBotsFn = fn; }

export function resetCamera() {
  camera.position.set(0, -80, 28);
  camera.lookAt(0, 8, 3);
  controls.target.set(0, 8, 3);
  controls.update();
}

// ── Markers ───────────────────────────────────────────────────────────────

function makePin(headColor, headR, needleH) {
  const group     = new THREE.Group();
  const needleGeo = new THREE.CylinderGeometry(0.04, 0.12, needleH, 6);
  needleGeo.rotateX(Math.PI / 2);
  needleGeo.translate(0, 0, needleH / 2);
  const needleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4, metalness: 0.6 });
  group.add(new THREE.Mesh(needleGeo, needleMat));
  const headGeo = new THREE.SphereGeometry(headR, 8, 8);
  headGeo.translate(0, 0, needleH);
  const headMat = new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.3, metalness: 0.2 });
  group.add(new THREE.Mesh(headGeo, headMat));
  group.children.forEach(c => c.userData.isMarker = true);
  group.userData.isMarker = true;
  return group;
}

export function addCapitals3D() {
  if (!gs.DATA) return;
  for (const p of gs.DATA.provinces.filter(x => x.capital)) {
    const w   = toWorld(p.cx, p.cy);
    const pin = makePin(0xff2222, 0.55, 2.4);
    pin.position.set(w.x, w.y, SLAB_H);
    pin.userData.isMarker = true;
    markerGroup.add(pin);
  }
}

export function addHeroMarkers3D() {
  if (!gs.DATA) return;
  for (const p of gs.DATA.provinces) {
    const list = p.nutsId && gs.HEROES[p.nutsId];
    if (!list?.length) continue;
    const w = toWorld(p.cx, p.cy);
    const r = Math.min(0.5, 0.28 + list.length * 0.07);
    const pin = makePin(0xffd65a, r, 1.6);
    pin.position.set(w.x, w.y, SLAB_H);
    pin.userData.isMarker = true;
    markerGroup.add(pin);
  }
}

// ── Conquest animations ───────────────────────────────────────────────────

const anims = [];

export function triggerConquest(id, isPlayer) {
  const prov = gs.byId[id]; if (!prov || !gs.DATA) return;
  const col  = isPlayer ? 0xffd700 : 0xff5500;

  anims.push({ type:'flash', t0:performance.now(), dur:800, id, col });

  const w       = toWorld(prov.cx, prov.cy);
  const ringGeo = new THREE.RingGeometry(0.2, 0.7, 40);
  const ringMat = new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.85, side:THREE.DoubleSide, depthTest:false });
  const ring    = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(w.x, w.y, SLAB_H + 0.25);
  scene.add(ring);
  anims.push({ type:'ring', t0:performance.now(), dur:900, mesh:ring });

  const pin = makePin(col, 0.5, 2.2);
  pin.position.set(w.x, w.y, SLAB_H + 14);
  pin.userData.isConquestPin = true;
  scene.add(pin);
  anims.push({ type:'pin', t0:performance.now(), dur:1100, fadeDur:600, group:pin, baseZ:SLAB_H });
}

// ── 3D overlays ───────────────────────────────────────────────────────────

export function renderUnrestOverlay3D() {
  unrestGroup.clear();
  if (!gs.DATA?.subjects || !cascadeEnabled()) return;
  for (const s of gs.DATA.subjects) {
    if (unrestOf(s.id) <= 0) continue;
    for (const p of gs.DATA.provinces.filter(x => x.subject === s.id)) {
      const base = meshById.get(p.id); if (!base) continue;
      const over = new THREE.Mesh(
        base.geometry.clone(),
        new THREE.MeshBasicMaterial({ color:0xff3010, transparent:true, opacity:0.22, depthTest:true, side:THREE.FrontSide }),
      );
      over.position.z = 0.08;
      over.userData.unrestSubject = s.id;
      unrestGroup.add(over);
    }
  }
}

export function renderOwnershipOverlay3D() {
  ownGroup.clear();
  if (!gs.DATA) return;
  for (const id of gs.owned) {
    const line = outlineById.get(id); if (!line) continue;
    const geo  = line.geometry.clone();
    const pos  = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + 0.18);
    pos.needsUpdate = true;
    ownGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd700 })));
  }
}

export function renderBotOverlay() {
  if (!gs.DATA) return;
  scene.children.filter(c => c.userData.isBotOverlay).forEach(c => scene.remove(c));
  for (const bot of gs.BOTS) {
    for (const id of bot.owned) {
      const line = outlineById.get(id); if (!line) continue;
      const geo  = line.geometry.clone();
      const pos  = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + 0.14);
      pos.needsUpdate = true;
      const botLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: bot.persona.color }));
      botLine.userData.isBotOverlay = true;
      scene.add(botLine);
    }
  }
  for (const id of gs.botOwned) {
    if (gs.BOTS.some(b => b.owned.has(id))) continue;
    const line = outlineById.get(id); if (!line) continue;
    const geo  = line.geometry.clone();
    const pos  = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + 0.14);
    pos.needsUpdate = true;
    const botLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff6600 }));
    botLine.userData.isBotOverlay = true;
    scene.add(botLine);
  }
}

// ── Legend ────────────────────────────────────────────────────────────────

export function buildLegend() {
  const leg = document.getElementById('legend');
  const h3  = document.getElementById('legend-title');
  if (!leg || !gs.DATA) return;
  if (gs.DATA.subjects?.length) {
    if (h3) h3.textContent = 'Tantárgyak (szín = tananyag)';
    leg.innerHTML = gs.DATA.subjects.map(s => {
      const n = gs.DATA.provinces.filter(p => p.subject === s.id).length;
      return `<div data-k="${s.id}"><i style="background:${s.color}"></i>${s.name} <span class="k">(${n})</span></div>`;
    }).join('');
    wireLegend(leg, p => p.subject);
    return;
  }
  if (h3) h3.textContent = 'Frakciók';
  leg.innerHTML = gs.DATA.factions.map(f => {
    const n = gs.DATA.provinces.filter(p => p.faction === f.id).length;
    return `<div data-k="${f.id}"><i style="background:${f.color}"></i>${f.name} <span class="k">(${n})</span></div>`;
  }).join('');
  wireLegend(leg, p => p.faction);
}

function wireLegend(leg, key) {
  leg.querySelectorAll('div[data-k]').forEach(row => {
    row.addEventListener('mouseenter', () => {
      for (const p of gs.DATA.provinces.filter(x => key(x) === row.dataset.k)) {
        const m = meshById.get(p.id); if (!m) continue;
        m.material.color.copy(origColors.get(p.id).clone().lerp(new THREE.Color(0xffffff), 0.35));
      }
    });
    row.addEventListener('mouseleave', () => {
      for (const p of gs.DATA.provinces) {
        const id = p.id;
        if (id === hoveredId || id === selectedId) continue;
        applyColor(id);
      }
    });
  });
}

// ── Resize ────────────────────────────────────────────────────────────────

export function onResize() {
  const box = document.getElementById('mapbox');
  const w   = box.clientWidth, h = box.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(onResize).observe(document.getElementById('mapbox'));
onResize();

// ── Interaction ───────────────────────────────────────────────────────────

const mouse2    = new THREE.Vector2(-9999, -9999);
const raycaster = new THREE.Raycaster();

canvas.addEventListener('mousemove', e => {
  const r   = canvas.getBoundingClientRect();
  mouse2.x  = ((e.clientX - r.left) / r.width)  * 2 - 1;
  mouse2.y  = -((e.clientY - r.top)  / r.height) * 2 + 1;
});
canvas.addEventListener('mouseleave', () => { mouse2.set(-9999, -9999); setHover(null); });

let mouseDownPos = null;
canvas.addEventListener('mousedown', e => { mouseDownPos = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('mouseup', e => {
  if (!mouseDownPos) return;
  const dx = e.clientX - mouseDownPos.x, dy = e.clientY - mouseDownPos.y;
  mouseDownPos = null;
  if (Math.hypot(dx, dy) > 4) return;
  raycaster.setFromCamera(mouse2, camera);
  const hits = raycaster.intersectObjects([...meshById.values()]);
  if (hits.length) {
    const id = hits[0].object.userData.provinceId;
    setSelect(id);
    const p = gs.byId[id]; if (p) showInfo(p);
  }
});

// ── Animate loop ──────────────────────────────────────────────────────────

export function animate() {
  requestAnimationFrame(animate);
  const t = performance.now() * 0.001;

  // Unrest pulse
  for (const child of unrestGroup.children) {
    child.material.opacity = 0.14 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2.3));
  }

  // Hover from raycaster
  if (mouse2.x > -9000) {
    raycaster.setFromCamera(mouse2, camera);
    const hits = raycaster.intersectObjects([...meshById.values()]);
    setHover(hits.length ? hits[0].object.userData.provinceId : null);
  }

  // Conquest animations
  const now = performance.now();
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i];
    const p = Math.min(1, (now - a.t0) / a.dur);

    if (a.type === 'flash') {
      const mesh = meshById.get(a.id);
      if (mesh) {
        const orig = origColors.get(a.id);
        if (orig) {
          const env = p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75;
          mesh.material.color.copy(orig.clone().lerp(new THREE.Color(a.col), env * 0.9));
        }
      }
      if (p >= 1) { applyColor(a.id); anims.splice(i, 1); }
    } else if (a.type === 'ring') {
      const scale = 1 + p * 14;
      a.mesh.scale.set(scale, scale, 1);
      a.mesh.material.opacity = 0.75 * (1 - p);
      if (p >= 1) {
        scene.remove(a.mesh);
        a.mesh.geometry.dispose(); a.mesh.material.dispose();
        anims.splice(i, 1);
      }
    } else if (a.type === 'pin') {
      const totalDur = a.dur + a.fadeDur;
      const fullP    = Math.min(1, (now - a.t0) / totalDur);
      const fallP    = Math.min(1, p);
      const drop     = 1 - Math.pow(1 - Math.min(fallP / 0.65, 1), 3);
      const bounce   = fallP > 0.65
        ? Math.abs(Math.sin((fallP - 0.65) / 0.35 * Math.PI * 2)) * (1 - (fallP - 0.65) / 0.35) * 1.8
        : 0;
      a.group.position.z = a.baseZ + 14 * (1 - drop) + bounce;
      if (fullP > a.dur / totalDur) {
        const fadeP = (fullP - a.dur / totalDur) / (a.fadeDur / totalDur);
        const op    = 1 - fadeP;
        a.group.children.forEach(c => {
          if (c.material) { c.material.opacity = op; c.material.transparent = true; }
        });
      }
      if (fullP >= 1) { scene.remove(a.group); anims.splice(i, 1); }
    }
  }

  controls.update();
  renderer.render(scene, camera);
}
