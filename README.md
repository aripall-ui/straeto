# straeto

Persónuleg strætóöpp fyrir höfuðborgarsvæðið.

**Í vinnuna:** niðurtalning í næsta strætó nr. 13 frá Ásvallagötu að RÚV. Varaleiðir eru 1, 3 og 6 frá HÍ. Einnig er hægt að skipuleggja morguninn og sjá veður.

## Keyra staðbundið

```bash
python3 -m http.server 8000 --directory dist
```

Opna http://localhost:8000/.

## Uppfæra tímatöflu

```bash
python3 tools/update-timetable.py
```

Gögn: [Strætó GTFS](https://opendata.straeto.is/data/gtfs/gtfs.zip), rauntími frá `api.straeto.is` og veður frá [Open-Meteo](https://open-meteo.com/).

Nánari lýsing er í [docs/handoff-i-vinnuna-v44.md](docs/handoff-i-vinnuna-v44.md).
