# CLAUDE.md — straeto

Persónuleg strætó-vefsíða. Fyrsta appið, **„Í vinnuna“**, er brottfararskjár fyrir vinnuferð eigandans: leið 13 frá Ásvallagötu að RÚV, með leiðir 1, 3 og 6 frá HÍ sem varakosti, morgunplan, niðurtalningu og veður. Annað appið, **„Heim“** (`dist/heim/`), sýnir heimferðina frá RÚV: leið 13 að Ásvallagötu og aðra kosti (11, 3, 6, 1, og 18 með skiptum í 13 á Skeggjagötu). Bæði voru smíðuð í ChatGPT Sites (Í vinnuna v44, Heim v16) og flutt hingað 25. nóv. 2026.

**Markmið notandans:** að sameina öppin í eitt app. Núna eru þau tvö öpp á sama uppruna sem deila `theme.js`, `commute-status.*` og letri.

Talaðu við notandann á **íslensku**. Viðmótið er allt á íslensku.

**Lestu `docs/handoff-i-vinnuna-v44.md`** áður en þú breytir hegðun. Þar eru features, ákvarðanir, gildrur, þekktar villur og óskir.

## Uppbygging

- `dist/`: allur vefurinn, birtur eins og hann er. Engin byggingarskref, enginn npm. Hreint HTML, CSS og JS.
  - `index.html` + `app.js`: forsíða með lifandi brottförum, Mínum ferðum og lokum þjónustu.
  - `a-hradferd/`: samanburður leiðar 13 við HÍ-leiðir.
  - `undirbua-morguninn/planner.js`: skipulagsform fyrir morgundaginn.
  - `morning-plan.js`: sameiginlegir útreikningar og vistun plana (`localStorage`).
  - `commute-status.js`, `commute-weather.js`, `theme.js`: stöðutexti, veður og ljóst/dökkt útlit.
  - `timetable.json`: pökkuð GTFS-tímatafla. Gildir til `lastDay` (20819 = 1. jan. 2027).
- `dist/heim/`: heimleiðarappið. `index.html` + `heim.js` + eigin `style.css` (að hluta sameiginlegt með `dist/style.css`), `fleiri-ferdir/`, eigin manifest og tákn með scope `/heim/`. Notar ekki `timetable.json`. Stopp og leiðir eru efst í `heim.js`. `localStorage`-lykill: `heim-limit-walking`.
- `tools/update-timetable.py`: endurgerir `dist/timetable.json` úr GTFS-ZIP-skrá Strætó.
- `.openai/hosting.json`: stilling fyrir gömlu ChatGPT Sites-hýsinguna.
- `docs/`: handoff og önnur skjöl.

## Keyra

```bash
python3 -m http.server 8000 --directory dist
```

Opna http://localhost:8000/. Prófið `/?kort=prufa` sýnir nándarkortið.

Hægt er að athuga setningafræði með `node --check dist/**/*.js`. Engin sjálfvirk prófunarsvíta er til.

## Gögn

- **Rauntími:** `POST https://api.straeto.is/graphql` með `BusLocationByStop` fyrir sex stopp í einni beiðni. Óopinbert snið án lykils, svo staðfesta þarf skilmála áður en appið er boðið fleirum.
- **Áætlun:** `timetable.json`, búin til úr https://opendata.straeto.is/data/gtfs/gtfs.zip.
- **Veður:** Open-Meteo fyrir fastan punkt í Vesturbæ.
- Stopp og `headsign` eru efst í `dist/app.js`: 13 `90000179`→`90000083` „Sléttuvegur“; 1 og 3 frá HÍ B `90000296`; 6 frá HÍ C `90000882`.

## Reglur og gildrur

- **Slóðir eru rótartengdar** (`/app.js`, `/timetable.json`). Hýsing í undirmöppu, t.d. `notandi.github.io/straeto/`, krefst breytinga á þeim öllum.
- **Cache-busting:** HTML-síðurnar hlaða skrám með `?v=<heiti>`. Þegar JS eða CSS breytist þarf að breyta `v=`-gildinu í öllum HTML-skrám sem hlaða skránni.
- **`localStorage`-lyklar** (`i-vinnuna-*`) geyma vistuð plön notandans. Ekki endurnefna þá án yfirfærslu.
- **Tími:** Notar `Atlantic/Reykjavik`. GTFS-tímar yfir 24:00 tilheyra fyrri þjónustudegi.
- **`update-timetable.py` skrifar ekki `lastDay`.** Bæta þarf honum við áður en endurgerð tímatafla er birt.
- Fastar forsendur: 40 mín. til að gera sig til, 100 skref á mínútu, 13 er aðalleið.
- Breyttu sem minnstu í hvert sinn og haltu útliti og orðalagi nema beðið sé um annað. Notandinn hefur skýrar skoðanir á hönnuninni (sjá kafla 6 og 9 í handoff).

## Vinnulag

- Unnið er á greinum og aldrei ýtt beint á `main` án leyfis.
- Repo-ið er **public**. Ekki setja inn fullt nafn, heimilisfang eða lykla.
