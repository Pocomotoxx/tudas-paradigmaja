# Hangfájlok / Sound files

Tedd ide az MP3 (vagy OGG) hangfájlokat. A játék automatikusan betölti őket ha jelen vannak,
különben a beépített Web Audio szintetizátor játssza le a hangokat.

| Fájlnév | Esemény |
|---------|---------|
| `bgm.mp3` | Háttérzene (loop) |
| `correct.mp3` | Helyes kvíz-válasz |
| `wrong.mp3` | Rossz kvíz-válasz |
| `conquest.mp3` | Tartomány elfoglalva |
| `lose_province.mp3` | Tartomány elvesztve |
| `turn.mp3` | Kör vége gomb |
| `win.mp3` | Győzelem |
| `lose.mp3` | Vereség |
| `build.mp3` | Épület megépítve |

OGG is működik — nevezd át `.ogg`-ra, a kód `.mp3` kiterjesztést keres, szóval vagy `.mp3`-ként mentsd,
vagy módosítsd a `SFX_FILES` tömböt a region-demo.html-ben.
