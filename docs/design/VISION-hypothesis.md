# A Tudás Paradigmája — Fejlesztési irány-hipotézis

> **Státusz: HYPOTHESIS / NON-BINDING GUIDANCE.** Ez nem szigorú specifikáció és
> nem felülírja a lezárt döntéseket (D-STACK, D-FLOW, G1–G3) vagy a futó MVP-scope-ot.
> Fejlesztési *iránymutatás*: egy tágabb vízió, amelyből az iterációk mentén
> szabadon válogatunk. Amikor egy itteni elem konkrét fejlesztéssé érik, külön
> döntésként és (szükség esetén) scope-módosításként rögzítjük.
> **Rögzítve:** 2026-10-06. Forrás: felhasználói koncepcióleírás.

---

## Szoftverkoncepció

A „Tudás Paradigmája" egy körökre osztott, hexagonális rácson játszódó stratégiai játék, amely a klasszikus Heroes-szerű 4X és taktikai stratégiai mechanikákat adaptív tanulási rendszerrel kapcsolja össze. A játék alapvető innovációja, hogy a játékos katonai, gazdasági és területi fejlődése közvetlenül a megszerzett és bizonyított tudáshoz kapcsolódik.

A játék nem egy klasszikus fantasy világban játszódik. A világtérkép egy alternatív Európát jelenít meg, amely felismerhető földrajzi és kulturális motívumokra épül, de nem a jelenlegi politikai térképet másolja. A kontinens történelmi, földrajzi és kulturális sajátosságai alternatív fejlődési pályát kaptak. Egyes területek más civilizációs központokká váltak, bizonyos városok és régiók más szerepet töltenek be, és a játékosok által elfoglalt területek egy olyan Európában helyezkednek el, amely egyszerre ismerős és fiktív.

A cél nem pusztán az ellenfél katonai megsemmisítése. A játékosnak tudásközpontokat kell megszereznie, ezeket fenn kell tartania, fejlesztenie kell a hozzájuk kapcsolódó tudásterületeket, és ezekből kell olyan hadsereget felépítenie, amely képes az alternatív Európa meghódítására.

## 1. Alapmechanika

A játék körökre osztott stratégiai rendszerben működik. A játékos egy hőssel, hadsereggel vagy hadseregcsoporttal mozog a hexagonális világtérképen.

A klasszikus stratégiai játékok arany-, fa-, érckészletei és egyéb nyersanyagai helyett a fejlődés központi erőforrása a tudás.

A játékos különböző tudásterületeken szerezhet és fejleszthet tudáspontokat. Ezek nem egyszerű pontszámok, hanem a játékban működő stratégiai erőforrások. Meghatározzák például az adott egység fejlettségi szintjét, harci képességeit, speciális képességeit és bizonyos technológiák hozzáférhetőségét.

A rendszer így két párhuzamos fejlődési görbét hoz létre. Az egyik a játékos stratégiai fejlődése (területfoglalás, hadseregépítés, erőforrás-menedzsment). A másik a játékos tényleges tudásfejlődése (kérdések megválaszolása, oktatási tartalmak feldolgozása). A kettő egymást erősíti.

## 2. Alternatív Európa

A világtérkép nem fantasy kontinens, hanem egy alternatív történelmi-földrajzi Európa. Megjelenhetnek nagyvárosok, erődítmények, tudományos központok, egyetemek, ipari régiók, kikötők, történelmi helyszínek, kutatóközpontok és különleges földrajzi területek.

A helyszínek nem pusztán grafikai díszletek; mindegyik játékmechanikai funkciót hordoz. Egy vár meghatározott katonai egységeket biztosíthat; egy egyetem egy tudományterület fejlesztését; egy laboratórium kémiai/biológiai egységeket; egy csillagvizsgáló fizikai/matematikai technológiákat; egy történelmi központ stratégiai/geopolitikai képességeket. A térkép tehát egyben a tudás infrastruktúrájának térképe.

## 3. Tudásközpontok

A tudásközpontok elfoglalható és működtethető helyszínek, amelyek egységtípusokhoz vagy technológiákhoz adnak hozzáférést. Az elfoglalt helyszínt fenn is kell tartani.

Minden tudásközpontnak van tudásszintje / **stabilitási értéke**. A központ időszakosan kérdéseket tesz fel az adott tudományterülethez kapcsolódóan; a válaszok befolyásolják az állapotát.

- **Helyes válasz:** a tudásszint nő → erősebb egységek, fejlettebb technológiák, nagyobb utánpótlás.
- **Helytelen válasz:** a stabilitás csökken.
- **Stabilitás = 0 → lázadás.**

A lázadás **nem** büntet visszamenőleg: a már megszerzett egységeket a játékos nem veszíti el, de a központból **megszűnik az utánpótlás**. A tudásközpont elvesztése tehát nem azonnali katonai veszteség, hanem hosszú távú stratégiai probléma. Gyenge tudásterületre is lehet építeni, de számolni kell a későbbi utánpótlási gonddal.

## 4. Helyszínhez kötött egységrendszer

A különböző helyszínek eltérő egységeket adnak — nincs univerzális hadsereg. Az egységek **tudásponttal** rendelkeznek (ez váltja fel a fantasy mana-erőforrást): jelzi, milyen szintű tudásra épül az egység. Magasabb szintű egységhez a játékosnak ténylegesen rendelkeznie kell a megfelelő tudással, nem csak gazdasági fedezettel.

## 5. Tudományágak és egységek

| Tudományág | Frakció jellege | Példaegység | Harctéri szerep | Fejlesztési fókusz |
| --- | --- | --- | --- | --- |
| Matematika | Geometrikus konstruktumok | Kalkulus-gólem | Tank | Algebra, geometria, kalkulus, valószínűség |
| Fizika és kémia | Kinetikus alkimisták | Katalizátor-mágus | Tüzérség | Mechanika, termodinamika, reakciók |
| Biológia | Szerves entitások | Biomanta | Támogató | Anatómia, genetika, ökológia |
| Történelem | Taktikai légiók | Kronos-stratéga | Mobil harci egység | Évszámok, ok-okozat, geopolitika |
| Földrajz | Terraformáló entitások | Szeizmikus titán | Terepmanipulátor | Topográfia, geológia, meteorológia |

A frakciók nem feltétlenül külön nemzetek; a játékos több tudományterület egységeit integrálhatja egy hadseregbe (specializáció és kombinációs stratégiák).

## 6. Tudásalapú fejlesztés

Specializáció (1–2 terület, erős de szűk) vagy polihisztor stratégia (több terület, közepes). Kombinációs bónuszok: biológia + kémia → biokémiai egységek; matematika + fizika → mérnöki/kinetikus technológiák; történelem + földrajz → stratégiai/geopolitikai képességek. Cél: a tudományterületek egymásra épülő tudásrendszert alkossanak, ne elszigetelt skill tree-ket.

## 7. A tudásközpontok kvízrendszere

A kérdések nem feltétlenül klasszikus kvízablakban jelennek meg, hanem a világba integrálva: egyetem → vizsga; laboratórium → kutatási probléma; katonai akadémia → stratégiai kérdés; történelmi központ → forráselemzés. A teljesítmény befolyásolja a központ állapotát (fejlődés vagy — nulla stabilitásnál — lázadás, utánpótlás megszűnésével). Természetes stratégiai kényszer: nem elég elfoglalni, fenn is kell tartani.

## 8. Egyedi tudásanyag és RAG-alapú kérdésrendszer

A kérdésbank ne csak előre elkészített tartalom legyen. Admin/pedagógus/intézmény/engedélyezett játékos saját tananyagot tölthet fel (tankönyv, jegyzet, PDF, prezentáció, vállalati/intézményi anyag), amelyből **RAG-alapú tudásbázis** épül. A kérdésgenerálás kizárólag a feltöltött tudásbázisból dolgozhat.

Alkalmazások: iskola a saját tananyagából; vállalat a belső képzésből (játékosított tréning); egyetem egy kurzus anyagából. A rendszer így játékosított **tudásmenedzsment-platform** is lehet.

**Architekturális követelmény:** a RAG forrásmegjelöléssel és validációval működjön; a játékos ne kaphasson olyan kérdést, amelynek válasza nem vezethető vissza a feltöltött tananyaghoz. *(Megjegyzés: ez erősen egybevág a Krista forrás-hűség elvével.)*

## 9. Életkorhoz igazított tartalom

A regisztrációnál megadható az oktatási szint / korosztály. Ne csak az életkor legyen paraméter: célszerűbb egy **oktatási profil** (életkor, évfolyam, oktatási szint, tantárgyankénti mért tudásszint, kívánt nehézség). Két azonos korú játékos tudása eltérhet, ezért az életkor csak kiindulás; a tényleges adaptációt a mért teljesítmény határozza meg.

## 10. Adaptív nehézség

A rendszer figyeli a helyes válaszok arányát, a válaszidőt, a hibatípusokat és a stabilan megoldott szintet. Fejlettebb verzióban **IRT** vagy hasonló pszichometriai modell. A cél nem a folyamatos nehezítés, hanem az **optimális kihívási zóna**: túl könnyű → nincs tanulási érték; túl nehéz → folyamatos kudarc.

## 11. Területfoglalás és időablakos kontroll

Terület/vár/egység/hadsereg/artifact megszerzése nem automatikus: az objektumhoz kötött **három kérdésre** kell helyesen válaszolni, **meghatározott időablakban**. Siker → irányítás megszerezhető; az időablak kihagyása → a helyszín nem fogadja el az irányítást. Így tiszta katonai fölénnyel nem szerezhető meg minden terület — katonai képesség és tudás együtt kell.

## 12. Harcrendszer

Körökre osztott, Heroes-szerű taktikai rendszer; egységek mozgatása a harctéri hexrácson. Szerepek: tank, távolsági, támogató, gyors reagálású, terepmanipuláló, speciális. Az egységek ereje a mögöttük álló tudásrendszerhez kötött.

## 13. Artifactok

Különleges stratégiai tárgyak, amelyek nem csak statisztikai bónuszt adnak, hanem tudásterületekhez/kombinációkhoz kötődhetnek. Megszerzésükhöz is kellhet a helyhez tartozó három kérdés teljesítése — nem szabadon felvehető zsákmány.

## 14. A játékos fejlődése (három szint)

1. **Stratégiai** — területek, városok, várak, tudásközpontok.
2. **Hadsereg** — egységfejlesztés és tudáspontok.
3. **Tényleges tudás** — kérdések és tananyagok feldolgozása.

Ideális eset: a játékbeli és a valós tudásfejlődés párhuzamosan halad.

## 15. A fő játékciklus

Felfedezés → területfoglalás → háromkérdéses kontrollvizsgálat → tudásközpont megszerzése → fejlesztés → kérdések → erősebb egységek → hadseregfejlesztés → új területek.

Fenntartási ciklus: kérdés → helyes válasz → stabilitás nő → fejlettebb egységek; **vagy** kérdés → hibás válasz → stabilitás csökken → kritikus szint → lázadás → utánpótlás megszűnik. Önszabályozó stratégiai rendszer.

## 16. Flow és oktatás egyensúlya

A legnagyobb tervezési kockázat, hogy az oktatás megtöri a játékélményt. Ezért a kérdések ne legyenek állandóan jelen; a stratégiai és oktatási mechanika egymást váltó, de összekapcsolt ciklusokban működjön. A háromkérdéses foglalás rövid, világos, időkorlátos esemény; a tudásközpontok vizsgálata hosszabb távú stratégiai mechanika. A játékos ne félbeszakításként élje meg a tesztet, hanem a játék egyik rendszereként.

## 17. Tartalmi skálázhatóság

Fix bank önmagában nem elég egy hosszú kampányhoz. Források: előre elkészített bankok, parametrizált kérdések, procedurális generálás, intézményi tananyagok, RAG-alapú egyedi tudásbázis. Egzakt területeken a **változóparaméteres** generálás kulcs (ugyanaz a probléma más számértékekkel → nem memorizálható).

## 18. Pedagógiai és technológiai érték

Három rendszer összekapcsolása: stratégiai játék + adaptív e-learning + személyre szabott tudásmenedzsment. A RAG miatt nem kötődik egyetlen tantervhez; használható általános oktatásra, intézményi és vállalati képzésre is → fogyasztói, oktatási, vállalati és intézményi verzió.

## 19. Kritikus kockázatok

A legnagyobb kockázat a **túlzott komplexitás** (stratégiai játék + adaptív oktatás + pszichometria + RAG + tartalomkezelés + dinamikus generálás). A teljes rendszert nem célszerű egyetlen első verzióban megvalósítani.

**Az MVP magmechanikái (a vízió szerint):** alternatív európai térkép · hexagonális mozgás · körökre osztott harc · néhány tudományterület · tudásközpontok · háromkérdéses területfoglalás · tudásponttal rendelkező egységek · egyszerű adaptív kérdésrendszer · tudásközpont-lázadás. A **RAG** a következő fejlesztési szint; az **IRT** csak elegendő felhasználói adat után indokolt.

## 20. A koncepció lényege

A tudás **stratégiai erőforrás**. A játékos nem azért tanul, mert a játék időnként feladatokat ad, hanem mert a tudás birtoklása dönti el, milyen területeket hódíthat meg, milyen egységeket hozhat létre, milyen hadsereget tarthat fenn, milyen technológiákhoz fér hozzá, és meg tudja-e tartani a tudásközpontokat. A valódi innováció: a tudás kilép az oktatási „külső jutalom" szerepből, és a játékvilág egyik alapvető törvényévé válik. **A játék azért működik, mert a játékos tud.**

---

## Függelék — Viszony a jelenlegi tervekhez (iránymutatás, nem kötelezettség)

A már lezárt döntések és a futó MVP-scope **érvényben maradnak**; ez a hipotézis új *lehetőségeket* nyit, amelyeket iterációnként mérlegelünk. A legfontosabb eltérések / bővítések a jelenlegi GDD-hez és MVP-scope-hoz képest:

| Terület | Jelenlegi terv (lezárt/futó) | Vízió-hipotézis bővítése | Lehetséges besorolás |
| --- | --- | --- | --- |
| Térkép | semleges hex-szkenárió (G1) | **alternatív Európa**, helyszín = tudás-infrastruktúra | MVP-be emelhető tematikaként; mechanikailag a meglévő `HexMap`-re ül |
| Erőforrás | aszinkron **teszt-token** → KK (D-FLOW) | **tudásközpont-stabilitás** + utánpótlás-ciklus | új alrendszer; az async-token modell és ez egyesíthető |
| Foglalás | — | **háromkérdéses, időablakos** kontroll | új mechanika; jól illik a fázis-gárdához |
| Lázadás | — | stabilitás=0 → utánpótlás megszűnik (nincs visszamenőleges büntetés) | erős, új stratégiai réteg |
| Kérdésforrás | kurált + parametrikus bank | **RAG-alapú** egyedi tudásbázis, forrás-validációval | post-MVP; egybevág a Krista forrás-hűséggel |
| Adaptivitás | Rasch (1PL) MVP, 3PL később | **oktatási profil** + IRT elegendő adat után | a jelenlegi `RaschEstimator` ennek az első lépcsője |
| Artifactok | — | tudáshoz kötött, háromkérdéses megszerzés | post-MVP |

**Nyitott, eldöntendő feszültségek (majd külön döntésként):**
- **Token vs. stabilitás:** a jelenlegi aszinkron teszt-token és a vízió tudásközpont-stabilitása kétféle gazdaság; egyesíteni vagy választani kell (D-FLOW újranyitása lehet).
- **MVP-terjedelem:** a vízió MVP-listája bővebb a jelenlegi vertikális szeletnél (pl. tudásközpont-lázadás, háromkérdéses foglalás). Ha ezek bekerülnek, a `tudas-paradigmaja-MVP-scope` dokumentumot frissíteni kell.
- **Forrás-hűség (RAG):** ha bevezetjük, a „nincs forrás nélküli kérdés" szabály kemény architekturális invariáns legyen.

*Ez a függelék pusztán térkép a vízió és a futó munka között; nem módosít egyetlen lezárt döntést sem.*
