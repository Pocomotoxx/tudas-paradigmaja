// ── i79: Multi-bot system ─────────────────────────────────────────────────
import {
  gs, BOT_PERSONAS, BOT_INCOME, syncBotOwned, botOwnerOf,
} from './state.js';
import { addEvent, renderBotsCard } from './ui.js';
import {
  renderBotOverlay, triggerConquest, outlineById,
} from './map3d.js';

export function initBots(count = 1) {
  gs.BOTS = [];
  const personaKeys = Object.keys(BOT_PERSONAS);
  const colors      = ['bot1', 'bot2', 'bot3'];
  for (let i = 0; i < Math.min(count, 3); i++) {
    const personaKey = personaKeys[i % personaKeys.length];
    const persona    = BOT_PERSONAS[personaKey];
    gs.BOTS.push({
      id:          i,
      personaKey,
      persona,
      owned:       new Set(),
      gold:        20 + i * 5,
      kk:          10,
      diploActive: false,
      paceTurns:   0,
      badgeCss:    colors[i],
    });
  }
}

// ── Scoring ───────────────────────────────────────────────────────────────

function botScoreFor(bot, prov) {
  if (!gs.DATA) return 0;
  const w         = bot.persona.scoreWeights;
  const isCapital = prov.capital ? w.capital : 0;
  const adjCount  = prov.adj?.length ?? 0;
  const subj      = gs.DATA.subjects?.find(s => s.id === prov.subject);
  const K         = subj ? w.subjectMult : 1.0;
  const botAdj    = (prov.adj ?? []).filter(id => bot.owned.has(id)).length;
  const playerAdj = (prov.adj ?? []).filter(id => gs.owned.has(id)).length;
  const blockBonus = playerAdj * w.blockBonus;
  const base      = (100 + isCapital + adjCount * w.adj) * K;
  const distCost  = bot.owned.size === 0 ? 1 : Math.max(1, 4 - botAdj * 2);
  return (base + blockBonus) / distCost;
}

function botQuizSuccess(bot) {
  const diffPenalty = [0, 0, 0.05, 0.12, 0.22][gs.currentDifficulty] || 0;
  const chance      = Math.max(0.20, bot.persona.quizSuccessBase - diffPenalty);
  return Math.random() < chance;
}

// ── Single bot's expansion turn ───────────────────────────────────────────

function runBotTurn(bot) {
  if (gs.gameOver) return;
  const gMult = bot.persona.incomeMultGold;
  const kMult = bot.persona.incomeMultKK;
  bot.gold += Math.round((bot.owned.size * BOT_INCOME.gold + BOT_INCOME.gold) * gMult);
  bot.kk   += Math.round((bot.owned.size * BOT_INCOME.kk   + BOT_INCOME.kk)   * kMult);

  const candidates = gs.DATA.provinces.filter(p => !gs.owned.has(p.id) && !gs.botOwned.has(p.id));
  if (!candidates.length) return;
  candidates.sort((a, b) => botScoreFor(bot, b) - botScoreFor(bot, a));

  const cost     = 20;
  let conquered  = 0;
  const maxConq  = bot.persona.maxConquestPerTurn;

  for (const target of candidates) {
    if (bot.gold < cost || conquered >= maxConq) break;
    if (!botQuizSuccess(bot)) {
      addEvent(`${bot.persona.icon} ${bot.persona.name} megpróbálta foglalni <b>${target.name}</b> — de elbukott a kvízen!`, 'ev-bot');
      break;
    }
    bot.owned.add(target.id);
    bot.gold -= cost;
    conquered++;
    syncBotOwned();
    renderBotOverlay();
    triggerConquest(target.id, false);
    const msgs = {
      agresszív: [`⚔️ <b>${bot.persona.name}</b> lerohanta: <b>${target.name}</b>!`,
                  `⚔️ Vasökölpolitika: <b>${target.name}</b> elesett!`],
      gazdasági: [`💰 <b>${bot.persona.name}</b> megvásárolta: <b>${target.name}</b>`,
                  `💰 Befektetés: <b>${target.name}</b> az övé!`],
      tudós:     [`📚 <b>${bot.persona.name}</b> kutatja: <b>${target.name}</b>`,
                  `📚 Tudományos terjeszkedés: <b>${target.name}</b>`],
    };
    const pool = msgs[bot.personaKey] || [`${bot.persona.icon} ${bot.persona.name} elfoglalta: <b>${target.name}</b>`];
    addEvent(pool[Math.floor(Math.random() * pool.length)], 'ev-bot');
  }
  checkVictoryFn();
}

export function botTurn() {
  if (!gs.DATA || gs.gameOver) return;
  if (gs.BOTS.length === 0) initBots(1);
  for (const bot of gs.BOTS) { runBotTurn(bot); if (gs.gameOver) return; }
  tryDiplomacyOffer();
  renderBotsCard();
}

// ── Pact timers ───────────────────────────────────────────────────────────

export function tickBotPacts() {
  for (const bot of gs.BOTS) {
    if (bot.paceTurns > 0) {
      bot.paceTurns--;
      if (bot.paceTurns === 0)
        addEvent(`${bot.persona.icon} A paktum lejárt — ${bot.persona.name} szabadon cselekedhet`, 'ev-bot');
    }
  }
  renderBotsCard();
}

// ── Diplomacy ─────────────────────────────────────────────────────────────

export function tryDiplomacyOffer() {
  if (!gs.DATA || gs.gameOver || gs.owned.size === 0) return;
  for (const bot of gs.BOTS) {
    if (bot.diploActive || bot.paceTurns > 0) continue;
    const total       = gs.DATA.provinces.length;
    const botRatio    = bot.owned.size / total;
    const playerRatio = gs.owned.size   / total;
    const losingPenalty = playerRatio > botRatio ? (playerRatio - botRatio) * 1.5 : 0;
    const chance      = 0.10 + losingPenalty;
    if (Math.random() > chance) continue;
    showDiplomacyModal(bot);
    return;
  }
}

function showDiplomacyModal(bot) {
  bot.diploActive = true;
  const style = bot.persona.diploStyle;
  let title, offer, acceptFn, declineFn;

  if (style === 'peace') {
    title  = `${bot.persona.icon} Békeajánlat`;
    offer  = `<b>${bot.persona.name}</b> fegyverszünetet ajánl: <b>3 körre</b> nem támad a tartományaidra, cserébe te sem foglalsz el tőle területet ebben az időszakban.<br><br>Elfogadod a fegyverszünetet?`;
    acceptFn  = () => {
      bot.paceTurns = 3;
      addEvent(`🤝 Fegyverszünet kötve ${bot.persona.name}-val (3 kör)`, 'ev-info');
      renderBotsCard();
    };
    declineFn = () => addEvent(`${bot.persona.icon} ${bot.persona.name} elutasítva — a harc folytatódik!`, 'ev-bot');
  } else if (style === 'trade') {
    title      = `${bot.persona.icon} Kereskedelmi ajánlat`;
    const reward = 30 + bot.owned.size * 3;
    offer      = `<b>${bot.persona.name}</b> kereskedelmi egyezményt ajánl: <b>+${reward} aranyat</b> fizet neked minden körben, cserébe 2 körre nem terjeszked az ő tartományai szomszédságában.<br><br>Elfogadod?`;
    acceptFn   = () => {
      bot.paceTurns = 2;
      gs.gold += reward;
      renderTurnBarFn();
      addEvent(`💰 Kereskedelmi egyezmény: +${reward} arany, 2 kör mozgásszünet`, 'ev-player');
      renderBotsCard();
    };
    declineFn  = () => addEvent(`${bot.persona.icon} ${bot.persona.name} kereskedelmi ajánlatát elutasítottad`, 'ev-bot');
  } else {
    title      = `${bot.persona.icon} Szövetségi ajánlat`;
    const kkReward = 15;
    offer      = `<b>${bot.persona.name}</b> tudományos szövetséget ajánl: <b>+${kkReward} KK</b> kap mindkét fél, és 2 körre szünetel a konfliktus.<br><br>Elfogadod a szövetséget?`;
    acceptFn   = () => {
      bot.paceTurns = 2;
      gs.kk     += kkReward;
      bot.kk    += kkReward;
      renderTurnBarFn();
      addEvent(`📚 Tudományos szövetség kötve: +${kkReward} KK mindkét félnek`, 'ev-player');
      renderBotsCard();
    };
    declineFn  = () => addEvent(`${bot.persona.icon} ${bot.persona.name} szövetségi ajánlatát elutasítottad`, 'ev-bot');
  }

  document.getElementById('diplo-title').textContent    = title;
  document.getElementById('diplo-bot-name').textContent = `${bot.persona.name} · ${bot.personaKey} ellenfél`;
  document.getElementById('diplo-offer-text').innerHTML  = offer;
  document.getElementById('diplo-overlay').classList.remove('hidden');

  const acceptBtn  = document.getElementById('diplo-accept');
  const declineBtn = document.getElementById('diplo-decline');
  const close = (accepted) => {
    document.getElementById('diplo-overlay').classList.add('hidden');
    bot.diploActive = false;
    if (accepted) acceptFn(); else declineFn();
  };
  acceptBtn.onclick  = () => close(true);
  declineBtn.onclick = () => close(false);
}

// Late-bound refs
let checkVictoryFn  = () => {};
let renderTurnBarFn = () => {};
export function setBotCallbacks(checkVictory, renderTurnBar) {
  checkVictoryFn  = checkVictory;
  renderTurnBarFn = renderTurnBar;
}
