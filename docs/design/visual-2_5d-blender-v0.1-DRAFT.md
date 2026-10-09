# Vizuális irány — 2,5D alternatív-Európa térkép Blenderrel (v0.1)

> **Státusz: HYPOTHESIS / FEASIBILITY — NON-BINDING.** Vizuális pipeline-vizsgálat,
> nem végleges döntés és nem a játékmotor része. **Dátum:** 2026-10-09.

## Cél

A hexrácsos, alternatív-Európa térkép **2,5D** (ferde, mélységérzetes, de nem
valós 3D) kinézetének elérése. Vizsgálat: megoldható-e **Blenderrel**.

## Verdikt

**Igen** — a legjobb illeszkedés, ha a **Blender nem a motor, hanem
asset-pipeline**: 3D csempéket/helyszíneket renderelünk **fix, ferde
ortográf kamerával** lapos PNG-sprite-okká (a klasszikus Heroes/2.5D trükk). A
determinista TS-core és a hexrács változatlan marad; a sprite-okat a cserélhető
prezentációs réteg rajzolja ki. Ez összhangban van a D-STACK döntéssel
(„TS core + cserélhető prezentáció").

## Két fő opció

| | A) Előre renderelt ortográf sprite-ok (javasolt) | B) Valós 3D futásidőben |
| --- | --- | --- |
| Motor | marad TS 2D + hexrács | 3D web-motor (Three.js/Babylon) kell |
| Blender szerepe | asset-gyár (render → PNG atlasz) | csak modellezés, futásidő máshol |
| Mélységérzet | besütött fény/árnyék, ferde kamera | valódi kamera/megvilágítás |
| Determinizmus/teszt | érintetlen (core tiszta) | a renderelés nehezebben tesztelhető |
| Költség/kockázat | alacsony, inkrementális | nagy architektúra-váltás |
| Döntés | **ezzel megyünk** | később, ha valódi 3D kell |

## Pipeline (A opció)

1. **Modellezés:** szabályos hex-csempe (pointy-top, 6 szomszéd — illeszkedik az
   axiális modellhez) + opcionális magasítás (displacement heightmapből az
   „Európa"-domborzathoz) + helyszín-placeholderek (város/egyetem/labor/erőd…).
2. **Kamera:** **ortográf**, ~30–45° dőlés (alap: 35°). Ortográf → nincs
   perspektív torzítás → a csempék hézagmentesen tesszellálnak.
3. **Render:** átlátszó háttér (film transparent), PNG RGBA, batch `bpy`-ból.
4. **Atlasz:** a sprite-okat egy textúra-atlaszba csomagoljuk.
5. **Vetítés a játékban:** axiális (q,r) → képernyő-pixel, függőleges eltolással
   a 2,5D mélységhez (a sprite-ok fentről-lefelé, hátulról-előre rajzolva).

## Döntési pontok (nyitott)

| ID | Kérdés | Alap / javaslat |
| --- | --- | --- |
| V1 | Sprite felbontás | 256 px/csempe (retina: 512) |
| V2 | Kameraszög (dőlés) | 35° (HoMM-közeli); 30–45° próbálandó |
| V3 | Hex-orientáció | pointy-top (a 6-szomszéd modellhez) |
| V4 | Csempe-magasítás | enyhe (0.3–0.4) a 2,5D peremhez; 0 = lapos |
| V5 | Renderelő | EEVEE (gyors, elég a stilizált nézethez) vs. Cycles (szebb, lassú) |
| V6 | „Európa" domborzat | heightmap-displacement vs. kézi modellezés |
| V7 | Atlasz-formátum | egyszerű rács-atlasz + JSON-index |

## Proof — `bpy` starter-szkript

`art/blender/hex_tile_render.py` — létrehoz egy hex-csempét, beállít egy ferde
ortográf kamerát + napfényt, és kirenderel egy átlátszó PNG-sprite-ot.
**A felhő-munkamenetből nem futtatható** (nincs Blender); a te gépeden:

```
"C:\Blender 5.2\blender.exe" -b -P art\blender\hex_tile_render.py -- --out art\tiles --size 256 --tilt 35
```

A kimenet egy `art/tiles/hex.png` — ez a feasibility-proof a 2,5D nézethez. A
`--tilt`, `--height`, `--size` kísérletezéshez állítható.

## Mi marad a prezentációs rétegnek (külön, jövőbeli iteráció)

- sprite-atlasz betöltése és hex→képernyő vetítés egy web-canvas rendererben
  (a jelenlegi ASCII `renderWorldMap` helyére/mellé),
- rajzolási sorrend (mélység), hős/egység-sprite-ok ráhelyezése,
- interakció (kijelölés, mozgás-highlight) — ez nem a Blender dolga.

## Integrációs elv

A Blender-output **tartalom** (`art/`), nem a motor. A core determinista és
tesztelt marad; a vizuális réteg cseréje nem érinti a `packages/core`-t. A
nevek/alak fiktív „alternatív Európa" — nem a valós politikai térkép.

---

*Krista `vibekód-fejlesztés` · feasibility-vizsgálat · a renderelést a felhasználó
futtatja a saját gépén; a felhő-munkamenet Blendert nem futtat. DRAFT.*
