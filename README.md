# A Tudás Paradigmája

Körökre osztott, hexrácsos stratégiai játék (TBS), amelyben a tanulás a primer
hajtóerő: a győzelemhez vezető egyetlen skálázható út a játékos saját kognitív
fejlődése.

> Koncepció-eredet: a hexrácsos TBS-alapötlet a [VCMI](https://vcmi.eu) (GPL-2.0)
> motortól *inspirált*, de ez a projekt **nulla VCMI-kódot és -assetet** tartalmaz —
> kizárólag absztrahált tervezési mintákat ültet át. Ez a projekt **MIT** licencű.

## Architektúra (dióhéjban)

`motor = szabály, tartalom = adat, prezentáció = cserélhető réteg.`

- `packages/core` — tiszta TypeScript, **determinista, I/O-mentes** szabálymotor
  (nincs DOM, `fetch`, vagy globális `Math.random`). Invariáns:
  `(GameState, Command, seed) → GameState'`.
- `packages/presentation` — *(később)* cserélhető prezentációs réteg a core felett.

## Mit tud a játék (implementált rendszerek)

A teljes vízió magja implementálva, determinista és mentés/visszatöltéssel
(részletek: [docs/STATUS.md](docs/STATUS.md)).

- **Alaprendszer:** seedelt RNG · hexrács + útkeresés · fázis-állapotgép
  (flow-védelem) · adaptív oktatás (Rasch/IRT) · egység + tech + generikus
  bónuszrendszer · seedelt hex-harc · integrált `Game` + save/load · cserélhető
  prezentáció
- **Tudás-gazdaság:** 9 tárgy · tudásközpont-stabilitás + lázadás ·
  stabilitás→token · adaptív fenntartási kérdések · háromkérdéses, időablakos
  területfoglalás
- **Világ:** típusos helyszínek → alternatív-Európa térkép, generált központokkal
- **Hadsereg:** toborzás · 7-fokozatú egységlétra + fejlesztés
- **Hősök:** tudós/felfedező hősök (59-es tartalomcsomag), szülőhelyen toborozva,
  vezetői bónusz/mínusz
- **Haladó:** tárgy-szinergiák · artifactok (capture-kapuval) · hard mód
  (Ellátmány logisztika)
- **Vizuális:** 2.5D Blender csempe-pipeline (`art/blender/`) + web-canvas
  hex-demó (`web/map-demo.html`); **régió-alapú (Total War-stílusú) stratégiai
  térkép** saját kitalált kontinensen (`web/region-demo.html`, `web/world/`) —
  a csaták továbbra is a hex-rétegen zajlanak

## Fejlesztés

```bash
npm install
npm test        # vitest — determinizmus-, egység- és integrációs tesztek
npm run build   # tsc típusellenőrzés + fordítás
node packages/presentation/dist/cli.js   # szöveges demó-menet (build után)
```

A böngészős 2.5D térkép-demó: nyisd meg a `web/map-demo.html`-t (nem kell build).

A 2.5D csempe-sprite-ok Blenderrel (lokálisan) készülnek — lásd
[docs/design/visual-2_5d-blender-v0.1-DRAFT.md](docs/design/visual-2_5d-blender-v0.1-DRAFT.md)
és `art/blender/`.

## Licenc

[MIT](./LICENSE)
