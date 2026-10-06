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

## Fejlesztési állapot

**I0 — váz** (jelen): monorepo-szerkezet, seedelt determinista RNG, és az első
reprodukciós teszt. A további iterációk (hex, gazdaság/fázis, oktatás, egység,
harc, integráció) az MVP-scope dokumentum szerint következnek.

## Fejlesztés

```bash
npm install
npm test        # vitest — determinizmus- és egységtesztek
npm run build   # tsc típusellenőrzés + fordítás
```

## Licenc

[MIT](./LICENSE)
