// questionBank — content: a real felelet-választós (multiple-choice) question
// bank across all 9 subjects, suitable for children. Not engine: this is pure
// data (QuestionItem[]) that any scenario can plug into `questions`.
//
// Every item carries full MC content (prompt/correct/distractors) with SIX
// distractors each, so the bank supports the highest difficulty's 7-option
// questions (Difficulty.FOUR -> choiceCount 7) without falling back to fewer
// options. Difficulty tiers (ALAP/HALADO/SZAKERTO) map to roughly increasing
// Rasch `b` values within each subject, so adaptive selection (RaschEstimator)
// has real range to work with.

import { Subject, DifficultyTier, type QuestionItem } from "@tudas-paradigmaja/core";

interface Row {
  readonly id: string;
  readonly subject: Subject;
  readonly topic: string;
  readonly b: number;
  readonly tier: DifficultyTier;
  readonly prompt: string;
  readonly correct: string;
  readonly distractors: readonly string[];
}

const A = DifficultyTier.ALAP, H = DifficultyTier.HALADO, S = DifficultyTier.SZAKERTO;

const ROWS: readonly Row[] = [
  // --- MAGYAR ----------------------------------------------------------
  { id: "hu-1", subject: Subject.MAGYAR, topic: "szófajok", b: -1.4, tier: A,
    prompt: "Melyik szófaj a „fut” szó?", correct: "Ige",
    distractors: ["Főnév", "Melléknév", "Számnév", "Névmás", "Határozószó", "Kötőszó"] },
  { id: "hu-2", subject: Subject.MAGYAR, topic: "nyelvtan", b: -1.0, tier: A,
    prompt: "Hány magánhangzó betű van a magyar ábécében?", correct: "14",
    distractors: ["7", "10", "24", "40", "5", "20"] },
  { id: "hu-3", subject: Subject.MAGYAR, topic: "irodalom", b: -0.6, tier: A,
    prompt: "Ki írta a Toldi című művet?", correct: "Arany János",
    distractors: ["Petőfi Sándor", "Jókai Mór", "Móricz Zsigmond", "Kölcsey Ferenc", "Vörösmarty Mihály", "Mikszáth Kálmán"] },
  { id: "hu-4", subject: Subject.MAGYAR, topic: "nyelvtan", b: 0.2, tier: H,
    prompt: "Melyik toldalék a többes szám jele a magyarban?", correct: "-k",
    distractors: ["-m", "-d", "-t", "-ban", "-ra", "-tól"] },
  { id: "hu-5", subject: Subject.MAGYAR, topic: "mondattan", b: 0.6, tier: H,
    prompt: "Melyik mondatfajta végén áll kérdőjel?", correct: "Kérdő mondat",
    distractors: ["Kijelentő mondat", "Felkiáltó mondat", "Felszólító mondat", "Óhajtó mondat", "Tagadó mondat", "Állító mondat"] },
  { id: "hu-6", subject: Subject.MAGYAR, topic: "irodalom", b: 1.5, tier: S,
    prompt: "Ki írta Az ember tragédiája című drámát?", correct: "Madách Imre",
    distractors: ["Arany János", "Petőfi Sándor", "Vörösmarty Mihály", "Jókai Mór", "Kölcsey Ferenc", "Babits Mihály"] },

  // --- MATEMATIKA --------------------------------------------------------
  { id: "mat-1", subject: Subject.MATEMATIKA, topic: "alapműveletek", b: -1.4, tier: A,
    prompt: "Mennyi 7 + 8?", correct: "15",
    distractors: ["14", "16", "13", "17", "12", "18"] },
  { id: "mat-2", subject: Subject.MATEMATIKA, topic: "szorzás", b: -1.0, tier: A,
    prompt: "Mennyi 9 × 6?", correct: "54",
    distractors: ["45", "56", "63", "48", "52", "60"] },
  { id: "mat-3", subject: Subject.MATEMATIKA, topic: "geometria", b: -0.6, tier: A,
    prompt: "Hány oldala van egy háromszögnek?", correct: "3",
    distractors: ["2", "4", "5", "6", "1", "8"] },
  { id: "mat-4", subject: Subject.MATEMATIKA, topic: "hatványozás", b: 0.2, tier: H,
    prompt: "Mennyi 12²?", correct: "144",
    distractors: ["124", "132", "140", "154", "169", "122"] },
  { id: "mat-5", subject: Subject.MATEMATIKA, topic: "geometria", b: 0.6, tier: H,
    prompt: "Mi a kör kerületének képlete (r = sugár)?", correct: "2πr",
    distractors: ["πr²", "2r²", "πr", "4r", "r²", "πd/2"] },
  { id: "mat-6", subject: Subject.MATEMATIKA, topic: "egyenletek", b: 1.5, tier: S,
    prompt: "Mi x értéke, ha 3x + 5 = 20?", correct: "5",
    distractors: ["4", "6", "15", "25/3", "3", "7"] },

  // --- FIZIKA --------------------------------------------------------
  { id: "fiz-1", subject: Subject.FIZIKA, topic: "hőtan", b: -1.4, tier: A,
    prompt: "Hány fokon forr a víz normál légköri nyomáson (°C)?", correct: "100",
    distractors: ["0", "50", "90", "120", "200", "37"] },
  { id: "fiz-2", subject: Subject.FIZIKA, topic: "mértékegységek", b: -1.0, tier: A,
    prompt: "Mi az erő SI-mértékegysége?", correct: "newton",
    distractors: ["joule", "watt", "pascal", "volt", "amper", "kelvin"] },
  { id: "fiz-3", subject: Subject.FIZIKA, topic: "mechanika", b: -0.6, tier: A,
    prompt: "Mi húzza a tárgyakat a Föld középpontja felé?", correct: "Gravitáció",
    distractors: ["Súrlódás", "Mágnesesség", "Elektromosság", "Légnyomás", "Hőtágulás", "Rezgés"] },
  { id: "fiz-4", subject: Subject.FIZIKA, topic: "optika", b: 0.2, tier: H,
    prompt: "Mekkora (kerekítve) a fény sebessége vákuumban?", correct: "300 000 km/s",
    distractors: ["150 000 km/s", "3 000 km/s", "1 000 000 km/s", "30 000 km/s", "900 000 km/s", "3 000 m/s"] },
  { id: "fiz-5", subject: Subject.FIZIKA, topic: "mértékegységek", b: 0.6, tier: H,
    prompt: "Melyik mennyiséget méri a watt?", correct: "Teljesítmény",
    distractors: ["Erő", "Energia", "Nyomás", "Feszültség", "Áramerősség", "Sebesség"] },
  { id: "fiz-6", subject: Subject.FIZIKA, topic: "mechanika", b: 1.5, tier: S,
    prompt: "Newton második törvénye szerint mivel egyenlő az erő?", correct: "tömeg × gyorsulás",
    distractors: ["tömeg × sebesség", "tömeg / gyorsulás", "sebesség × idő", "tömeg × idő", "erő / tömeg", "gyorsulás / tömeg"] },

  // --- KEMIA --------------------------------------------------------
  { id: "kem-1", subject: Subject.KEMIA, topic: "vegyjelek", b: -1.4, tier: A,
    prompt: "Mi a víz vegyjele?", correct: "H₂O",
    distractors: ["CO₂", "O₂", "NaCl", "H₂", "HO₂", "CH₄"] },
  { id: "kem-2", subject: Subject.KEMIA, topic: "atomszerkezet", b: -1.0, tier: A,
    prompt: "Hány proton van egy hidrogénatomban?", correct: "1",
    distractors: ["2", "0", "3", "6", "8", "4"] },
  { id: "kem-3", subject: Subject.KEMIA, topic: "vegyjelek", b: -0.6, tier: A,
    prompt: "Mi a konyhasó vegyjele?", correct: "NaCl",
    distractors: ["KCl", "CaCO₃", "NaOH", "H₂SO₄", "NaHCO₃", "MgCl₂"] },
  { id: "kem-4", subject: Subject.KEMIA, topic: "égés", b: 0.2, tier: H,
    prompt: "Melyik gáz szükséges az égéshez?", correct: "Oxigén",
    distractors: ["Nitrogén", "Szén-dioxid", "Hidrogén", "Hélium", "Argon", "Metán"] },
  { id: "kem-5", subject: Subject.KEMIA, topic: "tudománytörténet", b: 0.6, tier: H,
    prompt: "Ki alkotta meg a periódusos rendszert?", correct: "Mengyelejev",
    distractors: ["Einstein", "Curie", "Bohr", "Newton", "Rutherford", "Avogadro"] },
  { id: "kem-6", subject: Subject.KEMIA, topic: "pH", b: 1.5, tier: S,
    prompt: "Mi a pH-skála semleges értéke?", correct: "7",
    distractors: ["0", "14", "1", "10", "5", "3"] },

  // --- BIOLOGIA --------------------------------------------------------
  { id: "bio-1", subject: Subject.BIOLOGIA, topic: "emberi test", b: -1.4, tier: A,
    prompt: "Melyik szerv pumpálja a vért a testben?", correct: "Szív",
    distractors: ["Tüdő", "Máj", "Vese", "Gyomor", "Agy", "Lép"] },
  { id: "bio-2", subject: Subject.BIOLOGIA, topic: "állatok", b: -1.0, tier: A,
    prompt: "Mivel lélegeznek a halak?", correct: "Kopoltyúval",
    distractors: ["Tüdővel", "Bőrrel", "Orral", "Szájjal", "Úszóhólyaggal", "Farokkal"] },
  { id: "bio-3", subject: Subject.BIOLOGIA, topic: "növények", b: -0.6, tier: A,
    prompt: "Mi a növények zöld színanyagának neve?", correct: "Klorofill",
    distractors: ["Karotin", "Hemoglobin", "Melanin", "Xantofill", "Antocián", "Kollagén"] },
  { id: "bio-4", subject: Subject.BIOLOGIA, topic: "sejttan", b: 0.2, tier: H,
    prompt: "Melyik sejtszervecske termeli a sejt energiáját?", correct: "Mitokondrium",
    distractors: ["Sejtmag", "Riboszóma", "Golgi-készülék", "Lizoszóma", "Vakuólum", "Kloroplasztisz"] },
  { id: "bio-5", subject: Subject.BIOLOGIA, topic: "emberi test", b: 0.6, tier: H,
    prompt: "Kb. hány csontból áll a felnőtt emberi test?", correct: "206",
    distractors: ["106", "150", "300", "86", "250", "180"] },
  { id: "bio-6", subject: Subject.BIOLOGIA, topic: "tudománytörténet", b: 1.5, tier: S,
    prompt: "Ki dolgozta ki az evolúció elméletét?", correct: "Charles Darwin",
    distractors: ["Gregor Mendel", "Louis Pasteur", "Carl Linné", "Isaac Newton", "Robert Hooke", "James Watson"] },

  // --- TORTENELEM --------------------------------------------------------
  { id: "tor-1", subject: Subject.TORTENELEM, topic: "honfoglalás", b: -1.4, tier: A,
    prompt: "Mikor történt (kb.) a honfoglalás?", correct: "895",
    distractors: ["1000", "1100", "700", "1241", "1526", "800"] },
  { id: "tor-2", subject: Subject.TORTENELEM, topic: "államalapítás", b: -1.0, tier: A,
    prompt: "Ki volt Magyarország első királya?", correct: "I. István",
    distractors: ["Mátyás király", "Árpád vezér", "Könyves Kálmán", "II. András", "Szent László", "I. Béla"] },
  { id: "tor-3", subject: Subject.TORTENELEM, topic: "középkor", b: -0.6, tier: A,
    prompt: "Melyik évben volt a mohácsi vész?", correct: "1526",
    distractors: ["1456", "1241", "1686", "1848", "1920", "1711"] },
  { id: "tor-4", subject: Subject.TORTENELEM, topic: "középkor", b: 0.2, tier: H,
    prompt: "Melyik magyar királyt nevezték „Hollós királynak”?", correct: "Mátyás király",
    distractors: ["I. István", "Szent László", "II. Lajos", "I. Lipót", "Könyves Kálmán", "III. Béla"] },
  { id: "tor-5", subject: Subject.TORTENELEM, topic: "újkor", b: 0.6, tier: H,
    prompt: "Melyik évben tört ki az 1848-as forradalom?", correct: "1848",
    distractors: ["1830", "1867", "1918", "1956", "1800", "1900"] },
  { id: "tor-6", subject: Subject.TORTENELEM, topic: "20. század", b: 1.5, tier: S,
    prompt: "Melyik békeszerződés zárta le Magyarország számára az első világháborút?", correct: "Trianoni békeszerződés",
    distractors: ["Versailles-i szerződés", "Párizsi békeszerződés", "Bécsi döntés", "Karlócai béke", "Nikolsburgi béke", "Pozsonyi béke"] },

  // --- FOLDRAJZ --------------------------------------------------------
  { id: "fold-1", subject: Subject.FOLDRAJZ, topic: "Magyarország", b: -1.4, tier: A,
    prompt: "Melyik Magyarország fővárosa?", correct: "Budapest",
    distractors: ["Debrecen", "Szeged", "Pécs", "Győr", "Miskolc", "Székesfehérvár"] },
  { id: "fold-2", subject: Subject.FOLDRAJZ, topic: "folyók", b: -1.0, tier: A,
    prompt: "Melyik Európa leghosszabb folyója, amely Magyarországon is átfolyik?", correct: "Duna",
    distractors: ["Tisza", "Dráva", "Rába", "Körös", "Sajó", "Ipoly"] },
  { id: "fold-3", subject: Subject.FOLDRAJZ, topic: "óceánok", b: -0.6, tier: A,
    prompt: "Melyik a legnagyobb óceán a Földön?", correct: "Csendes-óceán",
    distractors: ["Atlanti-óceán", "Indiai-óceán", "Jeges-tenger", "Balti-tenger", "Fekete-tenger", "Vörös-tenger"] },
  { id: "fold-4", subject: Subject.FOLDRAJZ, topic: "hegyek", b: 0.2, tier: H,
    prompt: "Melyik a legmagasabb hegycsúcs a Földön?", correct: "Mount Everest",
    distractors: ["Kilimandzsáró", "Mont Blanc", "K2", "Elbrusz", "Matterhorn", "Aconcagua"] },
  { id: "fold-5", subject: Subject.FOLDRAJZ, topic: "sivatagok", b: 0.6, tier: H,
    prompt: "Melyik a legnagyobb forró (homok-)sivatag a Földön?", correct: "Szahara",
    distractors: ["Gobi", "Atacama", "Kalahári", "Arab-sivatag", "Namib", "Mojave"] },
  { id: "fold-6", subject: Subject.FOLDRAJZ, topic: "országok", b: 1.5, tier: S,
    prompt: "Melyik a legnagyobb területű ország a Földön?", correct: "Oroszország",
    distractors: ["Kanada", "Kína", "USA", "Brazília", "Ausztrália", "India"] },

  // --- INFORMATIKA --------------------------------------------------------
  { id: "inf-1", subject: Subject.INFORMATIKA, topic: "hardver", b: -1.4, tier: A,
    prompt: "Mit jelent a „CPU” rövidítés?", correct: "Központi feldolgozóegység",
    distractors: ["Memória", "Merevlemez", "Videokártya", "Billentyűzet", "Operációs rendszer", "Hálózati kártya"] },
  { id: "inf-2", subject: Subject.INFORMATIKA, topic: "mértékegységek", b: -1.0, tier: A,
    prompt: "Melyik egység méri a tárhely méretét?", correct: "Bájt",
    distractors: ["Watt", "Volt", "Hertz", "Amper", "Newton", "Celsius"] },
  { id: "inf-3", subject: Subject.INFORMATIKA, topic: "szoftver", b: -0.6, tier: A,
    prompt: "Hogy hívják az internet böngészésére használt programot?", correct: "Böngésző",
    distractors: ["Szövegszerkesztő", "Táblázatkezelő", "Operációs rendszer", "Vírusirtó", "Fordítóprogram", "Adatbázis-kezelő"] },
  { id: "inf-4", subject: Subject.INFORMATIKA, topic: "számrendszerek", b: 0.2, tier: H,
    prompt: "Melyik számrendszert használja alapvetően a számítógép?", correct: "Kettes (bináris)",
    distractors: ["Tízes", "Nyolcas", "Tizenhatos", "Hármas", "Ötös", "Hetes"] },
  { id: "inf-5", subject: Subject.INFORMATIKA, topic: "internet", b: 0.6, tier: H,
    prompt: "Mit jelent a „www” rövidítés?", correct: "World Wide Web",
    distractors: ["World Wide Watch", "Web Wide World", "Wide World Web", "World Web Wide", "Web World Wide", "Wild Web World"] },
  { id: "inf-6", subject: Subject.INFORMATIKA, topic: "tudománytörténet", b: 1.5, tier: S,
    prompt: "Kit tartanak a modern számítógép-tudomány egyik megalapítójának?", correct: "Alan Turing",
    distractors: ["Albert Einstein", "Isaac Newton", "Charles Darwin", "Nikola Tesla", "Thomas Edison", "Stephen Hawking"] },

  // --- IDEGEN_NYELV (angol alapszavak) ------------------------------------
  { id: "eng-1", subject: Subject.IDEGEN_NYELV, topic: "szókincs", b: -1.4, tier: A,
    prompt: "Mit jelent angolul a „ház” szó?", correct: "house",
    distractors: ["car", "tree", "book", "dog", "water", "sun"] },
  { id: "eng-2", subject: Subject.IDEGEN_NYELV, topic: "szókincs", b: -1.0, tier: A,
    prompt: "Mit jelent angolul az „alma”?", correct: "apple",
    distractors: ["orange", "banana", "grape", "bread", "milk", "egg"] },
  { id: "eng-3", subject: Subject.IDEGEN_NYELV, topic: "kifejezések", b: -0.6, tier: A,
    prompt: "Hogyan mondjuk angolul, hogy „köszönöm”?", correct: "thank you",
    distractors: ["please", "sorry", "hello", "goodbye", "yes", "no"] },
  { id: "eng-4", subject: Subject.IDEGEN_NYELV, topic: "nyelvtan", b: 0.2, tier: H,
    prompt: "Mi a „to go” ige múlt idejű (Past Simple) alakja?", correct: "went",
    distractors: ["goed", "gone", "going", "goes", "go", "went to"] },
  { id: "eng-5", subject: Subject.IDEGEN_NYELV, topic: "szókincs", b: 0.6, tier: H,
    prompt: "Melyik szó jelenti azt, hogy „gyors”?", correct: "fast",
    distractors: ["slow", "big", "small", "happy", "sad", "tall"] },
  { id: "eng-6", subject: Subject.IDEGEN_NYELV, topic: "fordítás", b: 1.5, tier: S,
    prompt: "Mi a helyes fordítása: „Habár esett az eső, elmentünk sétálni.”?",
    correct: "Although it was raining, we went for a walk.",
    distractors: [
      "Because it was raining, we stayed home.",
      "If it rains, we will go for a walk.",
      "It was raining, so we went for a walk.",
      "We went for a walk before it rained.",
      "Despite the sun, we went for a walk.",
      "While it rains, we go for a walk.",
    ] },
];

/** The full content bank as QuestionItems (ready for a ScenarioDef.questions). */
export function coreQuestionBank(): QuestionItem[] {
  return ROWS.map((r) => ({
    id: r.id,
    subject: r.subject,
    topic: r.topic,
    b: r.b,
    tier: r.tier,
    prompt: r.prompt,
    correct: r.correct,
    distractors: r.distractors,
  }));
}

/** Just the items for one subject (content view, e.g. for a subject-filtered quiz). */
export function questionsFor(subject: Subject): QuestionItem[] {
  return coreQuestionBank().filter((q) => q.subject === subject);
}
