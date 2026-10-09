# Worldgen — saját kitalált kontinens (régió-térkép)

`gen-world.mjs` egy **determinista, seedelt** Voronoi-kontinenst generál:
provinciák + 9 frakció + fővárosok + provincia-szomszédság gráf. A kimenet
teljesen **saját, generált tartalom (MIT)** — nincs külső térkép-asset és
nincs idegen licenc.

## Kimenet
- `web/world/map.svg` — geometria (provincia-path-ok, semleges kitöltés,
  szürke határ; a színezés a web-rétegben, adatból történik).
- `web/world/map.json` — `{ viewBox, seed, factions[], provinces[] }`, ahol
  minden provincia: `{ id, name, cx, cy, faction, capital, adj[] }`.
  Az `adj` a stratégiai mozgás/terjeszkedés szomszédsági gráfja.

## Újragenerálás (lokálisan)
```bash
npm i d3-delaunay          # csak a generáláshoz kell, nem futásidejű függőség
node art/worldgen/gen-world.mjs web/world
```
Ugyanaz a `SEED` ugyanazt a térképet adja. A sűrűség a `STEP` konstanssal
állítható (nagyobb = kevesebb, nagyobb provincia).

> Megjegyzés: a frakciók provincia-száma jelenleg egyenetlen (a legtávolabbi-pont
> fővárosválasztás + legközelebbi-főváros hozzárendelés miatt). Balanszhoz
> később súlyozott/kapacitásos hozzárendelés tehető be.
