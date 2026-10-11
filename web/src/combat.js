// ── Combat: quiz modal, defense modal, toggleOwned, game management ────────
import {
  gs, WIN_THRESHOLD, XP_PER_CORRECT, XP_STREAK_BONUS, XP_PER_LEVEL,
  SUBJ_MAP, pickQuestion, provinceChoiceCount, provinceTimeLimit, syncBotOwned,
} from './state.js';
import { sfx } from './sound.js';
import {
  addEvent, renderTurnBar, renderXPBar, renderOwnedCard, renderBotsCard, showInfo,
} from './ui.js';
import {
  renderOwnershipOverlay3D, renderBotOverlay, triggerConquest,
} from './map3d.js';
import { heroAttackBonus } from './heroes.js';
import { provDefBonus }    from './economy.js';
import { botTurn, tickBotPacts } from './bot.js';
import { applyHeroSideEffects, heroUnrestReduction } from './heroes.js';
import { renderUnrestCard } from './unrest.js';
import { renderUnrestOverlay3D } from './map3d.js';

// ── Question modal ────────────────────────────────────────────────────────

let _timerInterval = null;

export function showQuestionModal(prov, onSuccess, onCancel, mode = 'attack') {
  const q          = pickQuestion(prov.subject);
  const subj       = gs.DATA.subjects?.find(s => s.id === prov.subject);
  const overlay    = document.getElementById('q-overlay');
  const choiceCount = provinceChoiceCount(prov);
  const timeLimitMs = provinceTimeLimit(prov);

  const badge = document.getElementById('q-mode-badge');
  if (mode === 'attack') {
    badge.className = 'attack';
    badge.textContent = '⚔ Támadás';
    badge.classList.remove('hidden');
  }

  const distractors = (q ? [...q.distractors] : []).sort(() => Math.random() - .5).slice(0, choiceCount - 1);
  const choices     = q ? [q.correct, ...distractors].sort(() => Math.random() - .5) : [];

  document.getElementById('q-subject').textContent =
    subj ? subj.name + ' — Tudáskapu' : 'Tudáskapu';
  document.getElementById('q-prompt').textContent =
    q ? q.prompt : 'Nincs elérhető kérdés ehhez a tartományhoz.';

  if (typeof setWikiBtnFn === 'function') setWikiBtnFn(prov.subject, q?.prompt);

  const timerEl = document.getElementById('q-timer');
  if (timeLimitMs && q) {
    timerEl.classList.remove('hidden');
    let remaining = timeLimitMs / 1000;
    timerEl.innerHTML = 'Maradt: <b>' + remaining + ' mp</b>';
    _timerInterval = setInterval(() => {
      remaining--;
      timerEl.innerHTML = 'Maradt: <b>' + remaining + ' mp</b>';
      if (remaining <= 0) {
        clearInterval(_timerInterval);
        finishModal();
        addEvent('&#9201; Lejárt az idő! Nem sikerült elfoglalni: ' + prov.name, 'ev-info');
        onCancel && onCancel();
      }
    }, 1000);
  } else {
    timerEl.classList.add('hidden');
  }

  const choicesEl = document.getElementById('q-choices');
  if (q) {
    choicesEl.innerHTML = choices.map((c, i) =>
      `<button class="q-choice" data-idx="${i}">${c}</button>`,
    ).join('');
    choicesEl.querySelectorAll('.q-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const correct = btn.textContent === q.correct;
        choicesEl.querySelectorAll('.q-choice').forEach(b => {
          b.disabled = true;
          if (b.textContent === q.correct) b.classList.add('correct');
          else if (b === btn && !correct) b.classList.add('wrong');
        });
        clearInterval(_timerInterval);
        setTimeout(() => {
          finishModal();
          if (correct) {
            sfx('correct');
            gs.streak++;
            const earned     = XP_PER_CORRECT + (gs.streak > 1 ? XP_STREAK_BONUS * (gs.streak - 1) : 0);
            gs.xp           += earned;
            renderXPBar();
            const streakMsg  = gs.streak > 1 ? ` 🔥 Sorozat ×${gs.streak} (+${earned} XP)` : ` (+${earned} XP)`;
            addEvent('&#10003; Helyes válasz!' + streakMsg, 'ev-player');
            onSuccess && onSuccess();
          } else {
            sfx('wrong');
            gs.streak = 0; renderXPBar();
            addEvent('&#10007; Rossz válasz! Nem sikerült elfoglalni: <b>' + prov.name + '</b>', 'ev-info');
            onCancel && onCancel();
          }
        }, 900);
      });
    });
  } else {
    choicesEl.innerHTML = '<button class="q-choice correct" id="q-noq-btn">Nincs kérdés — automatikus siker</button>';
    document.getElementById('q-noq-btn').addEventListener('click', () => {
      finishModal(); onSuccess && onSuccess();
    });
  }

  document.getElementById('q-cancel').onclick = () => {
    clearInterval(_timerInterval);
    finishModal();
    onCancel && onCancel();
  };

  overlay.classList.remove('hidden');
}

function finishModal() {
  document.getElementById('q-overlay').classList.add('hidden');
  clearInterval(_timerInterval);
  const badge = document.getElementById('q-mode-badge');
  badge.className = 'attack hidden';
  const wb = document.getElementById('wiki-btn');
  if (wb) wb.style.display = 'none';
  const qe = document.getElementById('q-explanation');
  if (qe) { qe.textContent = ''; qe.className = ''; }
}

// ── Defense modal ─────────────────────────────────────────────────────────

export function showDefenseModal(prov, defBonus, attackingBot) {
  const bot    = attackingBot || gs.BOTS[0];
  const badge  = document.getElementById('q-mode-badge');
  badge.className   = 'defend';
  badge.textContent = '🛡️ Védekezés';
  badge.classList.remove('hidden');
  const defDiff  = Math.min(4, gs.currentDifficulty + (defBonus > 0 ? -1 : 1));
  const origDiff = gs.currentDifficulty;
  gs.currentDifficulty = Math.max(1, defDiff);
  showQuestionModal(prov,
    () => { // defended
      gs.currentDifficulty = origDiff;
      addEvent(`🛡️ Megvédve: <b>${prov.name}</b>! (${bot?.persona.icon || '⚔️'} ${bot?.persona.name || 'Bot'} visszaverve)`, 'ev-player');
      sfx('conquest');
    },
    () => { // province lost
      gs.currentDifficulty = origDiff;
      gs.owned.delete(prov.id);
      if (bot) { bot.owned.add(prov.id); syncBotOwned(); }
      else gs.botOwned.add(prov.id);
      renderOwnershipOverlay3D(); renderBotOverlay(); renderOwnedCard(); renderBotsCard();
      addEvent(`${bot?.persona.icon || '⚔️'} Elveszett: <b>${prov.name}</b> — <b>${bot?.persona.name || 'Bot'}</b> elfoglalta!`, 'ev-bot');
      sfx('lose_province');
      checkVictory();
      const selProv = gs.byId[prov.id]; if (selProv) showInfo(selProv);
    },
  );
}

// ── toggleOwned ───────────────────────────────────────────────────────────

export function toggleOwned(id) {
  const prov = gs.byId[id];
  if (gs.owned.has(id)) {
    gs.owned.delete(id);
    addEvent(`&#9744; Felszabadítva: <b>${prov?.name ?? id}</b>`, 'ev-info');
    renderOwnershipOverlay3D(); renderOwnedCard();
  } else {
    const cost = 20;
    if (gs.gold < cost) {
      addEvent(`&#9888; Nincs elég arany (kell: ${cost}, van: ${gs.gold})`, 'ev-info');
      return;
    }
    if (prov && prov.subject && gs.QBANK.length) {
      const atkBonus = heroAttackBonus();
      const origDiff = gs.currentDifficulty;
      if (atkBonus > 0) gs.currentDifficulty = Math.max(1, gs.currentDifficulty - Math.round(atkBonus * 3));
      showQuestionModal(prov,
        () => {
          gs.currentDifficulty = origDiff;
          gs.gold -= cost;
          gs.owned.add(id);
          renderTurnBar();
          triggerConquest(id, true);
          sfx('conquest');
          const atkMsg = atkBonus > 0 ? ` <span style="color:#c9a84c;font-size:11px">(hős segített!)</span>` : '';
          addEvent(`&#9873; Elfoglalva: <b>${prov.name}</b> (-${cost} arany)${atkMsg}`, 'ev-player');
          renderOwnershipOverlay3D(); renderOwnedCard();
          checkVictory();
          const selProv = gs.byId[id]; if (selProv) showInfo(selProv);
        },
        () => {
          gs.currentDifficulty = origDiff;
          const selProv = gs.byId[id]; if (selProv) showInfo(selProv);
        },
      );
    } else {
      gs.gold -= cost;
      gs.owned.add(id);
      renderTurnBar();
      triggerConquest(id, true);
      addEvent(`&#9873; Elfoglalva: <b>${prov?.name ?? id}</b> (-${cost} arany)`, 'ev-player');
      renderOwnershipOverlay3D(); renderOwnedCard();
      checkVictory();
    }
  }
}

// ── Victory / game over ───────────────────────────────────────────────────

export function checkVictory() {
  if (gs.gameOver || !gs.DATA) return;
  const total = gs.DATA.provinces.length;
  if (!total) return;
  if (gs.owned.size / total >= WIN_THRESHOLD) { showGameOver(true); return; }
  for (const bot of gs.BOTS) {
    if (bot.owned.size / total >= WIN_THRESHOLD) { showGameOver(false, bot); return; }
  }
}

function showGameOver(win, losingBot) {
  gs.gameOver = true;
  sfx(win ? 'win' : 'lose');
  document.getElementById('btn-end-turn').disabled = true;
  const total   = gs.DATA.provinces.length;
  const overlay = document.getElementById('go-overlay');
  const title   = document.getElementById('go-title');
  const sub     = document.getElementById('go-sub');
  const stats   = document.getElementById('go-stats');
  title.textContent = win ? '🏆 Győzelem!' : '💀 Vereség';
  title.className   = win ? 'win' : 'lose';
  sub.textContent   = win
    ? `Elfoglaltad a térkép ${Math.round(WIN_THRESHOLD * 100)}%-át — A Tudás Győzött!`
    : `${losingBot?.persona.icon || '⚔️'} ${losingBot?.persona.name || 'Ellenfél'} elérte a ${Math.round(WIN_THRESHOLD * 100)}%-os határt — Vereség!`;
  const botRows = gs.BOTS.map(b => [`${b.persona.icon} ${b.persona.name}`, `${b.owned.size} tartomány`]);
  stats.innerHTML = [
    ['Körök száma',              gs.turnNumber],
    ['Elfoglalt tartományok',    `${gs.owned.size} / ${total}`],
    ...botRows,
    ['Összesített XP',           gs.xp],
    ['Szint',                    Math.floor(gs.xp / XP_PER_LEVEL) + 1],
    ['Arany maradt',             gs.gold],
  ].map(([l, v]) => `<div class="gs-row"><span class="gs-lbl">${l}</span><span class="gs-val">${v}</span></div>`).join('');
  overlay.classList.remove('hidden');
}

export function resetGame() {
  gs.gameOver   = false;
  gs.turnNumber = 1;
  gs.gold = 0; gs.kk = 0;
  gs.botGold = 20; gs.botKK = 10;
  gs.xp = 0; gs.streak = 0;
  gs.owned.clear();
  for (const bot of gs.BOTS) {
    bot.owned.clear(); bot.gold = 20; bot.kk = 10;
    bot.diploActive = false; bot.paceTurns = 0;
  }
  syncBotOwned();
  for (const k in gs.buildings) delete gs.buildings[k];
  gs.activeCampaign = null;
  gs.eventLog = [];
  document.getElementById('event-log').innerHTML = '<div class="ev-info">Új játék kezdődött.</div>';
  document.getElementById('go-overlay').classList.add('hidden');
  document.getElementById('btn-end-turn').disabled = false;
  renderTurnBar(); renderXPBar();
  if (gs.DATA) { renderOwnershipOverlay3D(); renderBotOverlay(); renderOwnedCard(); }
}

// ── Bot attack turn (i65) ─────────────────────────────────────────────────

export function botAttackTurn() {
  if (!gs.DATA || gs.gameOver) return;
  if (gs.BOTS.length === 0) return;
  for (const bot of gs.BOTS) {
    if (gs.gameOver) return;
    if (bot.paceTurns > 0) continue;
    if (bot.owned.size === 0) continue;
    const baseChance  = [0, 0.20, 0.30, 0.45, 0.60][gs.currentDifficulty] || 0.30;
    const attackChance = Math.min(0.85, baseChance * bot.persona.attackChanceMult);
    if (Math.random() > attackChance) continue;
    const playerProvs = gs.DATA.provinces.filter(p => gs.owned.has(p.id));
    if (!playerProvs.length) continue;
    const adjacent = playerProvs.filter(p => (p.adj ?? []).some(id => bot.owned.has(id)));
    const target   = adjacent.length
      ? adjacent[Math.floor(Math.random() * adjacent.length)]
      : playerProvs[Math.floor(Math.random() * playerProvs.length)];
    const dBonus = provDefBonus(target.id);
    addEvent(`${bot.persona.icon} <b>${bot.persona.name}</b> támadja: <b>${target.name}</b>!`, 'ev-bot');
    sfx('lose_province');
    showDefenseModal(target, dBonus, bot);
    return;
  }
}

// ── End turn ──────────────────────────────────────────────────────────────

export function endTurn() {
  if (gs.gameOver) return;
  sfx('turn');
  document.getElementById('btn-end-turn').disabled = true;
  // player income
  playerIncomeFn();
  // hero side effects
  applyHeroSideEffects();
  // hero unrest reduction
  if (gs.DATA && typeof gs.DATA.provinces !== 'undefined') {
    const subjects = [...new Set(gs.DATA.provinces.map(p => p.subject).filter(Boolean))];
    for (const sid of subjects) {
      const red = heroUnrestReduction(sid);
      if (red > 0) {
        const prev = gs.unrestLevel[sid] || 0;
        gs.unrestLevel[sid] = Math.max(0, prev - red);
        if (prev > 0 && (gs.unrestLevel[sid] || 0) < prev)
          addEvent(`⚡ Hős csökkentette a lázadást (${sid}): ${prev} → ${gs.unrestLevel[sid] || 0}`, 'ev-player');
      }
    }
    renderUnrestCard();
    renderUnrestOverlay3D();
  }
  tickBotPacts();
  botTurn();
  if (gs.gameOver) return;
  botAttackTurn();
  if (gs.gameOver) return;
  gs.turnNumber++;
  renderTurnBar();
  addEvent(`— ${gs.turnNumber}. kör kezdődik —`, 'ev-info');
  document.getElementById('btn-end-turn').disabled = false;
}

// Late-bound for playerIncome (economy.js → combat.js avoids circular)
let playerIncomeFn = () => {};
let setWikiBtnFn   = null;
export function setCombatCallbacks(playerIncome, setWikiBtn) {
  playerIncomeFn = playerIncome;
  setWikiBtnFn   = setWikiBtn;
}
