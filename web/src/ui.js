// ── UI rendering — info panel, cards, XP bar, event log ───────────────────
import {
  gs, INCOME, DIFFICULTIES, XP_PER_LEVEL,
  cascadeEnabled, unrestOf, desertionChance, botOwnerOf,
} from './state.js';
import { buildingsHTML } from './economy.js';

// Late-bound callbacks set by main.js to avoid circular deps
let toggleOwnedFn = () => {};
let buildAtFn     = () => {};
export function setUICallbacks(toggleOwned, buildAt) {
  toggleOwnedFn = toggleOwned;
  buildAtFn     = buildAt;
}

// ── Event log ─────────────────────────────────────────────────────────────

export function addEvent(text, cls = 'ev-info') {
  gs.eventLog.unshift({ text, cls });
  if (gs.eventLog.length > 30) gs.eventLog.pop();
  renderEventLog();
}

export function renderEventLog() {
  const el = document.getElementById('event-log');
  if (!el) return;
  el.innerHTML = gs.eventLog.map(e => `<div class="${e.cls}">${e.text}</div>`).join('');
}

// ── Turn bar ──────────────────────────────────────────────────────────────

export function renderTurnBar() {
  const tn = document.getElementById('turn-num');
  const rg = document.getElementById('res-gold');
  const rk = document.getElementById('res-kk');
  if (tn) tn.textContent = gs.turnNumber;
  if (rg) rg.textContent = gs.gold;
  if (rk) rk.textContent = gs.kk;
}

// ── XP bar ────────────────────────────────────────────────────────────────

export function renderXPBar() {
  const level   = Math.floor(gs.xp / XP_PER_LEVEL) + 1;
  const inLevel = gs.xp % XP_PER_LEVEL;
  const lbl  = document.getElementById('xp-label');
  const fill = document.getElementById('xp-fill');
  const str  = document.getElementById('xp-streak');
  if (lbl)  lbl.textContent  = `XP: ${gs.xp}  (Szint ${level})`;
  if (fill) fill.style.width = inLevel + '%';
  if (str)  str.textContent  = gs.streak >= 2 ? `🔥 ×${gs.streak}` : '';
}

export function addXP(amount) {
  gs.xp += amount;
  renderXPBar();
}

// ── Owned card ────────────────────────────────────────────────────────────

export function renderOwnedCard() {
  const box = document.getElementById('owned-body');
  if (!box) return;
  if (!gs.owned.size) {
    box.innerHTML = '<span class="k">Kattints egy provinciára, majd az „Elfoglalom" gombra. Arany vonal jelöli a tulajdonlást.</span>';
    return;
  }
  const names = [...gs.owned].map(id => gs.byId[id]?.name ?? id);
  box.innerHTML = `<div class="owned-line">${gs.owned.size} elfoglalt terület</div><div class="k">${names.join(', ')}</div>`;
}

// ── Diff card ─────────────────────────────────────────────────────────────

export function renderDiffCard() {
  const d    = DIFFICULTIES[gs.currentDifficulty];
  const time = d.answerTimeLimitMs === null ? 'korlátlan' : (d.answerTimeLimitMs / 1000) + ' mp / kérdés';
  const el   = document.getElementById('diff-body');
  if (!el) return;
  el.innerHTML =
    `<div class="diff-row"><span class="k">Válaszidő:</span> <b>${time}</b></div>` +
    `<div class="diff-row"><span class="k">Lázadás:</span> <b>${d.rebellionIntervalTurns} körönként</b></div>` +
    `<div class="diff-row"><span class="k">Opciók:</span> <b>${d.choiceCount}</b></div>` +
    `<div class="diff-row"><span class="k">Nyugtalanság:</span> <b>${d.subjectUnrestCascade ? 'aktív' : 'nincs'}</b></div>`;
}

// ── Bots card ─────────────────────────────────────────────────────────────

export function renderBotsCard() {
  const el = document.getElementById('bots-body');
  if (!el || gs.BOTS.length === 0) {
    if (el) el.innerHTML = '<span class="k">Nincs ellenfél.</span>';
    return;
  }
  const total = gs.DATA?.provinces?.length || 1;
  el.innerHTML = gs.BOTS.map(bot => {
    const pct      = Math.round(bot.owned.size / total * 100);
    const pactText = bot.paceTurns > 0
      ? ` <span style="color:#7dcc88;font-size:10px">🤝 paktum (${bot.paceTurns} kör)</span>` : '';
    return `<div class="bot-row">
      <span>${bot.persona.icon} <b>${bot.persona.name}</b>
        <span class="persona-badge ${bot.personaKey}">${bot.personaKey}</span>${pactText}</span>
      <span style="color:#aaa">${bot.owned.size} (${pct}%) · ⭐${bot.gold}</span>
    </div>`;
  }).join('');
}

// ── Info panel helpers ────────────────────────────────────────────────────

export function ownerBadge(id) {
  if (gs.owned.has(id)) return '<span class="badge player">&#9873; Játékos</span>';
  const bot = botOwnerOf(id);
  if (bot) return `<span class="badge ${bot.badgeCss}">${bot.persona.icon} ${bot.persona.name}</span>`;
  return '<span class="badge neutral">Semleges</span>';
}

function terrainIcon(t) {
  if (t === 'mountain') return '&#9650; Hegyvidék';
  if (t === 'hill')     return '&#11835; Dombvidék';
  return '&#9644; Síkság';
}

// ── Province info panel ───────────────────────────────────────────────────

export function showInfo(p) {
  if (!gs.DATA) return;
  const f          = gs.DATA.factions.find(x => x.id === p.faction) || { color:'#c3ccd4', name: p.faction };
  const subj       = p.subject && gs.DATA.subjects?.find(s => s.id === p.subject);
  const accentColor = subj?.color || f.color || '#c3ccd4';
  const heroes     = (p.nutsId && gs.HEROES[p.nutsId]) || [];
  const isOwned    = gs.owned.has(p.id);
  const isBot      = gs.botOwned.has(p.id);
  const unrestVal  = subj && cascadeEnabled() ? unrestOf(subj.id) : 0;
  const unrestPct  = unrestVal / 10 * 100;
  const unrestColor = unrestVal >= 7 ? '#ff4422' : unrestVal >= 4 ? '#ff8a5c' : '#ffd65a';

  const header =
    `<div class="prov-header">
      <div class="prov-color-bar" style="background:${accentColor}"></div>
      <div>
        <div class="prov-name">
          ${p.name}
          ${p.capital ? '<span class="badge capital" style="margin-left:6px">&#9733; Főváros</span>' : ''}
        </div>
        <small>${subj ? subj.name : (f.name || '')}</small>
      </div>
    </div>`;

  const rows = [
    ['Tulajdon',   ownerBadge(p.id)],
    ['Frakció',    `<span style="color:${f.color}">&#9632;</span> ${f.name}`],
    ['Domborzat',  terrainIcon(p.terrain)],
    ['Szomszédok', p.adj.length + ' tartomány'],
    ...(p.nutsId ? [['Azonosító', `<span style="font-size:11px">${p.nutsId}</span>`]] : []),
    ['KK-hozam',   `+${INCOME.kk} / kör`],
    ['Arany-hozam',`+${INCOME.gold} / kör`],
  ].map(([l, v]) => `<div class="info-row"><span class="lbl">${l}</span><span class="val">${v}</span></div>`).join('');

  const unrestBar = (subj && cascadeEnabled())
    ? `<div style="margin-top:8px">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:2px">
          <span>Nyugtalanság</span><span style="color:${unrestColor}">${unrestVal}/10</span>
        </div>
        <div class="unrest-bar-wrap">
          <div class="unrest-bar-fill" style="width:${unrestPct}%;background:${unrestColor}"></div>
        </div>
        ${unrestVal > 0 ? `<div style="font-size:11px;color:${unrestColor};margin-top:2px">~${Math.round(desertionChance(subj.id) * 100)}% dezertálási esély/kör</div>` : ''}
      </div>` : '';

  const heroBlock = heroes.length
    ? `<div style="margin-top:10px;font-size:12px;color:var(--muted);margin-bottom:4px">Toborozható hősök (${heroes.length})</div>` +
      heroes.map(h => {
        const years     = (h.birth || h.death) ? `<span class="hyears">(${h.birth || '?'}–${h.death || '?'})</span>` : '';
        const eff       = h.ability?.effect;
        const effBadge  = eff && isOwned
          ? `<span style="margin-left:4px;font-size:10px;background:#1e3a20;color:#7dcc88;border-radius:3px;padding:1px 5px">✓ AKTÍV</span>`
          : '';
        const ability   = h.ability
          ? `<div class="hability">⚡ <span class="aname">${h.ability.name}</span>${effBadge} — ${h.ability.desc}${eff && isOwned ? ` <i style="color:#7dcc88">[${eff.desc}]</i>` : ''}</div>`
          : '';
        return `<div class="hero-row"><span class="hname">&#9733; ${h.name}</span>${years} <span class="hmeta">— ${h.subject} · ${h.birthLabel}</span>${ability}</div>`;
      }).join('')
    : (gs.DATA.meta?.supportsHeroes ? `<div style="margin-top:8px;font-size:12px;color:var(--muted)">Nincs toborozható hős.</div>` : '');

  const actionBtn =
    `<div style="margin-top:10px">
      <button class="own-btn${isOwned ? ' release' : ''}" id="own-toggle-btn" ${isBot ? 'disabled title="Bot tulajdona"' : ''}>
        ${isOwned ? '&#9744; Felszabadítom' : isBot ? '&#9876; Bot területe' : '&#9873; Elfoglalom (20 &#9733;)'}
      </button>
    </div>`;

  const bldBlock = buildingsHTML(p.id);
  document.getElementById('info-body').innerHTML = header + rows + unrestBar + heroBlock + bldBlock + actionBtn;

  const btn = document.getElementById('own-toggle-btn');
  if (btn && !isBot) btn.addEventListener('click', () => { toggleOwnedFn(p.id); showInfo(p); });

  document.querySelectorAll('.bld-btn:not([disabled])').forEach(b => {
    b.addEventListener('click', () => buildAtFn(b.dataset.prov, b.dataset.bld));
  });

  if (subj) showSubject(subj);
  else {
    const sc = document.getElementById('subj-card');
    if (sc) sc.classList.remove('visible');
  }
}

export function showSubject(subj) {
  if (!gs.DATA) return;
  const provs       = gs.DATA.provinces.filter(p => p.subject === subj.id);
  const playerCount = provs.filter(p => gs.owned.has(p.id)).length;
  const botCount    = provs.filter(p => gs.botOwned.has(p.id)).length;
  const totalKK     = playerCount * INCOME.kk;
  const u           = cascadeEnabled() ? unrestOf(subj.id) : 0;
  const uColor      = u >= 7 ? '#ff4422' : u >= 4 ? '#ff8a5c' : '#ffd65a';

  const rows = [
    ['Tartományok', provs.length + ' db'],
    ['Játékos kezén', playerCount + ' db'],
    ['Bot kezén',     botCount + ' db'],
    ['Semleges',      (provs.length - playerCount - botCount) + ' db'],
    ['KK-termelés',  `+${totalKK} / kör`],
    ...(cascadeEnabled() ? [['Nyugtalanság', `<span style="color:${uColor}">${u}/10</span>`]] : []),
  ].map(([l, v]) => `<div class="info-row"><span class="lbl">${l}</span><span class="val">${v}</span></div>`).join('');

  const uBar = cascadeEnabled()
    ? `<div class="unrest-bar-wrap" style="margin-top:6px">
        <div class="unrest-bar-fill" style="width:${u / 10 * 100}%;background:${uColor}"></div>
      </div>` : '';

  document.getElementById('subj-body').innerHTML =
    `<div class="subj-header">
      <div class="subj-dot" style="background:${subj.color}"></div>
      <span class="subj-name">${subj.name}</span>
    </div>` + rows + uBar;

  document.getElementById('subj-card').classList.add('visible');
}
