# Gazdasági modell — token vs. stabilitás egyesítése (v0.1)

> **Státusz: DRAFT / REVIEW_REQUIRED.** Tervdokumentum, nem kód (PLAN_ONLY).
> Feloldja a `VISION-hypothesis.md`-ben jelzett **token-vs-stabilitás** feszültséget,
> és (szükség szerint) finomítja a D-FLOW döntést.
> **Dátum:** 2026-10-07.

## 0. Vezérelv (nem alku tárgya)

**A tudás a gazdaság.** Ez egy játékosított oktatóprogram: a tudás nem külső jutalom,
hanem a játékvilág alap-erőforrása. **Alapértelmezett módban nincs klasszikus
nyersanyag** (arany/fa/érc). A klasszikus gazdaság kizárólag opcionális **„hard
módként"** adható hozzá (lásd 5.). Minden alábbi döntés ennek alárendelt.

## 1. A feszültség

Két, eddig külön tárgyalt „gazdaság" él a tervekben:

| Modell | Honnan | Mit csinál |
| --- | --- | --- |
| **Aszinkron teszt-token** (MVP, D-FLOW) | stratégiai fázis termeli | a tanulásba való belépés pénzneme; flow-védelem (batch-elhető) |
| **Tudásközpont-stabilitás** (vízió) | birtokolt központok | fenntartási dimenzió; helyes válasz ↑, hibás ↓, 0 → lázadás → utánpótlás elvág |

A kérdés nem „melyiket", hanem **hogyan egy rendszer**. Javaslat: ne két gazdaság
legyen, hanem **egyetlen tudás-szubsztancia három szerepben**.

## 2. Az egyesített modell: egy szubsztancia, három szerep

```
            ┌───────────────────────────────────────────────┐
            │              TUDÁS (a szubsztancia)             │
            └───────────────────────────────────────────────┘
               │                  │                    │
       ┌───────▼──────┐   ┌───────▼───────┐   ┌────────▼────────┐
       │ TESZT-TOKEN  │   │  KK (kredit)  │   │   STABILITÁS    │
       │ (figyelem /  │   │ (tudástőke,   │   │ (fenntartás,    │
       │  belépő)     │   │  tárgyanként) │   │  központonként) │
       └──────────────┘   └───────────────┘   └─────────────────┘
        pacing/flow         tech + egység        birtok egészsége
```

- **Teszt-token** — a *figyelem/lehetőség* pénzneme. Megmondja, *mennyit* tud a
  játékos tanulásba fektetni egy adott idő alatt; batch-elhető → flow-védelem.
  **Újrakeretezés:** a tokent nem generikus épület, hanem **tudásközpontok termelik**,
  és a termelés mértéke a központ **stabilitásával skálázódik**. Ez a lépés köti össze
  a két modellt.
- **KK (Kognitív Kredit)** — a *tudástőke*, tárgyanként. Erre költ a játékos:
  tech-fa, egységfejlesztés, terület/artifact megszerzése.
- **Stabilitás** — a birtokolt tudásközpont *egészsége*. Helyes válasz ↑, hibás ↓.
  A stabilitás határozza meg a központ **kibocsátását** (token + egység-utánpótlás
  minősége/mennyisége). Nulla stabilitás → **lázadás**: nincs visszamenőleges
  büntetés (a meglévő egységek maradnak), de a központ token- és utánpótlás-
  kibocsátása **elvág**.

### 2.1 Az egyesített hurok

```
tudásközpont birtoklása
      │
      ▼
időszakos teszt-ablak  ──(helyes)──►  stabilitás ↑  ──►  token + KK kibocsátás ↑
      │                                     │
   (hibás)                                  ▼
      ▼                               erősebb egység-utánpótlás
 stabilitás ↓ ─(0)─► lázadás ─► token/utánpótlás elvág (meglévő megmarad)
```

A token tehát **nem független forrás**, hanem a stabilitás *kifolyása*. A KK a
sikeres tesztek *terméke*. Így a három szerep egyetlen, önszabályozó rendszer.

## 3. A tudás kiváltja a gazdaságot — konkrétan

A klasszikus 4X-gazdaság három funkciót lát el; mindegyiket **tudás-mechanika
váltja ki**:

| Klasszikus funkció | Klasszikus eszköz | Tudás-kiváltás (alapmód) |
| --- | --- | --- |
| **Hozzáférés** (mit építhetsz) | nyersanyag-küszöb | KK-küszöb + tudásközpont birtoklása |
| **Minőség** (mennyire erős) | fejlettebb épület | tárgy-KK szint + stabilitás |
| **Mennyiség / logisztika** (hány egység, utánpótlás) | arany/upkeep | stabilitás-vezérelt utánpótlás |
| **Terjeszkedés korlátja** | nyersanyaghiány | tudás-korlát (háromkérdéses foglalás) |

Nincs tehát „üres" gazdasági grind: minden erőforrás-mozzanat mögött tudás-
visszacsatolás áll.

## 4. Flow-védelem az egyesített modellben

- **Rövid, időzített érintés:** a tudásközpontok fenntartási kérdése rövid, kör-
  léptékű esemény (nem szakítja meg a taktikai harcot — az izolált marad).
- **Batch-elhető mélymerülés:** a teszt-token puffer (G2-sapka, kamat nélkül)
  engedi, hogy a játékos maga válassza meg, mikor merül el hosszabb tanulásban.
- **Háromkérdéses, időablakos foglalás** (vízió §11): a megszerzés külön,
  feszes esemény — nem keverendő a fenntartási ciklussal.

A három mechanika három eltérő ritmusú tanulási érintés; együtt adják a flow-t,
nem törik meg.

## 5. Hard mód — opcionális klasszikus gazdaság (réteg, nem csere)

Hard módban egy **párhuzamos erőforrás-réteg** kapcsolható be, amely **nem váltja
ki**, hanem **kiegészíti** a tudás-gazdaságot:

- Új, klasszikus erőforrás (munkanév: **Ellátmány**), amely egység-upkeephez,
  mozgáshoz vagy építéshez kell.
- **Tudás = hozzáférés/minőség**, **Ellátmány = mennyiség/logisztika**. Egy
  magasan fejlett egységhez *tudás is és* ellátmány is kell.
- Alapmódban az Ellátmány absztrahált (végtelen/auto), így a tanuló játékost nem
  terheli; hard módban valós szűk keresztmetszet a stratégiai mélység kedvéért.

**Elv:** a hard mód sosem teszi a tudást *mellékessé* — a tudás marad a hozzáférés
kapuja; az Ellátmány csak a logisztikai súrlódást adja hozzá.

### 5.1 Nehézségi módok (javaslat)

| Mód | Tudás-gazdaság | Klasszikus gazdaság | Célközönség |
| --- | --- | --- | --- |
| **Tanuló** (alap) | teljes | kikapcsolva (absztrahált) | oktatási fókusz |
| **Stratéga** | teljes | részleges (csak upkeep) | vegyes |
| **Hard** | teljes | teljes (Ellátmány + logisztika) | 4X-veteránok |

A mód nem érinti a kérdések tartalmát vagy az adaptivitást — csak a gazdasági
súrlódást.

## 6. Adatmodell-hatás (a jelenlegi core-ra vetítve)

A meglévő modulokra építve, minimális töréssel:

| Jelenlegi | Változás |
| --- | --- |
| `TokenLedger` | marad; a *forrása* változik: tudásközpont-stabilitásból termel (nem generikus épületből) |
| `KKLedger` | változatlan (tárgyankénti tőke) |
| *(új)* `KnowledgeCenter` | id, tárgy, `stability` (0..max), kibocsátási függvény(stability) → token/utánpótlás |
| *(új)* `StabilityLedger` vagy a központ saját állapota | append-only stabilitás-események, determinista |
| `TestSession` | kiegészül: a teszt eredménye a központ stabilitását is módosítja (nem csak KK/θ) |
| `Game` | a kör-végi `endTurn` a központok stabilitásából termel tokent; lázadás-ellenőrzés |
| *(új, opcionális)* `SupplyLedger` | csak hard módban aktív; upkeep-elszámolás |

A determinizmus- és mentés-invariánsok (seedelt RNG, save/load) változatlanul
érvényben maradnak; az új állapotok ugyanúgy szerializálandók.

## 7. D-FLOW finomítás

A korábbi D-FLOW (aszinkron teszt-token) **érvényben marad**, de **pontosítva**:
a token forrása a tudásközpont-stabilitás, nem egy absztrakt épület. Ez nem
visszavonás, hanem a két modell egyesítése. A kör-végi vs. tisztán aszinkron
kérdés a fenntartási ciklusra szűkül:
- **fenntartási** kérdés: kör-léptékű, rövid (a központ „kéri");
- **mélymerülés**: a játékos indítja, token-pufferből, bármikor.

## 8. Nyitott döntések

| ID | Kérdés | Opciók / javaslat |
| --- | --- | --- |
| E1 | Stabilitás → token kibocsátási függvény | lineáris / lépcsős / küszöbös (javaslat: lépcsős, 3 sáv) |
| E2 | Fenntartási kérdés gyakorisága | minden kör / N körönként / stabilitás-függő (javaslat: stabilitás-függő — alacsony stabilitás gyakoribb kérdés) |
| E3 | Lázadás visszafordítható-e | végleges / visszafoglalható újra-teszteléssel (javaslat: visszaszerezhető) |
| E4 | Hard mód MVP-be? | **nem** — alapmód előbb; hard mód külön, későbbi iteráció |
| E5 | Ellátmány forrása hard módban | térképi pont / központ mellékkibocsátás |
| E6 | A token „figyelem" metaforája explicit-e a UI-ban | rejtett/absztrakt vs. látható számláló |

## 9. Következő lépés

1. Döntsünk **E1–E3**-ban (ezek kellenek az első implementációhoz), és erősítsük
   meg **E4**-et (hard mód ne legyen MVP).
2. Ezután egy **új iteráció** (pl. I8 — tudásközpont + stabilitás): `KnowledgeCenter`,
   stabilitás-állapot, a `TestSession`/`Game` bővítése, teszttel és a lázadás
   negatív tesztjével — CANDIDATE_ONLY, a szokott kapukkal.
3. A hard mód (`SupplyLedger`) külön, későbbi iteráció, kapcsolóval.

---

*Krista `vibekód-fejlesztés` · PLAN_ONLY · nincs kód-mutáció · minden állítás
DRAFT/REVIEW_REQUIRED. A vezérelv — „a tudás a gazdaság" — nem alku tárgya; a
klasszikus gazdaság csak opcionális hard-mód réteg.*
