# Állapotjelentés — A Tudás Paradigmája

> Élő összefoglaló a projekt felépítéséről és az implementált rendszerekről.
> Frissítve: 2026-10-09. Tesztek: **222 zöld**, `tsc` build tiszta.

## Felépítés

Monorepo (npm workspaces, TypeScript project references, Vitest):

- `packages/core` — **determinista, I/O-mentes** szabálymotor (nincs DOM/fetch/
  globális random). Invariáns: `(GameState, Command, seed) → GameState'`.
- `packages/presentation` — cserélhető prezentáció a core publikus API-ja felett
  (jelenleg szöveges/ASCII renderer + web-canvas hex-vetítés).
- `art/blender` — 2.5D csempe-render pipeline (`bpy` szkriptek, lokálisan futnak).
- `web/map-demo.html` — önálló, build nélküli 2.5D hex-demó.
- `web/region-demo.html` + `web/world/` — régió-alapú (Total War-stílusú)
  stratégiai térkép **saját kitalált kontinensen** (seedelt Voronoi-provinciák,
  9 frakció, szomszédság-gráf); a csaták a hex-rétegen maradnak.
- `art/worldgen/` — a régió-térkép determinista generátora (`gen-world.mjs`).
- `docs/design` — tervdokumentumok (GDD, architektúra, gazdaság, frakciók, hősök,
  2.5D vizuális irány).

## Implementált rendszerek (modulonként)

| Terület | Modul(ok) | Mit ad |
| --- | --- | --- |
| RNG | `rng/SeededRng` | seedelt, reprodukálható véletlen, state-mentéssel |
| Hex | `hex/Hex`, `hex/HexMap` | axiális hex, MP-költség, akadály, determinista útkeresés |
| Fázis | `phase/GamePhase` | STRATEGIC/ACADEMIC/TACTICAL, flow-védelem (teszt csak ACADEMIC) |
| Gazdaság | `economy/TokenLedger`, `KKLedger`, `SupplyLedger` | teszt-token (G2-sapka), tárgyankénti KK, hard-mód ellátmány |
| Oktatás | `education/RaschEstimator`, `QuestionBank`, `TestSession` | adaptív θ (1PL), adatvezérelt kérdésbank, teszt-ciklus (G3) |
| Egység | `units/BonusSystem`, `Unit`, `TechTree`, `Recruitment`, `UnitLadder` | generikus bónuszok, tech-fa, toborzás, 7-fokozatú létra+fejlesztés |
| Harc | `combat/Battle` | seedelt hex-csata, iniciatíva, győzelmi feltétel |
| Tudásközpont | `knowledge/KnowledgeCenter` | stabilitás-sávok, lépcsős kibocsátás, lázadás+visszaszerzés |
| Foglalás | `capture/CaptureGate` | háromkérdéses, időablakos megszerzés (injektált idő) |
| Világ | `world/LocationType` | típusos helyszínek → tudásközpont-leképezés |
| Szinergia | `synergy/SynergyRegistry` | tárgy-kombinációk, mesterszint-kapu, sereg-bónusz |
| Artifact | `artifacts/Artifact` | stratégiai tárgyak (közvetlen vagy capture-kapu), sereg-bónusz |
| Hős | `heroes/Scientist` | diszciplína-affinitás (bónusz/mínusz), vezető a seregen |
| Integráció | `game/Game`, `game/Scenario` | mindezt egy hurokba fűzi + teljes save/load (v2) |

Prezentáció: `TextRenderer`, `ScriptedSession`, `demoScenario*`, `europe*`,
`scientistsPack` (59 tudós), `hexProjection` (web 2.5D).

## Fő hurok

Felfedezés → (3-kérdéses) foglalás → tudásközpont birtoklása → fenntartási
kérdések (stabilitás↔token) → KK → tech/toborzás/fejlesztés/szinergia/artifact/
hős → harc → terjeszkedés. Hard módban mindezt az Ellátmány-logisztika egészíti ki.

## Determinizmus és mentés

Minden core-művelet determinista (seedelt RNG, injektált idő a capture-nál). A
teljes játékállapot szerializálható (`Game.save()/load()`, `version: 2`), és a
betöltött játék azonosan folytatódik.

## Futtatás

```
npm install && npm test && npm run build
node packages/presentation/dist/cli.js      # szöveges demó
```
Böngészős 2.5D térkép: `web/map-demo.html` (dupla katt). Csempe-sprite-ok:
`art/blender/*.py` Blenderben (lokálisan).

## Nyitott irányok / következő lépések

- **Vizuál:** a Blender-sprite-ok bekötése a web-renderbe (atlasz → canvas);
  animáció/interakció (kijelölés, mozgás-highlight).
- **Tartalom:** RAG-alapú egyedi kérdésbank (forrás-validációval) — post-MVP terv.
- **Balansz:** hősök/szinergiák/egységlétra számértékeinek hangolása.
- **Repó-rend:** a bemergelt feature-ágak (`i8`…`i31`) és a `design-*` ágak
  törlése a GitHub-felületen (a session git-hozzáférése a ref-törlést 403-mal
  tiltja; a `main`-en minden történet megvan).

## Megjegyzés a licenc-határról

A hexrácsos TBS-alapötlet a VCMI-től (GPL-2.0) *inspirált*; a projekt **nulla
VCMI-kódot/assetet** tartalmaz, kizárólag absztrahált mintákat. A projekt **MIT**.
A valós tudós-nevek/szülőhelyek **tartalomként** szerepelnek; a motor
név-agnosztikus, és nem tartalmaz kitalált életrajzi állításokat.
