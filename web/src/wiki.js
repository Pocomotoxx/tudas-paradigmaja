// ── i73: Mini Wikipedia + phrase widget ───────────────────────────────────
import { gs, SUBJ_MAP } from './state.js';

let WIKI_DATA = null;

export function initWiki() {
  fetch('wiki.json').then(r => r.json()).then(d => {
    WIKI_DATA = d;
    buildWikiNav();
  }).catch(() => {});
}

export function buildWikiNav() {
  if (!WIKI_DATA) return;
  const nav = document.getElementById('wiki-nav');
  if (!nav) return;
  nav.innerHTML = Object.entries(WIKI_DATA).map(([k, v]) =>
    `<div class="wiki-nav-item" data-subj="${k}">
       <span class="wiki-nav-icon">${v.icon}</span>
       <span>${v.title}</span>
     </div>`,
  ).join('');
  nav.querySelectorAll('.wiki-nav-item').forEach(el => {
    el.addEventListener('click', () => showWikiSubject(el.dataset.subj));
  });
}

function showWikiSubject(subjectKey) {
  if (!WIKI_DATA) return;
  const data = WIKI_DATA[subjectKey];
  if (!data) return;
  document.querySelectorAll('.wiki-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.subj === subjectKey);
  });
  document.getElementById('wiki-search').value = '';
  document.getElementById('wiki-search-results').style.display = 'none';
  document.getElementById('wiki-no-results').style.display    = 'none';
  document.getElementById('wiki-subject-view').style.display  = '';
  const view = document.getElementById('wiki-subject-view');
  view.innerHTML = `
    <p class="wiki-subj-title">${data.icon} ${data.title}</p>
    <p class="wiki-summary">${data.summary}</p>
    ${data.articles.map(a => `
      <div class="wiki-article">
        <h4>${a.heading}</h4>
        <p>${markdownBold(a.body)}</p>
      </div>`).join('')}
    ${data.phrases ? buildPhraseWidget(data.phrases) : ''}
  `;
  if (data.phrases) initPhraseWidget(view, data.phrases);
}

// ── Phrase flashcard widget ───────────────────────────────────────────────

const PHRASE_STORAGE_KEY = 'tudas_custom_phrases_v1';

function loadCustomPhrases() {
  try { return JSON.parse(localStorage.getItem(PHRASE_STORAGE_KEY) || '[]'); } catch (e) { return []; }
}
function saveCustomPhrases(arr) {
  try { localStorage.setItem(PHRASE_STORAGE_KEY, JSON.stringify(arr)); } catch (e) {}
}

function buildPhraseWidget(basePhrases) {
  const custom = loadCustomPhrases();
  const all    = [...basePhrases, ...custom];
  const langs  = [...new Set(all.map(p => p.lang))];
  return `<div class="phrase-section">
    <div class="phrase-section-header">
      <h4>🃏 Kifejezéstár — kattints a kártyára a fordításhoz</h4>
      <button class="phrase-edit-toggle" id="phrase-edit-toggle">✏️ Szerkesztés</button>
    </div>
    <div class="phrase-lang-tabs" id="phrase-lang-tabs">
      ${langs.map((l, i) => `<button class="phrase-lang-tab${i === 0 ? ' active' : ''}" data-lang="${l}">${l}</button>`).join('')}
    </div>
    <div class="phrase-card" id="phrase-card">
      <div class="phrase-src" id="phrase-src"></div>
      <div class="phrase-tgt" id="phrase-tgt"></div>
      <div class="phrase-hint">Kattints a fordításhoz ▼</div>
    </div>
    <div class="phrase-nav">
      <button id="phrase-prev">◀</button>
      <span class="phrase-counter" id="phrase-counter"></span>
      <button id="phrase-next">▶</button>
    </div>
    <div class="phrase-editor" id="phrase-editor">
      <div class="phrase-editor-title">✏️ Saját kifejezések kezelése</div>
      <div class="phrase-add-form">
        <select id="phrase-new-lang">
          ${langs.map(l => `<option value="${l}">${l}</option>`).join('')}
          <option value="__new__">+ Új nyelv…</option>
        </select>
        <input id="phrase-new-src" placeholder="Idegen kifejezés" />
        <input id="phrase-new-tgt" placeholder="Magyar fordítás" />
        <button class="phrase-add-btn" id="phrase-add-btn">＋ Hozzáad</button>
      </div>
      <div id="phrase-new-lang-row" style="display:none;margin-bottom:8px">
        <input id="phrase-new-lang-name" placeholder="Új nyelv neve"
          style="background:#1e2330;border:1px solid #2a3040;color:#e7ebf0;border-radius:6px;padding:6px 10px;font-size:12px;width:200px" />
      </div>
      <div class="phrase-list" id="phrase-custom-list"></div>
    </div>
  </div>`;
}

function initPhraseWidget(container, basePhrases) {
  let custom     = loadCustomPhrases();
  let activeLang = null;
  let idx        = 0;
  let editOpen   = false;

  const allPhrases = () => [...basePhrases, ...custom];
  const allLangs   = () => [...new Set(allPhrases().map(p => p.lang))];
  const filtered   = () => allPhrases().filter(p => p.lang === activeLang);

  activeLang = allLangs()[0] || null;

  function rebuildLangTabs() {
    const langs = allLangs();
    const tabs  = container.querySelector('#phrase-lang-tabs');
    tabs.innerHTML = langs.map(l =>
      `<button class="phrase-lang-tab${l === activeLang ? ' active' : ''}" data-lang="${l}">${l}</button>`,
    ).join('');
    tabs.querySelectorAll('.phrase-lang-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.querySelectorAll('.phrase-lang-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeLang = btn.dataset.lang;
        idx = 0;
        render();
      });
    });
    const sel = container.querySelector('#phrase-new-lang');
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = langs.map(l => `<option value="${l}">${l}</option>`).join('') + '<option value="__new__">+ Új nyelv…</option>';
      if (langs.includes(cur)) sel.value = cur;
    }
  }

  function renderCustomList() {
    const list = container.querySelector('#phrase-custom-list');
    if (!list) return;
    if (!custom.length) {
      list.innerHTML = '<div style="color:#556;font-size:12px;padding:6px 0">Még nincs saját kifejezés.</div>';
      return;
    }
    list.innerHTML = custom.map((p, i) =>
      `<div class="phrase-list-item">
        <span class="phrase-list-src">${p.source}</span>
        <span class="phrase-list-tgt">${p.target}</span>
        <span class="phrase-list-tag">${p.lang}</span>
        <button class="phrase-del-btn" data-i="${i}" title="Törlés">✕</button>
      </div>`,
    ).join('');
    list.querySelectorAll('.phrase-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        custom.splice(Number(btn.dataset.i), 1);
        saveCustomPhrases(custom);
        if (idx >= filtered().length) idx = Math.max(0, filtered().length - 1);
        rebuildLangTabs(); renderCustomList(); render();
      });
    });
  }

  function render() {
    const list = filtered();
    if (!list.length) {
      container.querySelector('#phrase-src').textContent = '—';
      container.querySelector('#phrase-tgt').textContent = '';
      container.querySelector('#phrase-counter').textContent = '0 / 0';
      container.querySelector('#phrase-card').classList.remove('flipped');
      return;
    }
    if (idx >= list.length) idx = 0;
    const p = list[idx];
    container.querySelector('#phrase-src').textContent     = p.source;
    container.querySelector('#phrase-tgt').textContent     = p.target;
    container.querySelector('#phrase-counter').textContent = `${idx + 1} / ${list.length}`;
    container.querySelector('#phrase-card').classList.remove('flipped');
  }

  container.querySelector('#phrase-card').addEventListener('click', () => {
    container.querySelector('#phrase-card').classList.toggle('flipped');
  });
  container.querySelector('#phrase-prev').addEventListener('click', () => {
    const list = filtered(); idx = (idx - 1 + list.length) % list.length; render();
  });
  container.querySelector('#phrase-next').addEventListener('click', () => {
    const list = filtered(); idx = (idx + 1) % list.length; render();
  });
  container.querySelector('#phrase-edit-toggle').addEventListener('click', () => {
    editOpen = !editOpen;
    container.querySelector('#phrase-editor').classList.toggle('open', editOpen);
    container.querySelector('#phrase-edit-toggle').classList.toggle('active', editOpen);
    if (editOpen) renderCustomList();
  });
  container.querySelector('#phrase-new-lang').addEventListener('change', e => {
    container.querySelector('#phrase-new-lang-row').style.display = e.target.value === '__new__' ? '' : 'none';
  });
  container.querySelector('#phrase-add-btn').addEventListener('click', () => {
    const sel = container.querySelector('#phrase-new-lang');
    let lang  = sel.value;
    if (lang === '__new__') {
      lang = container.querySelector('#phrase-new-lang-name').value.trim();
      if (!lang) return;
      container.querySelector('#phrase-new-lang-name').value = '';
      container.querySelector('#phrase-new-lang-row').style.display = 'none';
    }
    const src = container.querySelector('#phrase-new-src').value.trim();
    const tgt = container.querySelector('#phrase-new-tgt').value.trim();
    if (!src || !tgt) return;
    custom.push({ lang, source: src, target: tgt });
    saveCustomPhrases(custom);
    container.querySelector('#phrase-new-src').value = '';
    container.querySelector('#phrase-new-tgt').value = '';
    if (!allLangs().includes(activeLang)) activeLang = lang;
    rebuildLangTabs(); renderCustomList();
    idx = filtered().length - 1;
    render();
  });

  rebuildLangTabs();
  render();
}

function markdownBold(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// ── Wiki open / search ────────────────────────────────────────────────────

export function openWiki(subjectKey, scrollHeading) {
  document.getElementById('wiki-overlay').classList.remove('hidden');
  if (!WIKI_DATA) {
    document.getElementById('wiki-subject-view').innerHTML = '<p style="color:#556;padding:20px">Betöltés…</p>';
    fetch('wiki.json').then(r => r.json()).then(d => {
      WIKI_DATA = d; buildWikiNav(); openWiki(subjectKey, scrollHeading);
    });
    return;
  }
  buildWikiNav();
  if (subjectKey && WIKI_DATA && WIKI_DATA[subjectKey]) {
    showWikiSubject(subjectKey);
    if (scrollHeading) {
      setTimeout(() => {
        const articles = document.querySelectorAll('.wiki-article h4');
        for (const el of articles) {
          if (el.textContent.includes(scrollHeading)) {
            el.closest('.wiki-article').scrollIntoView({ behavior:'smooth', block:'start' });
            el.closest('.wiki-article').style.outline = '1px solid #4a7aff';
            setTimeout(() => { el.closest('.wiki-article').style.outline = ''; }, 2000);
            break;
          }
        }
      }, 80);
    }
  } else if (WIKI_DATA) {
    showWikiSubject(Object.keys(WIKI_DATA)[0]);
  }
}

export function wikiSearch(query) {
  if (!WIKI_DATA || !query.trim()) {
    document.getElementById('wiki-search-results').style.display = 'none';
    document.getElementById('wiki-no-results').style.display     = 'none';
    document.getElementById('wiki-subject-view').style.display   = '';
    return;
  }
  const q       = query.toLowerCase();
  const results = [];
  for (const [sk, sv] of Object.entries(WIKI_DATA)) {
    if (sv.summary.toLowerCase().includes(q) || sv.title.toLowerCase().includes(q)) {
      results.push({ subj:sk, icon:sv.icon, heading:sv.title, snippet:sv.summary.slice(0, 120) + '…' });
    }
    for (const a of sv.articles) {
      const bodyLow  = a.body.toLowerCase();
      const headLow  = a.heading.toLowerCase();
      const kwMatch  = (a.keywords || []).some(kw => kw.toLowerCase().includes(q) || q.includes(kw.toLowerCase()));
      if (headLow.includes(q) || bodyLow.includes(q) || kwMatch) {
        const ai      = bodyLow.indexOf(q);
        const snippet = ai >= 0 ? '…' + a.body.slice(Math.max(0, ai - 30), ai + 80).replace(/\*\*/g, '') + '…' : a.body.slice(0, 100) + '…';
        results.push({ subj:sk, icon:sv.icon, heading:a.heading, snippet });
      }
    }
  }
  document.getElementById('wiki-subject-view').style.display = 'none';
  const resDiv = document.getElementById('wiki-search-results');
  const noRes  = document.getElementById('wiki-no-results');
  if (!results.length) {
    resDiv.style.display = 'none'; noRes.style.display = '';
    return;
  }
  noRes.style.display  = 'none';
  resDiv.style.display = '';
  resDiv.innerHTML = `<p style="font-size:12px;color:#556;margin:0 0 12px">Találatok: ${results.length}</p>` +
    results.map(r =>
      `<div class="wiki-result-item" data-subj="${r.subj}" data-heading="${r.heading}">
        <div class="wiki-result-subj">${r.icon} ${WIKI_DATA[r.subj].title}</div>
        <div class="wiki-result-heading">${r.heading}</div>
        <div class="wiki-result-snippet">${r.snippet}</div>
      </div>`,
    ).join('');
  resDiv.querySelectorAll('.wiki-result-item').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById('wiki-search').value = '';
      showWikiSubject(el.dataset.subj);
      setTimeout(() => {
        const articles = document.querySelectorAll('.wiki-article h4');
        for (const a of articles) {
          if (a.textContent === el.dataset.heading) {
            a.closest('.wiki-article').scrollIntoView({ behavior:'smooth', block:'start' });
            a.closest('.wiki-article').style.outline = '1px solid #4a7aff';
            setTimeout(() => { a.closest('.wiki-article').style.outline = ''; }, 2000);
            break;
          }
        }
      }, 80);
    });
  });
}

function findWikiForQuestion(subjectId, prompt) {
  if (!WIKI_DATA || !subjectId) return null;
  const sv = WIKI_DATA[subjectId]; if (!sv) return null;
  const pLow = prompt.toLowerCase();
  let best = null, bestScore = 0;
  for (const a of sv.articles) {
    let score = 0;
    for (const kw of (a.keywords || [])) {
      if (pLow.includes(kw.toLowerCase())) score += 2;
    }
    if (a.body.toLowerCase().split(' ').some(w => w.length > 4 && pLow.includes(w))) score++;
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return best;
}

export function setWikiBtn(subjectId, prompt) {
  const btn = document.getElementById('wiki-btn');
  if (!btn) return;
  if (!WIKI_DATA || !subjectId) { btn.style.display = 'none'; return; }
  const wikiKey = SUBJ_MAP[subjectId] || subjectId.toLowerCase();
  if (!WIKI_DATA[wikiKey]) { btn.style.display = 'none'; return; }
  btn.style.display = '';
  btn.onclick = () => {
    const art = findWikiForQuestion(wikiKey, prompt || '');
    openWiki(wikiKey, art?.heading);
  };
}
