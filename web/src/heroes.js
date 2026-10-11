// ── i78: Hero ability effects ─────────────────────────────────────────────
import { gs } from './state.js';

/** Returns flat array of { eff, hero, provId } for owned regions with hero abilities. */
export function activeHeroEffects() {
  const out = [];
  for (const id of gs.owned) {
    const prov = gs.byId[id];
    if (!prov?.nutsId) continue;
    const heroes = gs.HEROES[prov.nutsId] || [];
    for (const h of heroes) {
      if (h.ability?.effect) out.push({ eff: h.ability.effect, hero: h, provId: id });
    }
  }
  return out;
}

export function heroGoldBonus() {
  let mult = 1;
  for (const { eff } of activeHeroEffects()) {
    if (eff.type === 'gold_bonus' || eff.type === 'gold_kk_bonus') mult += eff.value;
  }
  return mult;
}

export function heroKKBonus() {
  let mult = 1;
  for (const { eff } of activeHeroEffects()) {
    if (eff.type === 'kk_bonus' || eff.type === 'gold_kk_bonus') mult += eff.value;
  }
  return mult;
}

/** Total unrest reduction points per turn for a given subjectId. */
export function heroUnrestReduction(subjectId) {
  let total = 0;
  for (const { eff, provId } of activeHeroEffects()) {
    if (eff.type !== 'unrest_reduce') continue;
    if (eff.scope === 'global') {
      total += eff.value;
    } else {
      const prov = gs.byId[provId];
      if (prov?.subject === subjectId) total += eff.value;
    }
  }
  return total;
}

/** Additive attack bonus (reduces quiz difficulty). */
export function heroAttackBonus() {
  let bonus = 0;
  for (const { eff } of activeHeroEffects()) {
    if (eff.type === 'attack_bonus') bonus += eff.value;
  }
  return bonus;
}

/** Defense bonus from heroes in a given region. */
export function heroDefBonus(regionId) {
  let bonus = 0;
  const prov = gs.byId[regionId];
  if (!prov?.nutsId) return 0;
  const heroes = gs.HEROES[prov.nutsId] || [];
  for (const h of heroes) {
    const eff = h.ability?.effect;
    if (eff?.type === 'defense_bonus') bonus += eff.value;
  }
  return bonus;
}

/** Madách side-effect: +1 unrest in his region each turn. */
export function applyHeroSideEffects() {
  for (const { eff, hero, provId } of activeHeroEffects()) {
    if (hero.id === 'madach') {
      const prov = gs.byId[provId];
      if (prov?.subject) {
        gs.unrestLevel[prov.subject] = Math.min(10, (gs.unrestLevel[prov.subject] || 0) + 1);
      }
    }
  }
}

/** Human-readable summary of active hero bonuses. */
export function heroEffectSummary() {
  const effs = activeHeroEffects();
  if (!effs.length) return '';
  return effs.map(({ eff, hero }) => `⚡ <b>${hero.name}</b>: ${eff.desc}`).join('<br>');
}
