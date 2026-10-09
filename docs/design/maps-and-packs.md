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
  Az `adj` a **provincia-szomszédság gráf** — ez a stratégiai mozgás/terjeszkedés
  alapja. A core `RegionGraph` (determinista provincia-gráf: birtoklás,
  budget-alapú sereg-mozgás, útkeresés, tudásközpont a régióban, save/load) ezt
  olvassa; a prezentáció `buildRegionGraph(pack)` függvénye a `map.json`-ból
  építi fel. A **csaták** továbbra is a hex-rétegen (`HexMap` + `simulateBattle`)
  zajlanak — a régió-gráf csak azt tartja nyilván, ki mit birtokol, mi szomszédos,
  és meddig/merre jut el egy sereg.

A választó a `web/world/packs.json`-ből épül; a `web/region-demo.html` futásidőben
vált köztük.

## Két csomag

### 1. Fantáziavilág (`fantasy`) — **MIT**
Saját, determinista, seedelt Voronoi-kontinens. Nincs valós földrajz →
**nincsenek hősök/felfedezők** (`supportsHeroes: false`), mert azoknak valós
szülőhely adna értelmet.
Generálás: `node art/worldgen/gen-world.mjs web/world/fantasy`

### 2. Európa — NUTS 1 (`europe`) — **valós geometria, külön licenc**
Valós Európa. **Szabály: EU-tagok → NUTS 1 nagyrégiók; a nem-EU európai
országok → egy-egy ország = egy régió.** Mivel valós a földrajz, **a
hősök/felfedezők itt aktívak** (`supportsHeroes: true`): a tudósok valós
szülőhelye a régióhoz (NUTS 1, illetve nem-EU esetén országhoz) rendelhető.

Forrás: hivatalos Eurostat NUTS 2024, level 1 (GISCO).

Generálás (lokálisan, a letöltött GeoJSON-okból):
```bash
# EU NUTS 1 régiók + (opcionálisan) a nem-EU országok határai:
node art/worldgen/nuts1-to-pack.mjs \
  NUTS_RG_20M_2021_4326_LEVL_1.geojson web/world/europe \
  CNTR_RG_20M_2021_4326.geojson
```
A konverter kiszűri a nem-európai országokat, az EU-tagokat a NUTS 1 fedi, a
nem-EU európai országok (NO, CH, UK, RS, BA, ME, MK, AL, XK, MD, UA, BY, IS,
LI, TR, …) egy-egy régióként kerülnek be. A provincia-rekord `level` mezője
`"nuts1"` vagy `"country"`.

> **Licenc-határ (fontos):** a határok **nem** a mi assetünk.
> Administrative boundaries: **© EuroGeographics © OpenStreetMap contributors
> © Turkstat**; Cartography: **Eurostat — GISCO**. A GISCO NUTS szabadon
> használható **forrásmegjelöléssel**; OSM-ből **ODbL** (forrásmegjelölés +
> share-alike az adatbázisra). A **motor marad MIT**; az Európa-csomag a
> licencét/attribúcióját a `map.json.meta`-ban hordozza, és a demó ki is írja.

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
