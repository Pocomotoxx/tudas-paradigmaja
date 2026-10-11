# A Tudás Paradigmája

Körökre osztott, hexrácsos stratégiai játék (TBS), amelyben a tanulás a primer
hajtóerő: a győzelemhez vezető egyetlen skálázható út a játékos saját kognitív
fejlődése.

> Koncepció-eredet: a hexrácsos TBS-alapötlet a [VCMI](https://vcmi.eu) (GPL-2.0)
> motortól *inspirált*, de ez a projekt **nulla VCMI-kódot és -assetet** tartalmaz —
> kizárólag absztrahált tervezési mintákat ültet át. Ez a projekt **MIT** licencű.

## Gyors indítás

```bash
# Böngészős játék — build nem kell
open web/menu.html          # főmenü (évfolyamsáv, tantárgyak, nehézség beállítása)
open web/region-demo.html   # játék közvetlen megnyitása
```

## Mit tud a játék (implementált rendszerek)

### NAT 2020 tartalomcsomag
- **13 tantárgy:** Magyar, Matematika, Fizika, Kémia, Biológia, Történelem, Földrajz,
  Digitális kultúra, Idegen nyelv, Természettudomány, Állampolgári ismeretek, Etika,
  Hon- és népismeret
- **3 évfolyamsáv:** 1–4, 5–8, 9–12 (585 kérdés — 15/tantárgy/sáv)
- **Wikitár:** 13 tantárgy × 7–10 cikk (alapfogalmak, felfedezők, elvek)
- **Főmenü (`menu.html`):** évfolyamsáv-választó, tantárgy-chips, nehézség, animált
  háttér, beállítások localStorage-ba mentve

### Stratégiai térkép
- **Régió-alapú (Total War-stílusú)** stratégiai térkép (`web/region-demo.html`):
  *Európa — NUTS 1* (valós geometria, Three.js 3D, 116 tartomány)
- **Bot AI:** persona-alapú (agresszív/gazdasági/tudós), diplomácia-rendszer
- **XP/streak rendszer**, épületek, hősök, kampánymód, tanári dashboard (CSV export)
- **Területfoglalás** háromkérdéses, időablakos párbajjal (adaptív nehézség)
- **Hősök:** tudós/felfedező hősök, valós szülőhellyel az Európa-csomagon

### Szabálymotor (`packages/core`)
- Tiszta TypeScript, **determinista, I/O-mentes** (`(GameState, Command, seed) → GameState'`)
- Seedelt RNG · hexrács + útkeresés · fázis-állapotgép · adaptív oktatás (Rasch/IRT)
- Mentés/visszatöltés, Playwright E2E tesztek

## Fájlstruktúra

| Fájl/könyvtár | Leírás |
|---|---|
| `web/menu.html` | Főmenü — beállítások, indítás |
| `web/region-demo.html` | Teljes böngészős játék |
| `web/qbank.json` | Kérdésbank (585 kérdés, schema v1) |
| `web/wiki.json` | Wikitár (13 tantárgy, schema v1) |
| `web/world/europe/` | Európa-térkép adatok (map.json, GeoJSON) |
| `packages/core/` | Determinista szabálymotor (TypeScript) |
| `kerettanterv/` | NAT 2020 kerettanterv DOCX referencia (46 db) |

## Fejlesztés

```bash
npm install
npm test        # vitest — determinizmus-, egység- és integrációs tesztek
npm run build   # tsc típusellenőrzés + fordítás
node packages/presentation/dist/cli.js   # szöveges demó-menet (build után)
```

## Architektúra

`motor = szabály, tartalom = adat, prezentáció = cserélhető réteg.`

- `packages/core` — tiszta TypeScript szabálymotor (nincs DOM, `fetch`, globális RNG)
- `packages/presentation` — *(később)* cserélhető prezentációs réteg a core felett
- `web/src/` — moduláris JS forrás (state.js, bot.js, combat.js, economy.js, heroes.js…)

> Blender 2.5D csempepipeline: `art/blender/` —
> lásd [docs/design/visual-2_5d-blender-v0.1-DRAFT.md](docs/design/visual-2_5d-blender-v0.1-DRAFT.md)

## Licenc

[MIT](./LICENSE)
