# Hősök — tudósok és felfedezők (v0.1)

> **Státusz: HYPOTHESIS / NON-BINDING GUIDANCE.** Fejlesztési irány, nem végleges
> spec és nem kód. A Heroes III „hős" szerepét ülteti át **tudós/felfedező**
> alakokra. **Rögzítve:** 2026-10-07. Forrás: felhasználói ötlet.

## Koncepció

A Heroesben hősök vezetik a seregeket; itt **tudósok és felfedezők** töltik be ezt
a szerepet. Minden hős egy diszciplínához (tárgyhoz) kötődik, **Európában ott
toborozható, ahol született** (szülőhely = térképi helyszín), és a hadseregnek
**bónuszt vagy mínuszt** ad:
- **bónusz** a saját tudományterületéhez tartozó egységeknek (és/vagy az
  elért eredményeihez kötődő területen),
- esetleg **mínusz** más (idegen) diszciplínák egységeinek — ami erősíti a
  specializációs döntést.

Ez a GDD „polihisztor vs. specialista" feszültségét mélyíti: egy erős, egytárgyú
hős nagyon megdobja a saját frakcióját, de gyengítheti a vegyes sereget.

## Hogyan illeszkedik a meglévő rendszerekhez

| Új elem | Meglévő rendszer, amire ráül |
| --- | --- |
| Hős tárgy-affinitása (bónusz/mínusz) | `BonusSystem` — minden hatás már `Bonus` adat (ADD/MUL stat), negatív érték = mínusz |
| Szülőhely (toborzás helye) | `WorldLocation` / `LocationType` — a hős egy helyszínhez kötve toborozható |
| Toborzás | a `Recruitment` mintájára: KK- vagy token-költség a hős „felfogadásához" |
| Sereghez rendelés | a `Game` serege (`recruits`) — a vezető hős bónuszai a harcban számítanak |
| Egység tárgya szerinti hatás | `Unit.subject` — a hős a saját tárgyú egységeknek ad bónuszt, máshoz mínuszt |

**Nulla új alaprendszer kell** — a hős egy „bónusz-forrás", amely a sereg
egységeire tárgy szerint szelektíven hat.

## Javasolt adatmodell (vázlat)

```jsonc
Scientist {
  id: "newton",                 // tartalom-id
  name: "Sir Isaac Newton",     // TARTALOM (valós történelmi személy), nem engine
  subject: "FIZIKA",            // fő diszciplína (Dynamis)
  birthplaceLocationId: "...",  // hol toborozható
  cost: { subject: "FIZIKA", kk: N },
  affinities: [                 // tárgyankénti módosítók a vezetett seregre
    { subject: "FIZIKA", bonuses: [ ADD attack +2, MUL defense 1.1 ] },  // saját tárgy: bónusz
    { subject: "*",      bonuses: [ ADD speed -1 ] }                     // idegen: enyhe mínusz
  ]
}
```

A `*` (vagy „other") szabály adja a specializációs mínuszt a nem-egyező tárgyú
egységeknek. A hatás a harc előtt (vagy az effektív statok számításakor) a sereg
minden egységére alkalmazódik a tárgya szerint.

## Valós személyek — tartalmi és IP-megfontolás

- Történelmi tudósok/felfedezők **neve és alapvető, köztudott ténye** szabadon
  használható tartalomként (közkincs). A **motor marad név-agnosztikus**: a nevek,
  életrajzi adatok, szülőhelyek a szkenárió-tartalomból jönnek, nem a kódból.
- **Kerülendő:** kitalált, valótlan állítások valós személyekről; sértő vagy
  félrevezető ábrázolás. A „bónusz/mínusz" játékérték, nem életrajzi ítélet.
- Fiktív/összetett alakok is használhatók, ha a valós-személy-érzékenység ezt
  indokolja.

## Nyitott döntések

| ID | Kérdés | Javaslat |
| --- | --- | --- |
| H1 | Toborzás ára | KK a hős tárgyában (a tudás gazdaság-elvhez hűen) |
| H2 | Egyszerre hány hős vezethet egy sereget? | MVP: 1 vezető hős/sereg |
| H3 | „Elért eredmények területe" bónusz | post-MVP: régió/helyszín-kötött bónusz; MVP: csak tárgy-affinitás |
| H4 | Mínusz idegen tárgyakra kötelező-e | opcionális hősönként (nem minden hős büntet) |
| H5 | Hős fejlődése (szint, θ-hoz kötve?) | post-MVP: a játékos tárgy-θ-ja növelheti a hős bónuszát |
| H6 | Valós vs. fiktív nevek az alap-szkenárióban | fiktív/vegyes alap; valós nevek külön tartalomcsomagban |

## Következő lépés (ha jóváhagyod)

Egy **domain-iteráció** (pl. I22 — `Scientist` hős-modell): a `Scientist` típus +
egy tiszta `applyLeaderBonuses(units, scientist)` segéd (tárgy szerinti bónusz/
mínusz a `BonusSystem`-en át), teljes teszttel. Ezt követné a `Game`-bekötés
(toborzás szülőhelyen, vezető hozzárendelése a sereghez, hatás a `fight`-ban),
save/load-dal — a szokásos CANDIDATE_ONLY kapukkal.

---

*Krista `vibekód-fejlesztés` · PLAN_ONLY · a nevek tartalom; a motor
név-agnosztikus. DRAFT/REVIEW_REQUIRED.*
