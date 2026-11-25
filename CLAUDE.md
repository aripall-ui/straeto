# CLAUDE.md — straeto

Persónuleg strætó-vefsíða. Fyrsta appið, **„Í vinnuna“**, er brottfararskjár fyrir vinnuferð eigandans: leið 13 frá Ásvallagötu að RÚV, með leiðir 1, 3 og 6 frá HÍ sem varakosti, morgunplan, niðurtalningu og veður. Annað appið, **„Heim“** (`dist/heim/`), sýnir heimferðina frá RÚV: leið 13 að Ásvallagötu og aðra kosti (11, 3, 6, 1, og 18 með skiptum í 13 á Skeggjagötu). Bæði voru smíðuð í ChatGPT Sites (Í vinnuna v44, Heim v16) og flutt hingað 25. nóv. 2026.

Öppin eru sameinuð í eitt app (eitt manifest, eitt tákn á heimaskjá) með flipum **Í vinnuna | Heim** efst á forsíðunum. Þau deila `theme.js`, `commute-status.*` og letri, en aðalkóðinn (`app.js` / `heim/heim.js`) og `style.css` eru enn aðskilin.

**Sjálfvirk átt (`dist/att.js`):** Heim frá kl. 14:30 til miðnættis, annars Í vinnuna. Handvirkt val (flipi, hlekkur milli átta, heimsókn á undirsíðu) gildir til næsta skiptitíma og er geymt í `localStorage` undir `straeto-att-val`. Aðeins forsíður (`data-forsida`) færa notandann sjálfkrafa.

**Framtíðarósk:** þriðja tegund ferða, hvorki heim né í vinnuna (skipuleggja aðrar ferðir). `att.js` og `.att-val` eru hönnuð svo hægt sé að bæta við átt.

Talaðu við notandann á **íslensku**. Viðmótið er allt á íslensku.

**Lestu `docs/handoff-i-vinnuna-v44.md`** áður en þú breytir hegðun. Þar eru features, ákvarðanir, gildrur, þekktar villur og óskir.

## Uppbygging

- `dist/`: allur vefurinn, birtur eins og hann er. Engin byggingarskref, enginn npm. Hreint HTML, CSS og JS.
  - `index.html` + `app.js`: forsíða með lifandi brottförum, Mínum ferðum og lokum þjónustu. Ferðalistinn (röðun, leiðaval, stoppaborðar) er í `renderTripList()` og `ferdalisti.css`.
  - `a-hradferd/`: samanburður leiðar 13 við HÍ-leiðir.
  - `undirbua-morguninn/planner.js`: skipulagsform fyrir morgundaginn.
  - `morning-plan.js`: sameiginlegir útreikningar og vistun plana (`localStorage`).
  - `commute-status.js`, `commute-weather.js`, `theme.js`: stöðutexti, veður og ljóst/dökkt útlit.
  - `att.js`, `att.css`: flipar og sjálfvirk átt (sjá ofar).
  - `naerkort.js`, `naerkort.css`, `kort.json`: nándarkort á báðum forsíðum. Leiðarlína að brottfararstoppi, stopp og daufar línur annarra strætóleiða sem götur, ásamt rauntímastaðsetningu vagnsins (`lat`/`lng` úr `BusLocationByStop`). Opnast sjálft 5 mín. fyrir brottför; „Kort“-hnappur í haus spjaldsins (fylltur þegar kortið er opið) opnar og lokar. `/?kort=prufa` (og `/heim/?kort=prufa`) sýnir sýnidæmi.
  - `bidrod.js`: biðröð ferða í ferðalistanum á báðum forsíðum (stroka til vinstri eða hnappur undir valinni röð). Stílar í `ferdalisti.css`.
  - `morgundagur.js`, `morgundagur.css`: plan fyrir næsta vinnudag, notað á báðum forsíðum. Flís neðst ef plan er til, spjald ef það vantar, ekkert á morgnana. Krefst `morning-plan.js`.
  - `timetable.json`: pökkuð GTFS-tímatafla. Gildir til `lastDay` (dagar frá 1970-01-01). Strætó birtir bara ~6 vikur fram í tímann, svo hún er uppfærð sjálfkrafa daglega.
- `dist/heim/`: heimleiðarappið. `index.html` + `heim.js` + eigin `style.css` (að hluta sameiginlegt með `dist/style.css`), `fleiri-ferdir/`. Notar manifest rótarinnar. Notar ekki `timetable.json`. Stopp, leiðir og áætlaðir göngutímar eru efst í `heim.js`. Forsíðan notar sama ferðalista og Í vinnuna (`ferdalisti.css`). `localStorage`-lyklar: `heim-ferdalisti`, `heim-limit-walking` (bara Fleiri ferðir).
- `tools/update-timetable.py`: endurgerir `dist/timetable.json` úr GTFS-ZIP-skrá Strætó.
- `tools/update-map.py`: endurgerir `dist/kort.json` úr sömu skrá. Leiðarhlutarnir (leið + brottfararstopp) eru efst í skránni og þurfa að passa við `app.js` og `heim/heim.js`.
- `.github/workflows/timetable.yml`: sækir GTFS daglega kl. 04:17, endurgerir `timetable.json` og `kort.json`, ýtir á `main` ef breyting og ræsir birtingu. Mistekst ef færri en 7 dagar eru eftir af gildistíma (GitHub sendir þá tölvupóst).
- `.github/workflows/pages.yml`: birtir `dist/` á GitHub Pages (https://aripall-ui.github.io/straeto/) við hvert push á `main`. Strætó-API-ið samþykkir beiðnir frá þeirri slóð (CORS staðfest 25. nóv. 2026).
- `.openai/hosting.json`, `docs/heim-hosting.json`: stillingar gömlu ChatGPT Sites-hýsingarinnar.
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

- **Allar slóðir eru afstæðar** því vefurinn er hýstur í undirmöppu (`/straeto/`). Aldrei nota `/eitthvað`. Í JS skal nota `appRoot`, `plannerRoot` eða `heimRoot` (reiknuð úr `document.currentScript.src`). Prófa má undir undirmöppu með symlink: `ln -s $PWD/dist /tmp/www/straeto && python3 -m http.server --directory /tmp/www`.
- **Cache-busting:** HTML-síðurnar hlaða skrám með `?v=<heiti>`. Þegar JS eða CSS breytist þarf að breyta `v=`-gildinu í öllum HTML-skrám sem hlaða skránni.
- **`localStorage`-lyklar** (`i-vinnuna-*`) geyma vistuð plön notandans. Ekki endurnefna þá án yfirfærslu.
- **Tími:** Notar `Atlantic/Reykjavik`. GTFS-tímar yfir 24:00 tilheyra fyrri þjónustudegi.
- Fastar forsendur: 40 mín. til að gera sig til, 100 skref á mínútu, 13 er aðalleið.
- Breyttu sem minnstu í hvert sinn og haltu útliti og orðalagi nema beðið sé um annað. Notandinn hefur skýrar skoðanir á hönnuninni (sjá kafla 6 og 9 í handoff).

## Vinnulag

- Unnið er á greinum og aldrei ýtt beint á `main` án leyfis.
- Repo-ið er **public**. Ekki setja inn fullt nafn, heimilisfang eða lykla.
