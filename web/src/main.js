// ── Bootstrap: import all modules, wire events, pack loader ───────────────
import { gs } from './state.js';

// Sound
import { sfx } from './sound.js';

// UI
import {
  addEvent, renderTurnBar, renderXPBar, renderDiffCard,
  renderBotsCard, setUICallbacks,
} from './ui.js';

// Economy
import { playerIncome, setAddEventFn, setEconomyCallbacks } from './economy.js';

// Unrest
import { renderUnrestCard, setUnrestRenderFn } from './unrest.js';

// Map3D
import {
  loadPack, resetCamera, animate,
  renderUnrestOverlay3D, renderOwnershipOverlay3D, renderBotOverlay,
  setInitBotsFn,
} from './map3d.js';

// Bot
import { initBots, setBotCallbacks } from './bot.js';

// Combat
import {
  toggleOwned, endTurn, resetGame, checkVictory, setCombatCallbacks,
} from './combat.js';

// Campaign
import { renderCampaignList, startCampaign } from './campaign.js';

// Wiki
import { initWiki, openWiki, wikiSearch, setWikiBtn } from './wiki.js';

// ── Wire late-bound callbacks to break circular deps ──────────────────────

// unrest.js needs renderUnrestOverlay3D from map3d.js
setUnrestRenderFn(renderUnrestOverlay3D);

// economy.js needs addEvent / renderTurnBar / showInfo from ui.js
import { showInfo } from './ui.js';
import { buildAt } from './economy.js';
setAddEventFn(addEvent);
setEconomyCallbacks(renderTurnBar, showInfo);

// ui.js needs toggleOwned + buildAt (from combat/economy)
setUICallbacks(toggleOwned, buildAt);

// bot.js needs checkVictory + renderTurnBar
setBotCallbacks(checkVictory, renderTurnBar);

// map3d.js needs initBots
setInitBotsFn(initBots);

// combat.js needs playerIncome + setWikiBtn
setCombatCallbacks(playerIncome, setWikiBtn);

// ── Load question bank ────────────────────────────────────────────────────

fetch('qbank.json').then(r => r.json()).then(d => { gs.QBANK = d; }).catch(() => {});

// ── Pack loader bootstrap ─────────────────────────────────────────────────

fetch('world/packs.json').then(r => r.json()).then(idx => {
  const sel = document.getElementById('pack-select');
  sel.innerHTML = idx.packs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  const byPack = Object.fromEntries(idx.packs.map(p => [p.id, p]));
  sel.value = idx.default || idx.packs[0].id;
  sel.addEventListener('change', () => { const p = byPack[sel.value]; loadPack(p.dir, p); });
  const first = byPack[sel.value];
  loadPack(first.dir, first);
}).catch(() => { loadPack('fantasy', { name: 'Fantáziavilág' }); });

// ── Turn / difficulty / camera controls ───────────────────────────────────

renderDiffCard();
renderUnrestCard();
renderTurnBar();
renderXPBar();

document.getElementById('btn-end-turn').addEventListener('click', endTurn);
document.getElementById('go-newgame').addEventListener('click',   resetGame);
document.getElementById('btn-campaign').addEventListener('click', () => {
  renderCampaignList();
  document.getElementById('camp-overlay').classList.remove('hidden');
});
document.getElementById('camp-close').addEventListener('click', () => {
  document.getElementById('camp-overlay').classList.add('hidden');
});
document.getElementById('diff-select').addEventListener('change', e => {
  gs.currentDifficulty = Number(e.target.value);
  renderDiffCard();
  renderUnrestCard();
  renderUnrestOverlay3D();
});
document.getElementById('btn-reset-cam').addEventListener('click', resetCamera);

// ── Wiki wiring ───────────────────────────────────────────────────────────

initWiki();
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('wiki-close').addEventListener('click', () => {
    document.getElementById('wiki-overlay').classList.add('hidden');
  });
  document.getElementById('wiki-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('wiki-overlay'))
      document.getElementById('wiki-overlay').classList.add('hidden');
  });
  document.getElementById('btn-wiki').addEventListener('click', () => openWiki());
  document.getElementById('wiki-search').addEventListener('input', e => wikiSearch(e.target.value));
});

// ── Start render loop ─────────────────────────────────────────────────────

animate();
