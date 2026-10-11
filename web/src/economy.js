// ── i66: Buildings + income system ───────────────────────────────────────
import { gs, BUILDINGS, INCOME, BOT_INCOME } from './state.js';
import { heroGoldBonus, heroKKBonus, heroDefBonus } from './heroes.js';
import { sfx } from './sound.js';

export { BUILDINGS };

export function provBuildings(id) {
  return gs.buildings[id] || (gs.buildings[id] = new Set());
}

export function buildingGoldBonus() {
  let total = 0;
  for (const id of gs.owned)
    for (const k of provBuildings(id))
      total += BUILDINGS[k].goldBonus;
  return total;
}

export function buildingKKBonus() {
  let total = 0;
  for (const id of gs.owned)
    for (const k of provBuildings(id))
      total += BUILDINGS[k].kkBonus;
  return total;
}

export function provDefBonus(id) {
  let bonus = 0;
  for (const k of provBuildings(id)) bonus += BUILDINGS[k].defBonus;
  bonus += heroDefBonus(id);
  return bonus;
}

/** Compute player income for one turn, add to gs.gold / gs.kk, log event. */
export function playerIncome() {
  const prev   = { gold: gs.gold, kk: gs.kk };
  const gMult  = heroGoldBonus();
  const kMult  = heroKKBonus();
  const baseG  = gs.owned.size * INCOME.gold + INCOME.gold + buildingGoldBonus();
  const baseKK = gs.owned.size * INCOME.kk   + INCOME.kk   + buildingKKBonus();
  gs.gold += Math.round(baseG  * gMult);
  gs.kk   += Math.round(baseKK * kMult);
  const gBonus = gs.gold - prev.gold;
  const kBonus = gs.kk   - prev.kk;
  const heroMsg = (gMult > 1 || kMult > 1)
    ? ` <span style="color:#c9a84c;font-size:11px">(hős bónusz: ×${gMult.toFixed(2)} arany, ×${kMult.toFixed(2)} KK)</span>`
    : '';
  // addEvent is imported lazily to avoid circular dep
  addEventFn(`&#9733; Bevétel: +${gBonus} arany, +${kBonus} KK${heroMsg}`, 'ev-player');
}

// Late-bound reference — set by main.js after all modules are loaded
let addEventFn = () => {};
export function setAddEventFn(fn) { addEventFn = fn; }

/** Build a building at provId, deducting gold and logging. */
export function buildAt(provId, bldKey) {
  const bld = BUILDINGS[bldKey];
  if (!bld || !gs.owned.has(provId)) return;
  if (gs.gold < bld.cost) {
    addEventFn(`&#9888; Nincs elég arany az épülethez (kell: ${bld.cost})`, 'ev-info');
    return;
  }
  if (provBuildings(provId).has(bldKey)) return;
  gs.gold -= bld.cost;
  provBuildings(provId).add(bldKey);
  renderTurnBarFn();
  sfx('build');
  addEventFn(`${bld.icon} ${bld.name} felépítve: <b>${gs.byId[provId]?.name}</b> (-${bld.cost} arany)`, 'ev-player');
  const prov = gs.byId[provId];
  if (prov) showInfoFn(prov);
}

let renderTurnBarFn = () => {};
let showInfoFn      = () => {};
export function setEconomyCallbacks(renderTurnBar, showInfo) {
  renderTurnBarFn = renderTurnBar;
  showInfoFn      = showInfo;
}

/** Returns buildings HTML for a province's detail panel. */
export function buildingsHTML(provId) {
  if (!gs.owned.has(provId)) return '';
  const built = provBuildings(provId);
  const btns = Object.entries(BUILDINGS).map(([k, b]) => {
    const has       = built.has(k);
    const canAfford = gs.gold >= b.cost;
    const cls       = has ? 'owned' : (!canAfford ? 'cant-afford' : '');
    return `<button class="bld-btn ${cls}" data-bld="${k}" data-prov="${provId}"
      ${has ? 'disabled title="Már megépítve"' : !canAfford ? 'disabled title="Nincs elég arany"' : ''}>
      <div>${b.icon} ${b.name}</div>
      <div style="font-size:10px;color:var(--muted)">${has ? '&#10003; Kész' : b.desc + ' · ' + b.cost + ' &#9733;'}</div>
    </button>`;
  }).join('');
  return `<div style="margin-top:10px;font-size:12px;font-weight:600;color:var(--muted)">Épületek</div>
    <div class="bld-row">${btns}</div>`;
}
