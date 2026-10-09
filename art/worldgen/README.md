# Worldgen — régió-térkép csomagok

Két generátor, közös csomag-sémával (lásd `docs/design/maps-and-packs.md`):

- **`gen-world.mjs`** — determinista, seedelt Voronoi *fantáziavilág* (MIT):
  provinciák + 9 frakció + fővárosok + szomszédság-gráf. Nincs valós földrajz,
  ezért `supportsHeroes:false`.
- **`nuts1-to-pack.mjs`** — valós *Európa (NUTS 1)* csomag egy letöltött
  GeoJSON-ból (dep nélküli, tiszta Node). Valós földrajz → `supportsHeroes:true`.
  A geometria **nem MIT**: © EuroGeographics (GISCO) / OSM (ODbL) — a csomag a
  `map.json.meta`-ban hordozza a licencet/attribúciót.
  Futtatás (lokálisan, mert a felhő webelérése korlátozott):
  `node art/worldgen/nuts1-to-pack.mjs <nuts1.geojson> web/world/europe`

Az alábbi a `gen-world.mjs` (fantázia) részletei.

## Kimenet
- `web/world/map.svg` — geometria (provincia-path-ok, semleges kitöltés,
  szürke határ; a színezés a web-rétegben, adatból történik).
- `web/world/map.json` — `{ viewBox, seed, factions[], provinces[] }`, ahol
  minden provincia: `{ id, name, cx, cy, faction, capital, adj[] }`.
  Az `adj` a stratégiai mozgás/terjeszkedés szomszédsági gráfja.

## Újragenerálás (lokálisan)
```bash
npm i d3-delaunay          # csak a generáláshoz kell, nem futásidejű függőség
node art/worldgen/gen-world.mjs web/world/fantasy
```
Ugyanaz a `SEED` ugyanazt a térképet adja. A sűrűség a `STEP` konstanssal
állítható (nagyobb = kevesebb, nagyobb provincia).

> Megjegyzés: a frakciók provincia-száma jelenleg egyenetlen (a legtávolabbi-pont
> fővárosválasztás + legközelebbi-főváros hozzárendelés miatt). Balanszhoz
> később súlyozott/kapacitásos hozzárendelés tehető be.
