// ── Shared mutable game state ──────────────────────────────────────────────
// All modules import { gs } and use gs.gold, gs.owned, etc.
// Mutating via gs.field = value or gs.owned.add(id) is safe across ES modules.

export const gs = {
  DATA:     null,
  byId:     {},
  HEROES:   {},
  QBANK:    [],
  PALETTE:  {},

  owned:    new Set(),
  gold:     0,
  kk:       0,
  turnNumber: 1,
  gameOver: false,

  xp:       0,
  streak:   0,

  currentDifficulty: 1,

  BOTS:    [],
  botOwned: new Set(),   // union of all bot.owned — kept in sync by syncBotOwned()
  botGold: 20,
  botKK:   10,

  eventLog: [],

  buildings: {},         // { [provId]: Set<buildingKey> }

  activeCampaign: null,

  unrestWrong: {},       // { [subjectId]: number }
  unrestLevel: {},       // { [subjectId]: number }
};

// ── Constants ──────────────────────────────────────────────────────────────

export const SUBJ_MAP = {
  MAGYAR:'magyar', MATEMATIKA:'matematika', FIZIKA:'fizika', KEMIA:'kemia',
  BIOLOGIA:'biologia', TORTENELEM:'tortenelem', FOLDRAJZ:'foldrajz',
  INFORMATIKA:'informatika', IDEGEN_NYELV:'idegen',
};

export const INCOME     = { gold: 8, kk: 3 };
export const BOT_INCOME = { gold: 6, kk: 2 };

export const XP_PER_CORRECT  = 10;
export const XP_STREAK_BONUS = 5;
export const XP_PER_LEVEL    = 100;

export const WIN_THRESHOLD = 0.60;

export const DIFFICULTIES = {
  1: { rebellionIntervalTurns:10, choiceCount:2, subjectUnrestCascade:false, answerTimeLimitMs:null },
  2: { rebellionIntervalTurns:8,  choiceCount:3, subjectUnrestCascade:false, answerTimeLimitMs:null },
  3: { rebellionIntervalTurns:6,  choiceCount:5, subjectUnrestCascade:true,  answerTimeLimitMs:20000 },
  4: { rebellionIntervalTurns:3,  choiceCount:7, subjectUnrestCascade:true,  answerTimeLimitMs:10000 },
};

export const UNREST = {
  wrongThreshold: 3,
  unrestStep:     1,
  coolStep:       1,
  maxUnrest:      10,
  desertionPerUnrest: 0.08,
};

export const BUILDINGS = {
  fort:    { name:'Erőd',     icon:'&#127963;', cost:30, desc:'+2 véd. bónusz', goldBonus:0, kkBonus:0, defBonus:2 },
  library: { name:'Könyvtár', icon:'&#128218;', cost:25, desc:'+2 KK/kör',      goldBonus:0, kkBonus:2, defBonus:0 },
  mine:    { name:'Aranyér',  icon:'&#9935;',   cost:25, desc:'+3 arany/kör',   goldBonus:3, kkBonus:0, defBonus:0 },
};

export const BOT_PERSONAS = {
  agresszív: {
    name: 'Agresszív',
    icon: '⚔️',
    color: 0xff4400,
    cssClass: 'bot1',
    scoreWeights: { capital:500, adj:12, blockBonus:80, subjectMult:1.0 },
    quizSuccessBase: 0.55,
    attackChanceMult: 1.5,
    incomeMultGold: 0.9, incomeMultKK: 0.8,
    diploStyle: 'peace',
    maxConquestPerTurn: 3,
  },
  gazdasági: {
    name: 'Gazdasági',
    icon: '💰',
    color: 0x00cc55,
    cssClass: 'bot2',
    scoreWeights: { capital:300, adj:20, blockBonus:20, subjectMult:1.8 },
    quizSuccessBase: 0.70,
    attackChanceMult: 0.6,
    incomeMultGold: 1.4, incomeMultKK: 1.2,
    diploStyle: 'trade',
    maxConquestPerTurn: 2,
  },
  tudós: {
    name: 'Tudós',
    icon: '📚',
    color: 0x9944ff,
    cssClass: 'bot3',
    scoreWeights: { capital:200, adj:8, blockBonus:30, subjectMult:2.5 },
    quizSuccessBase: 0.85,
    attackChanceMult: 0.4,
    incomeMultGold: 1.0, incomeMultKK: 1.6,
    diploStyle: 'alliance',
    maxConquestPerTurn: 1,
  },
};

export const CAMPAIGNS = [
  { id:'c1', name:'Első lépések', difficulty:'easy',
    desc:'Könnyű pálya — 1 ellenfél (Gazdasági), végtelen idő. Tökéletes a kezdőknek.',
    startGold:40, startKK:20, winThreshold:0.50,
    botCount:1, botStartProvinces:1, diffOverride:1, unlocked:true },
  { id:'c2', name:'Közép-Európa', difficulty:'medium',
    desc:'Közepes — 2 ellenfél (Agresszív + Tudós), 3-3 kezdőtartomány, 40% kell.',
    startGold:30, startKK:15, winThreshold:0.40,
    botCount:2, botStartProvinces:3, diffOverride:2, unlocked:true },
  { id:'c3', name:'Nagy Hadjárat', difficulty:'hard',
    desc:'Nehéz — 2 ellenfél, szoros kérdések, 10 mp, 55% kell.',
    startGold:20, startKK:10, winThreshold:0.55,
    botCount:2, botStartProvinces:5, diffOverride:4, unlocked:true },
  { id:'c4', name:'Mesterek Bajnoksága', difficulty:'hard',
    desc:'Elit — 3 ellenfél különböző személyiséggel, 65% arány, minden tartomány számít.',
    startGold:15, startKK:8, winThreshold:0.65,
    botCount:3, botStartProvinces:4, diffOverride:4, unlocked:true },
];

// ── Helper functions on state ──────────────────────────────────────────────

export function cascadeEnabled() {
  return DIFFICULTIES[gs.currentDifficulty].subjectUnrestCascade;
}

export function unrestOf(sid) {
  return gs.unrestLevel[sid] || 0;
}

export function desertionChance(sid) {
  return Math.min(1, unrestOf(sid) * UNREST.desertionPerUnrest);
}

export function botOwnerOf(id) {
  return gs.BOTS.find(b => b.owned.has(id));
}

export function syncBotOwned() {
  gs.botOwned.clear();
  for (const bot of gs.BOTS)
    for (const id of bot.owned)
      gs.botOwned.add(id);
}

export function provinceChoiceCount(prov) {
  const base  = DIFFICULTIES[gs.currentDifficulty].choiceCount;
  const b     = prov.b ?? 0;
  const delta = b > 1 ? 2 : b > 0 ? 1 : b < -1 ? -1 : 0;
  return Math.min(7, Math.max(2, base + delta));
}

export function provinceTimeLimit(prov) {
  const base = DIFFICULTIES[gs.currentDifficulty].answerTimeLimitMs;
  if (!base) return null;
  const b = prov.b ?? 0;
  if (b > 1) return Math.max(5000, base - 5000);
  return base;
}

export function pickQuestion(subjectId) {
  const key  = SUBJ_MAP[subjectId] || subjectId.toLowerCase();
  const pool = gs.QBANK.filter(q => q.subject === key);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
