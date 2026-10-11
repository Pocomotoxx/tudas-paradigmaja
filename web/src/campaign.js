// ── i67: Campaign mode ────────────────────────────────────────────────────
import { gs, CAMPAIGNS, syncBotOwned } from './state.js';
import { initBots }    from './bot.js';
import { resetGame }   from './combat.js';
import { renderBotOverlay } from './map3d.js';
import { addEvent, renderTurnBar, renderBotsCard } from './ui.js';
import { sfx } from './sound.js';

export { CAMPAIGNS };

export function renderCampaignList() {
  const list = document.getElementById('camp-list');
  if (!list) return;
  list.innerHTML = CAMPAIGNS.map(c =>
    `<div class="camp-item${c.unlocked ? '' : ' locked'}" data-camp="${c.id}">
      <span class="ci-badge ${c.difficulty}">${c.difficulty === 'easy' ? 'Könnyű' : c.difficulty === 'medium' ? 'Közepes' : 'Nehéz'}</span>
      <div class="ci-title">${c.name}</div>
      <div class="ci-desc">${c.desc}</div>
    </div>`,
  ).join('');
  list.querySelectorAll('.camp-item:not(.locked)').forEach(el => {
    el.addEventListener('click', () => {
      const camp = CAMPAIGNS.find(c => c.id === el.dataset.camp);
      if (camp) startCampaign(camp);
    });
  });
}

export function startCampaign(camp) {
  gs.activeCampaign = camp;
  document.getElementById('camp-overlay').classList.add('hidden');
  resetGame();
  initBots(camp.botCount || 1);
  gs.gold = camp.startGold;
  gs.kk   = camp.startKK;
  gs.currentDifficulty = camp.diffOverride;
  const diffSel = document.getElementById('diff-select');
  if (diffSel) diffSel.value = camp.diffOverride;

  if (gs.DATA) {
    let neutral = gs.DATA.provinces.filter(p => !gs.owned.has(p.id) && !gs.botOwned.has(p.id));
    neutral.sort(() => Math.random() - .5);
    let idx = 0;
    for (const bot of gs.BOTS) {
      for (let i = 0; i < camp.botStartProvinces && idx < neutral.length; i++, idx++) {
        bot.owned.add(neutral[idx].id);
      }
    }
    syncBotOwned();
    renderBotOverlay();
    renderBotsCard();
    renderTurnBar();
  }

  const botNames = gs.BOTS.map(b => `${b.persona.icon} ${b.persona.name}`).join(', ');
  addEvent(`▶ Hadjárat indult: <b>${camp.name}</b> — Ellenfelek: ${botNames}`, 'ev-info');
  sfx('conquest');
}
