// ── Unrest / cascade system ───────────────────────────────────────────────
import {
  gs, UNREST, DIFFICULTIES,
  cascadeEnabled, unrestOf, desertionChance,
} from './state.js';

// Late-bound refs (set by main.js) to avoid circular deps
let renderUnrestOverlay3DFn = () => {};
export function setUnrestRenderFn(fn) { renderUnrestOverlay3DFn = fn; }

export function recordAnswer(sid, correct) {
  if (!cascadeEnabled()) return;
  if (correct) {
    gs.unrestLevel[sid] = Math.max(0, (gs.unrestLevel[sid] || 0) - UNREST.coolStep);
    gs.unrestWrong[sid] = Math.max(0, (gs.unrestWrong[sid] || 0) - 1);
  } else {
    const w = (gs.unrestWrong[sid] || 0) + 1;
    gs.unrestWrong[sid] = w;
    if (w > UNREST.wrongThreshold)
      gs.unrestLevel[sid] = Math.min(UNREST.maxUnrest, (gs.unrestLevel[sid] || 0) + UNREST.unrestStep);
  }
  renderUnrestCard();
  renderUnrestOverlay3DFn();
}

export function resetUnrest(sid) {
  delete gs.unrestWrong[sid];
  delete gs.unrestLevel[sid];
  renderUnrestCard();
  renderUnrestOverlay3DFn();
}

export function renderUnrestCard() {
  const box = document.getElementById('unrest-body');
  if (!box) return;
  if (!gs.DATA?.subjects?.length) {
    box.innerHTML = '<span class="k">Ez a csomag nem tantárgy-térkép.</span>';
    return;
  }
  if (!cascadeEnabled()) {
    box.innerHTML = '<span class="k">Az 1–2. szinten a nyugtalanság nem hat. Válts 3–4. szintre.</span>';
    return;
  }
  box.innerHTML = gs.DATA.subjects.map(s => {
    const u   = unrestOf(s.id);
    const pct = Math.round(desertionChance(s.id) * 100);
    return `<div class="unrest-row${u > 0 ? ' danger' : ''}" data-s="${s.id}">` +
      `<i style="background:${s.color}"></i><span class="name">${s.name}</span>` +
      `<button data-act="correct" title="Helyes válasz">✓</button>` +
      `<button data-act="wrong" title="Rossz válasz">✗</button>` +
      `<button data-act="reset" title="Nullázás">↺</button>` +
      `<span class="pct">${u}/10 · ${pct}%</span></div>`;
  }).join('');
  box.querySelectorAll('.unrest-row').forEach(row => {
    const id = row.dataset.s;
    row.querySelector('[data-act="correct"]').addEventListener('click', () => recordAnswer(id, true));
    row.querySelector('[data-act="wrong"]').addEventListener('click',   () => recordAnswer(id, false));
    row.querySelector('[data-act="reset"]').addEventListener('click',   () => resetUnrest(id));
  });
}
