# Térkép-csomagok (map packs) — választható világok

A stratégiai réteg térképe **cserélhető csomag**. Minden csomag ugyanazt a
sémát adja, így a web-réteg (és később a core) ugyanúgy kezeli mindet. A
**csaták továbbra is a hex-rétegen** zajlanak — ez csak a stratégiai (kampány)
térkép.

## Csomag-séma

Egy csomag két fájl egy mappában (`web/world/<id>/`):

- `map.svg` — tiszta geometria: `<path class="prov" id="prov_<i>" data-faction="…">`,
  semleges kitöltés, **szürke** határ (nem fekete), a tenger háttér (nem régió).
- `map.json`:
  ```jsonc
  {
    "meta": { "id", "name", "kind": "fantasy"|"europe",
              "supportsHeroes": bool, "license", "attribution" },
    "viewBox": [0,0,W,H],
    "factions": [ { "id", "name", "color", "subject?" } ],
    "provinces": [ { "id", "name", "cx","cy", "faction", "capital", "adj":[…],
                     "nutsId?","country?" } ]
  }
  ```
  Az `adj` a **provincia-szomszédság gráf** — ez lesz a stratégiai
  mozgás/terjeszkedés alapja (a core `RegionGraph`-ja ezt olvassa majd).

A választó a `web/world/packs.json`-ből épül; a `web/region-demo.html` futásidőben
vált köztük.

## Két csomag

### 1. Fantáziavilág (`fantasy`) — **MIT**
Saját, determinista, seedelt Voronoi-kontinens. Nincs valós földrajz →
**nincsenek hősök/felfedezők** (`supportsHeroes: false`), mert azoknak valós
szülőhely adna értelmet.
Generálás: `node art/worldgen/gen-world.mjs web/world/fantasy`

### 2. Európa — NUTS 1 (`europe`) — **valós geometria, külön licenc**
Valós Európa a NUTS 1 nagyrégiók szerint (~92 régió). Mivel valós a földrajz,
**a hősök/felfedezők itt aktívak** (`supportsHeroes: true`): a tudósok valós
szülőhelye NUTS 1 régióhoz rendelhető.
Generálás (lokálisan, a letöltött GeoJSON-ból):
`node art/worldgen/nuts1-to-pack.mjs <nuts1.geojson> web/world/europe`

> **Licenc-határ (fontos):** a NUTS-határok **nem** a mi assetünk. Eurostat/GISCO
> NUTS geometria: **© EuroGeographics**, szabadon használható **forrásmegjelöléssel**.
> Ha OSM-ből építed: **ODbL** (forrásmegjelölés + share-alike az adatbázisra).
> A **motor marad MIT**; az Európa-csomag a saját licencét/attribúcióját a
> `map.json.meta`-ban hordozza, és a demó ki is írja.

## Miért nem generálható a felhőben az Európa-csomag?

A felhős session kimenő webelérése policy- val korlátozott (csak csomag-registry-k),
így a GISCO/OSM geodata **nem tölthető le itt**. Két út:
1. **Lokálisan**: töltsd le a NUTS 1 GeoJSON-t (pl. GISCO
   `NUTS_RG_20M_2021_4326_LEVL_1.geojson`), futtasd a konvertert, és a kész
   `web/world/europe/` csomag megjelenik a választóban.
2. **Allowlist**: ha a környezet hálózati engedélylistájára felkerül a GISCO
   (vagy egy raw GeoJSON host), a konvertert itt is lefuttatom.

## Hősök ↔ Európa

A hős-rendszer (tudósok/felfedezők) a core-ban már kész. A **térkép-csomag
kapuzza**: `supportsHeroes: true` esetén a hősök toborozhatók a valós
szülőhely-régióban; fantáziavilágban a hős-réteg kikapcsolva.
