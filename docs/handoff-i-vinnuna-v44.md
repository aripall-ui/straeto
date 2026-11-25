# Í vinnuna — handoff fyrir forritara

**Staða 25. nóvember 2026:** Útgáfa **44** er í birtingu. Git-commit: `f36881716e6788bd9d8cdf58b0ef3b20999b9ff9`. Vefurinn var síðast birtur 24. nóvember 2026 kl. 03:57 að íslenskum tíma. Hér er hegðun skilgreind út frá þeim kóða. Tillögur um næstu útgáfur eru í kafla 10. [Birt útgáfa](https://aribus-13-asvallagata.modernjuice4.chatgpt.site/)

## 1. Tilgangur

Í vinnuna er sérsniðinn brottfararskjár fyrir ferðir eiganda appsins úr Vesturbæ til vinnu á RÚV. Meginspurningin við opnun á síma er **hvenær fer næsti vagn sem hentar mér?** Aðalleiðin er 13 frá Ásvallagötu í átt að Sléttuvegi. Þegar hún hentar síður ber notandinn saman leiðir 1, 3 og 6 frá Háskóla Íslands og gengur síðasta spölinn til vinnu.

- **Á kvöldin** velur notandinn ferðir fyrir næsta vinnudag, getur slegið inn göngutíma og séð hvort hann nái mætingartíma. Hann getur vistað dagsplan eða notað ferðirnar aftur virka daga.
- **Að morgni** sýnir stóra talan tímann í brottför. Ferðaspjaldið sýnir einnig hvenær þarf að fara á fætur og út úr húsi, áætlaða göngu og hvenær komið er til vinnu.
- **Á öðrum tímum** nýtist vefurinn sem hraður skjár fyrir leið 13 og þessa þrjá varakosti. Textahlekkur neðst vísar á sérstakan vef fyrir heimferðina.

Markmiðið til lengri tíma er að fleiri geti sett upp sínar eigin ferðir og notað vefinn sem almennt strætóapp. Núverandi stoppapör, gönguviðmið og áfangastaðir eru sérsniðin að þessari einu vinnuferð.

## 2. Features

### Skjáir og hvernig ferðir eru valdar

| Slóð eða skjár | Hegðun í útgáfu 44 |
|---|---|
| `/` — lifandi brottfarir | Sýnir næstu leið 13 efst með niðurtalningu, brottför og komu á RÚV. Taflan sýnir allt að fimm lifandi brottfarir á leið 13, þar á meðal þá næstu. **Á hraðferð?** sýnir eitt spjald fyrir hverja af leiðum 1, 3 og 6 ef gögn eru til, raðað eftir brottför. Hægt er að velja ferð úr töflu eða spjaldi í efsta reit og nota **Sýna næsta vagn** til að fara aftur í sjálfgefið val. |
| `/a-hradferd/` — Á hraðferð? | Þrjár töflur: næsta leið 13, allt að tvær ferðir á hverri HÍ-leið og allt að fjórar seinni ferðir á leið 13. Efsti reiturinn sýnir valda ferð. Sjálfgefið kemur næsta 13 á undan fyrstu HÍ-ferð. Hlekkur frá forsíðu getur borið `?ferd=<leið>:<trip_id>` fyrir valda ferð. Val á lifandi ferð er í minni síðunnar. |
| `/undirbua-morguninn/` — Undirbúa morguninn | Sækir staðbundnu tímaskrána og birtir ferðir til að velja og vista. `?dagur=YYYY-MM-DD` opnar tiltekinn dag ef hann er í dag eða síðar. Eftir vistun fer vafrinn aftur á `/`. |
| `/` — Mínar ferðir | Vistað plan birtist á forsíðunni í stað lifandi brottfarartaflna þegar það uppfyllir skilyrðin hér fyrir neðan. Efsta spjaldið og listinn eru hluti af sömu síðu. |
| `/` — þjónustu lokið | Ef þjónustugluggi er lokaður og ekkert viðeigandi plan finnst birtist **Strætó er hættur að ganga í dag** ásamt hlekk á skipulag fyrir næsta þjónustudag sem kóðinn finnur. |
| Heimferð | **Ertu á leiðinni heim?** er venjulegur hlekkur á sérstakan vef. [Heim](https://heim-asvallagata.modernjuice4.chatgpt.site/) |

Á forsíðu sækir `currentSavedRides()` fyrst plan dagsins og fjarlægir farnar ferðir. Ef einhver ferð stendur eftir birtist planið. Næst kemur til greina næsti dagur úr þjónustuglugganum ef honum er lokað, annars dagsetningin úr `planDate()`. Framtíðarplan birtist ef þjónusta er lokuð eða ef planið er sérstaklega vistað fyrir daginn. Endurtekið framtíðarplan tekur því ekki almennt yfir lifandi forsíðu á meðan þjónusta er opin. Sérstakt plan fyrir morgundaginn getur tekið yfir strax eftir vistun. Sé hvorugt planið tiltækt sýnir forsíðan lifandi brottfarir eða skjá fyrir lok þjónustu.

### Skipuleggja og vista ferð

- **Dagsetning og mæting.** Sjálfgefin dagsetning er dagurinn í dag fyrir kl. 05:00 og dagurinn á morgun frá kl. 05:00, nema gild dagsetning sé gefin í slóð. Mætingarmark er valkvætt og sjálfgefið við nýtt plan er **09:45**. Í lista fyrir daginn í dag eru liðnar brottfarir faldar við hleðslu nema þær séu þegar valdar.
- **Göngutímar.** Notandinn getur slegið inn heiltölur 0–120 mínútur fyrir hvorn gönguhluta. Sjálfgefið frá heimili að stoppi eru 5 mínútur að Ásvallagötu og 15 að hvoru HÍ-stoppi. Auður reitur frá endastoppi í vinnu merkir 0 mínútur.
- **Ferðaval.** Leið 13 er í sérflokki og HÍ-leiðirnar í öðrum. Ferðir raðast í stuttan lista umhverfis mætingarmarkið miðað við komu í vinnu. Reiknireglan miðar við allt að 36 valkosti samanlagt og allt að níu á leið áður en þegar valdar ferðir hafa áhrif. Sjálfgefið sjást allt að þrjár ferðir á tíma og ein seinni á leið 13 og allt að ein á tíma og ein seinni á hverri varaleið, með sérreglu sem setur tvær fyrstu HÍ-ferðir hvers leiðarnúmers í fyrri valkosti. Hægt er að sýna fyrri eða seinni ferðir og fella þær saman aftur. Þegar valdar ferðir haldast sýnilegar og **Hreinsa val** afmerkir þær í forminu.
- **Vista fyrir þennan dag.** Vistar nákvæm ferðafærslur, göngutíma og mætingarmark fyrir dagsetninguna. Hægt er að vista autt val yfir fyrirliggjandi plani og þannig sleppa endurtekna planinu þennan dag.
- **Nota á virkum dögum.** Vistar samsetninguna leiðarnúmer + mínúta dagsins, ásamt göngutíma og mætingarmarki. Mánudaga til föstudaga er hver slík færsla pöruð við tímaskrá viðkomandi dags. Sé tíminn ekki til birtist ábending þar sem við á. Sérstök dagsvistun hefur forgang. Hægt er að eyða dagsfráviki með **Nota venjulega planið þennan dag** eða hætta endurtekningu.
- **Geymsla.** Gögnin eru í `localStorage`. Helstu lyklar eru `i-vinnuna-morning-plans`, `i-vinnuna-weekday-plan`, `i-vinnuna-preferred-trip`, `i-vinnuna-trip-sort` og `i-vinnuna-theme`. Ekkert af þessu er samstillt við netþjón. Vistunarvillur eru sýndar í viðmótinu. Við sjálfvirka hreinsun sem ekki tekst eru farnar ferðir faldar í minni þess flipa.

### Ferðaspjald, niðurtalning og eyðing

- **Aðalferð.** Sjálfgefið er sú ferð sem fer fyrst, óháð því hvernig listinn er flokkaður. Ýti notandi á röð er hún merkt **Aðalferð** og efsta spjaldið og veðrið uppfærast. Röðin færist ekki við valið. Valið er geymt fyrir tiltekna dagsetningu og fellur aftur í næstu brottför ef ferðin er farin eða fjarlægð.
- **Flokkun.** Litlu stjórntækin hægra megin undir stóra spjaldinu heita **Brottför**, **Komu** og **Stoppistöð**. **Komu** raðar eftir komu í vinnu, með óþekkta komu aftast. **Stoppistöð** raðar eftir heiti brottfararstöðvar með íslenskri röðun og svo tíma. Stjórntækin sjást frá tveimur ferðum.
- **Kvöld og morgunn.** Fyrir framtíðarplan og fyrir skiptitíma í dag fá **Brottför** og **Í vinnu** sambærilegt vægi. Fyrir plan dagsins skiptir spjaldið við fyrra af **06:00** og fyrstu áætluðu brottför dagsins á einhverri af fjórum leiðum appsins. Þá er **Brottför** eina stóra spjaldið með niðurtalningu og klukku. **Í vinnu** færist á milli **Í vagninum** og **Ganga alls**. Niðurtalning sýnir `m:ss`, `h:mm:ss` frá klukkutíma og **Núna** við núll. Hún uppfærist á sekúndu fresti þegar flipinn er sýnilegur.
- **Útreikningar.** **Út úr húsi** = brottför mínus göngutími að stoppi. **Á fætur** = tími út úr húsi mínus fastar 40 mínútur. **Í vinnu** = koma á stopp plús ganga í vinnu. Ferðatími vagns er námundaður að næstu mínútu og gönguskref eru áætluð sem 100 skref á mínútu af heildargöngu. Ef mæting er sein er munurinn rúnnaður upp og merktur **Ath. X mín. seinn í vinnu**. Óþekkt koma er sýnd með striki.
- **Fjarlægja ferð.** `×` er bæði við hverja röð og á efsta spjaldi. Fyrir endurtekið plan hefur það aðeins áhrif á tiltekinn dag. Ferð hverfur sjálfkrafa við brottför samkvæmt besta tíma sem vafrinn hefur og stutt ábending birtist í 6,5 sekúndur. Gamlar dagsetningar eru hreinsaðar. Þegar engin viðeigandi ferð er eftir koma venjulegu brottfarirnar eða lok þjónustu aftur. Liðinn tími undir **Á fætur** eða **Út úr húsi** einn og sér fjarlægir ekki ferð.
- **Dæmi.** Þegar klukkan er 10:00 og 10:42 ferð á um fimm mínútna göngu að stoppi sýnir spjaldið **42:00**, **Út úr húsi 10:37** og **Á fætur 09:57**. Ferðin er áfram í boði fram að brottför.

### Veður, kort og útlitsstilling

- **Veður.** Á forsíðu fylgir spáin áætluðum brottfarartíma valinnar ferðar eða núverandi klukkustund ef engin ferð er valin í lifandi skjánum. Tíminn er rúnnaður niður í næsta heila klukkutíma. Spjaldið sýnir hita, skynhita undir **Með vindkælingu**, lægsta og hæsta hita dagsins, vind, hviður, úrkomulíkur og úrkomumagn. Við frostúrkomuspá eða samspil bleytu og kulda birtist hálkuábending. Spáin er falin á skjánum fyrir lok þjónustu þegar ekkert plan er sýnt. Síðan 25. nóv. er veðrið lítil flís (tákn, hiti, vindur og úrkoma í mm ef spáð er minnst 0,1 mm) í sömu línu og „Uppfært“. Ýtt er á hana til að opna lítið spjald með **Veður**, **Lægsti / hæsti hiti**, **Eins og** (skynhiti), **Hviður**, **Úrkoma** og **Kl.** Hvort spjaldið er opið er geymt í `localStorage` undir `i-vinnuna-weather-open`. Ef hálka er möguleg fær flísin rauðan ramma og orðið **Hálka**, og spjaldið sýnir **Líkur á hálku**.
- **Nándarkort fyrir leið 13.** Innbyggt SVG á lifandi forsíðu birtist síðustu tvær mínúturnar fyrir brottför á leið 13. Tákn vagnsins færist eftir SVG-línunni frá JL húsinu að Ásvallagötu í beinu hlutfalli við tímann sem eftir er. Landakot er merkt til viðmiðunar. `/?kort=prufa` sýnir kortadæmi með einni mínútu í brottför þegar lifandi brottfararsvæðið er sýnilegt. Myndin er áætluð framsetning út frá brottfarartíma. Uppruni götulínanna í SVG er ekki skjalfestur í verkefninu.
- **Útlit og tákn fyrir heimaskjá.** Sól og tungl skipta milli ljóss og dökks. Sjálfgefið fylgir kerfisstillingu. Val vistast og er samstillt milli flipa á sama uppruna. Manifest, favicon og Apple-touch tákn eru í útgáfunni. Manifestið notar `display: standalone` og `lang: is`.

## 3. Saga

| Tími | Breyting og ástæða |
|---|---|
| 21. nóv., `827aee1` → `4281ff9` | Byrjað á skjá fyrir eina stoppistöð og leið 13 með lifandi spá. Fyrsta útgáfan var með enskum texta og sýnishnappi. Næst bættust íslenskur skjár, komutími og varaleiðir við. Brottfarir voru skiptar milli forsíðu og **Á hraðferð?** til að halda daglega skjánum einföldum. |
| 21. nóv., `175f067` → `d983408` | GTFS-tímatafla og Python-innflutningur bættust við. Fyrst voru útbúnir brottfarartímar og síðan komutímar á endastopp í `3d4999b`. Þá varð hægt að bera lifandi spá saman við áætlun. Á sama degi komu þemaval, Archivo Black, manifest og þrjár útgáfur af táknaskrám. |
| 22. nóv., `a3ed203` → `d303dcb` | Bættust við merkingar um stöðu straums, síðustu uppfærslu, komuspá og útrunna tímaskrá, ásamt tengingu við heimferð. Staðbundið SVG-nándarkort var bætt við fyrir leið 13. |
| 23. nóv., `f3bc155` → `4278e2b` | **Undirbúa morguninn**, dagsplan og skjár þegar þjónustu lýkur urðu til. Endurtekið virkra daga plan bættist við í `0034dc8`. Listinn var þjappaður saman í ferðir í kringum mætingarmark með valkvæðum fyrri og seinni ferðum svo notandinn þyrfti ekki að lesa heilan þjónustudag. |
| 23. nóv., `d898b62`, `8d64cf8` | Veður í Vesturbæ bættist við, síðan hálkuábending. Tilgangurinn var að setja upplýsingar sem skipta máli fyrir gönguna við hlið ferðarinnar. |
| 24. nóv., `c241b1e`, `44a37e6`, `63af7e5` | Valdar ferðir fengu stærra spjald, göngu- og undirbúningstíma, sjálfvirka hreinsun og `×` fyrir afval. Flokkun og veðurkort með lág- og hámarkshita bættust við. Fyrsta flokkunarútfærslan gat breytt efstu ferð og valda röðin hvarf úr listanum. Það var lagað því notandinn vildi að röðin stæði kyrr. |
| 24. nóv., `49c6c12`, `3db401b`, `f368817` | Endurskipulagning spjalds, styttri flokkunarheiti, áætlaður skrefafjöldi og orðalagið **40 mín. til að gera sig til**. Sýnidæmi fyrir kl. 10:00 leiddi til núverandi morgunútlits þar sem aðeins brottför fær stóra niðurtalningu. |

Dagsetningar og röð koma úr Git-sögunni. Ástæður byggjast á samskiptum um hönnun þar sem þau liggja fyrir. Í Git eru margar færslur með heitinu `Update Site source`, svo heiti færslu eitt og sér segir lítið um breytinguna.

## 4. Gagnaveitur

| Gögn | Slóð, snið og tíðni |
|---|---|
| **Lifandi ferðaspá** | Vafrinn sendir `POST https://api.straeto.is/graphql` með `Content-Type: application/json` og beiðninni `BusLocationByStop(stopId: "...") { arrivals { arrival routeNr headsign trip { id } } }`. Eitt svar er sótt fyrir sex einstök stopp í sömu beiðni, með alias á borð við `s90000179`. `arrival` er tímastrengur `H:MM` eða `HH:MM:SS`; merkingin við upphafsstopp er brottför í appinu. Sótt við fyrstu hleðslu, á 30 sekúndna fresti meðan flipi sést, þegar flipi verður aftur sýnilegur og með ↻. Hámarksbið er 8 sekúndur. Eldri beiðni er stöðvuð við nýrri og úrelt svar er hunsað. |
| **Pökkuð tímaskrá** | `GET /timetable.json`, sótt á sama uppruna. `routes[leið][trip_id]` inniheldur færslur `[brottför í sekúndum frá miðnætti þjónustudags, service_id, koma í sekúndum eða null]`. `services[service_id]` inniheldur heiltöludaga frá Unix-upphafi. Birt skrá inniheldur líka `lastDay`. Heimaskjáir geyma skrána í minni eftir fyrstu heppnuðu sókn. Skipulagssíðan sækir hana einu sinni við hleðslu. |
| **GTFS-innflutningur** | `tools/update-timetable.py` sækir ZIP frá Strætó með 30 sekúndna tímamörkum eða les ZIP sem er gefið sem viðfang. Skriftan notar `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt` og `calendar_dates.txt`, les CSV með `utf-8-sig` og skrifar `dist/timetable.json`. Hún tekur með ferðir við rétt upphafsstopp, virðir bönn á upp- og úrstigi og leitar að fyrsta rétta endastoppi síðar í `stop_sequence`. Geymir færslu með `null` ef engin slík koma finnst. Engin sjálfvirk endurgerð tímaskrár sést í Git-pakkanum. [GTFS ZIP frá Strætó](https://opendata.straeto.is/data/gtfs/gtfs.zip) · [GTFS-staðall](https://gtfs.org/documentation/schedule/reference/) |
| **Veðurspá** | `GET https://api.open-meteo.com/v1/forecast` fyrir `64.147, -21.954`, `timezone=GMT`, `wind_speed_unit=ms`, `forecast_days=3`, `past_days=1`. JSON skilar `hourly` og `daily` með tímaröðum. Sækir hita, skynhita, vindhraða, hviður, úrkomulíkur, úrkomu, veðurkóða, dagsbirtu og lág-/hámarkshita. Uppfærir við birtingu ef 20 mínútur hafa liðið frá heppnaðri sókn og minnst 2 mínútur frá síðustu tilraun. Hámarksbið er 8 sekúndur. Gögn í minni eru notuð í allt að 90 mínútur ef klukkustundin sem þarf er til. [Open-Meteo API](https://open-meteo.com/en/docs) |

**Tímaskrá í útgáfu 44.** Nítján þjónustuauðkenni eru í skránni og dagsetningarnar í þeim spanna 19. nóvember 2026 til og með 1. janúar 2027. `lastDay=20819` jafngildir 1. janúar 2027. Þetta lýsir gögnunum í þessari útgáfu. Nýrri tímatöflur birtast aðeins eftir að skráin er uppfærð og birt.

**Vinnsla á lifandi tímum.** `buildTrips()` síar á leiðarnúmer og nákvæman `headsign` eftir `trim()`. Hún parar sókn frá upphafsstoppi og endastoppi eftir `trip.id`. Komutími er tekinn ef hann gefur innan við eða jafnt og tveggja klukkutíma ferð eftir miðnæturleiðréttingu. `scheduledTimes()` velur næstu áætlun með sama ferðakenni á virkum þjónustudegi í bilinu tvo daga aftur til eins dags fram fyrir spá, innan sex klukkutíma frá spátíma. Ef lifandi komutíma vantar, eða brottför seinkar og lifandi koma er enn á sömu mínútu og áætlun, færist áætluð koma um sama frávik og brottför og er merkt **≈**. Seinkun sýnir yfirstrikaðan áætlunartíma á lifandi skjá, eða textann **Átti að fara** á vistuðu spjaldi. Sekúndur geta birst ef mínúturnar eru þær sömu. Ábending um að mæta seint í vinnu er annar útreikningur.

**GraphQL-beiðnin í útgáfu 44.** Þetta er form strengsins `query` í JSON-póstinum, með línuskiptingum til læsileika.

```graphql
{
  s90000179: BusLocationByStop(stopId: "90000179") { arrivals { arrival routeNr headsign trip { id } } }
  s90000083: BusLocationByStop(stopId: "90000083") { arrivals { arrival routeNr headsign trip { id } } }
  s90000296: BusLocationByStop(stopId: "90000296") { arrivals { arrival routeNr headsign trip { id } } }
  s90000015: BusLocationByStop(stopId: "90000015") { arrivals { arrival routeNr headsign trip { id } } }
  s90000461: BusLocationByStop(stopId: "90000461") { arrivals { arrival routeNr headsign trip { id } } }
  s90000882: BusLocationByStop(stopId: "90000882") { arrivals { arrival routeNr headsign trip { id } } }
}
```

**Vinnsla veðurspár.** Hiti, skynhiti, vindhraði og ástand miðast við upphaf klukkustundar, en hviður, úrkomulíkur og úrkomumagn við lok hennar. Lág- og hámarkshiti miðast við dagsetningu upphafsins. Hálkureglan leitar að WMO-kóða 56, 57, 66 eða 67 í upphafi eða lok klukkustundar. Annars þarf úrkoma að ná 0,1 mm í einhverri færslu umrædds tíma eða allt að sex klukkustundum fyrir hann og hiti að vera 1 °C eða lægri við annað tímamarkið.

**Aðgangur og skilmálar.** Enginn API-lykill er í kóða og GraphQL-beiðnin fer beint frá vafra. Kóðinn staðfestir nákvæma slóð og beiðni. Ég fann ekki opinberan samning eða útgáfuábyrgð fyrir þetta GraphQL-snið. Opinber gögn aðgreina GTFS og rauntímagögn sem þarf að sækja um. Eldri vefurinn lýsir GPS-straumi á XML-formi. Nýr prófunarvefur vísar umsóknum fyrir höfuðborgarsvæðið til Swiftly og samþykkis ASHB. Áður en appið er boðið fleirum þarf að staðfesta hvaða aðgangur, notkunarmörk og tilvísunartexti eiga við um valinn straum. [Opin gögn Strætó](https://www.straeto.is/en/about-straeto/open-data) · [Eldri rauntímaskjöl](https://www.straeto.is/en/about-straeto/open-data/real-time-data) · [Nýrri upplýsingar hjá ASHB](https://beta.straeto.is/opin-rafraen-gogn)

## 5. Stoppistöðvar og leiðir

| Leið | Farið inn | Farið út | Nákvæmt `headsign` sem GraphQL er síað eftir |
|---|---|---|---|
| 13 | Ásvallagata · `90000179` | RÚV · `90000083` | `Sléttuvegur` |
| 1 | Háskóli Íslands B · `90000296` | Kringlumýrarbraut · `90000015` | `Hfj. Skarðshlíð` |
| 3 | Háskóli Íslands B · `90000296` | Kringlan · `90000461` | `Sel/Fell` |
| 6 | Háskóli Íslands C · `90000882` | Kringlan · `90000461` | `Egilshöll` |

**Leið 13 er notuð frá Vesturbæ til RÚV, í átt að Sléttuvegi.** Stopp `90000083` heitir RÚV í opinberu stoppaskránni og er endastopp appsins, jafnvel þótt Verzló hafi líka verið nefnt í umræðu um vinnuferðina. Opinber leið 13 liggur milli Eiðisgranda og Sléttuvegar. [Leið 13](https://beta.straeto.is/skipuleggja-ferd/akstursleidir/13) · [Ásvallagata](https://beta.straeto.is/skipuleggja-ferd/stoppistodvar/asvallagata) · [RÚV, ID 90000083](https://www.straeto.is/skipuleggja-ferd/stoppistodvar/90000083)

**Hvernig auðkennin voru fundin.** Elsta Git-útgáfan, `827aee1`, var þegar með `90000179` í fyrirspurninni. Hin stoppapörin sjást í `872b39b`, og nákvæmu áfangatextarnir í `4281ff9`. Vinnsluskriftan notar sömu stoppakenni til að para þau við GTFS-gögn. Ég get staðfest heiti fimm stoppanna beint á opinberum ID-síðum. Opinbera nafnasíðan staðfestir líka Ásvallagötu á leið 13, en nákvæma vörpun `90000179` tók ég úr núverandi kóða og Git-sögu. Fyrstu uppflettiaðferðina fyrir hvert ID, áður en það fór í Git, get ég ekki staðfest. Fyrir ný stopp skaltu staðfesta `stop_id` og stefnu í nýju `stops.txt`, staðfesta röð viðkomustaða í `stop_times.txt` og bera saman við `headsign` í lifandi svari. [HÍ B](https://www.straeto.is/skipuleggja-ferd/stoppistodvar/90000296) · [HÍ C](https://www.straeto.is/skipuleggja-ferd/stoppistodvar/90000882) · [Kringlan](https://www.straeto.is/skipuleggja-ferd/stoppistodvar/90000461) · [Kringlumýrarbraut](https://www.straeto.is/skipuleggja-ferd/stoppistodvar/90000015)

## 6. Mikilvægar ákvarðanir

| Ákvörðun | Ástæða eða afleiðing |
|---|---|
| Leið 13 fær forgang og HÍ-ferðir eru varakostir. | Sjálfgefna skjáinn má lesa strax, en samanburður er fáanlegur þegar venjulega ferðin hentar illa. |
| Tímatafla í verkefninu ásamt lifandi fyrirspurn. | Tímataflan gefur dagsetningar, möguleika fyrir morgundaginn og grunn fyrir samanburð við frávik. Lifandi svar leiðréttir þann grunn þegar hægt er að para ferðina. |
| Sérstök dagsvistun og endurtekið mynstur. | Dagsvistun geymir nákvæmar ferðir. Endurtekning leitar að sambærilegum brottfarartíma eftir leiðarnúmeri og mínútu, svo sama GTFS-ferðakenni þarf ekki að gilda alla daga. Að fjarlægja eina endurtekna ferð býr til frávik fyrir þann dag. |
| Ferðin helst í boði þar til vagninn fer. | Notandinn getur enn náð vagninum með styttri undirbúningi eða hraðari göngu. Liðinn uppvakningartími er ekki notaður sem brottfallsskilyrði. |
| Val og flokkun hafa sitthvort hlutverkið. | Val auðkennir röð í stað þess að færa hana. Flokkun breytir röð listans en varðveitir aðalferð. Fyrri útfærsla færði eða tók valda ferð úr listanum og var aflögð eftir prófun. |
| Ein stór niðurtalning í morgunham. | Brottför er aðalatriðið þegar tíminn er naumur. Fyrri spjaldskipan með stórri komu og lítilli niðurtalningu neðar var látin víkja í morgunham. |
| Staðbundið plan, fáar skráarháðir. | V1 er HTML, CSS og JavaScript með staðbundnu minni. Enginn byggingarferill er nauðsynlegur fyrir daglega breytingu á viðmóti. |

Eldri skjár með sýniferðum sést í fyrstu Git-útgáfunni en er ekki lengur í daglegu viðmóti. Kortasýnishornið `?kort=prufa` er áfram til. Sérstök síða fyrir vistað plan og botnstika voru útfærðar á hugmyndastigi í umræðu. Engin útgáfa af þeim fannst í birtum kóða.

## 7. Vandamál sem við leystum

- **Tímabelti og þjónustudagur.** `Intl.DateTimeFormat` notar `Atlantic/Reykjavik` og `h23`. Dagsreikningur er í UTC og byggir á að það samsvari íslenskum staðartíma. GTFS-tími yfir `24:00:00` tilheyrir enn upphaflegum þjónustudegi. Ekki breyta slíkum tímum í klukkutíma 0–23 áður en þjónustudagurinn er festur. Lifandi tímastrengir án dagsetningar fá sérstaka miðnæturleiðréttingu. [GTFS-staðall](https://gtfs.org/documentation/schedule/reference/)
- **Helgar og frídagar.** Grunnvikudagar koma úr `calendar.txt` og viðbætur og niðurfellingar úr `calendar_dates.txt`. Endurtekið plan reynir að finna sömu leið og mínútu í raunverulegri tímaskrá dagsins. Próf á pökkuðum gögnum sýndi ólíka byrjunardagsetta þjónustu á miðvikudegi, laugardegi og sunnudegi. Jóladagur 2026 er í skránni og fyrsta færsla þann dag er kl. 09:39. Þessi tími er lesinn úr útgáfu 44 og er ekki sjálfstæð, lifandi staðfesting á jólaáætlun.
- **Lok þjónustu og morgunskoðun eru tvö mörk.** `serviceState()` skoðar þjónustudagana í gær, í dag og á morgun og tekur með færslur eftir miðnætti. Gluggi hefst 30 mínútum fyrir fyrstu færslu og endar mínútu eftir þá síðustu. Lifandi ferð á næstu 30 mínútum getur haldið glugganum opnum utan áætlunar. Skiptitími spjaldsins er hins vegar fyrra af 06:00 og fyrstu færslu dagsins, áður en 30 mínútna forskot er dregið frá.
- **Seinkanir og hlutagögn.** Stefna og `trip.id` eru notuð til að forðast að blanda saman vögnum á sömu leið. Forsíða merkir bilun eða hlutagögn. Fyrir valda ferð í dag geymir flipinn samsvarandi síðustu lifandi spá í minni og notar annars vistaðan tíma. Forsíða og valin ferð hafa mismunandi varaleiðir við bilun, sbr. kafla 8.
- **CORS og samhliða beiðnir.** Enginn proxy er til í útgáfu 44. Strætó og Open-Meteo þurfa að samþykkja beinar beiðnir frá þeim vefuppruna sem hýsir appið. Ef ný hýsing virkar með `curl` en bilar í vafra skaltu skoða Network-flipann og `OPTIONS`-forspurn fyrir GraphQL JSON-beiðni. Ég get ekki staðfest að CORS-bilun hafi komið upp og verið löguð í núverandi verkefni. Kóðinn kemur hins vegar í veg fyrir að eldri beiðni skrifi yfir nýrra svar með `AbortController` og samanburði á beiðninni.
- **Stöðugleiki viðmóts.** Þegar valin röð endurteiknast er lyklaborðsfókus reyndur aftur á sama ferðakenni. Smellur á vistaða ferð uppfærir efsta spjald og valstöðu án þess að endurteikna röð listans. Upprunalegt val var prófað fram og til baka í vafra. Síðasta viðmótsbreyting var prófuð með hermdum tíma við 05:59:59 og 06:00 og niðurtalningu kl. 10:00. Tímapróf með hermdum gögnum staðfestu skiptitíma fyrir ferð fyrir kl. 06:00, eftir kl. 06:00 og án tímaskrár.

## 8. Þekktar villur og takmarkanir

| Atriði | Hvað þarf að hafa í huga |
|---|---|
| **Innflutningur sleppir `lastDay`.** | `tools/update-timetable.py` skilar `routes` og `services` en bætir ekki við `lastDay`. Seinasta birta JSON hefur reitinn. Endurgerð með núverandi skriftu myndi því taka út hluta af viðvörun um útrunna skrá. Setja þarf reitinn í framleiðsluna eða reikna gildissvið á lestrarhlið. |
| **Tímaskráin rennur út.** | Útgáfa 44 hefur síðasta þjónustudag 1. janúar 2027. Eftir það reiðir lifandi skjár sig áfram á lifandi spá, ný dagsvöl úr skránni tæmast og útrunninn tími getur birst í stöðutexta. Fyrirliggjandi dagsplan geymir snapshot og er ekki sjálfkrafa endurbyggt. |
| **Hluti af leið 6 hefur enga komu.** | Í pakkanum eru 460 af 925 ferðafærslum fyrir leið 6 með `null` í komureit. Skriftan tekur ferðir með leyfðu uppstigi á HÍ C og heldur þeim þótt hún finni enga síðari komu í Kringluna. Hún síar ekki statíska GTFS-ferð á `headsign`, ólíkt lifandi straumnum. Ekki gera ráð fyrir að hver færsla sé nýtileg HÍ–Kringlan ferð eða að allar séu á réttri stefnu. Nákvæm ástæða fyrir hverri `null`-færslu hefur ekki verið greind í frumgögnunum. |
| **Lifandi skjár fellur ekki yfir í heila áætlunartöflu.** | Við algjört GraphQL-rofnun getur venjulegi brottfararskjárinn tæmst þótt GTFS sé til. Pökkuð tímaskrá styður skipulag, vistuð plön, samanburð við áætlun og þjónustuglugga. Misheppnuð ný sókn getur skipt lifandi listanum út fyrir tómt svar. |
| **Niðurfellingar, tilfærslur og ný ferðakenni.** | Hvarf færslu úr straumi er ekki meðhöndlað sem staðfest niðurfelling. Vistað plan getur haldið áfram að sýna áætlaðan tíma. Pörun getur brugðist ef `headsign`, stefna eða `trip_id` breytast. Endurtekið plan krefst nákvæmrar mínútu og getur því misst af færslu sem færist lítillega í nýrri tímatöflu. |
| **Val lagar sig ekki að því þegar notandinn vaknar seint.** | Vefurinn mælir ekki hvort 40 mínútna undirbúningur og ganga komist lengur fyrir. Næsta sjálfgefna ferð er valin út frá brottför, ekki raunhæfum tíma til að ná henni. |
| **Takmörkuð virkni staðbundinnar geymslu og uppsetningar.** | Plan fylgir vafra, prófíl og vefuppruna. Nýr hýsingaruppruni fær sína eigin tómu geymslu. Vefurinn er með manifest en engan service worker, bakgrunnsvaka eða vekjaraklukkutíma. Sýnileikastýring stöðvar reglulegar uppfærslur þegar flipi sést ekki. |
| **Fastar forsendur um notanda, stopp og veður.** | Fastar 40 mínútur eru fyrir undirbúning. Skref, ganga og staðsetning á nærkorti eru áætlanir. Veðrið er fyrir fastan punkt í Vesturbæ og hálkuábendingin er einföld veðurregla, ekki mæling á gangstétt. Fasti áfangastaðurinn og nándarkort eru sértæk fyrir þessa uppsetningu. |
| **Minniháttar atriði í kóða.** | Varaspjöld á forsíðu búa til autt `.plan-mini` með `data-plan-countdown`; núverandi `updateSavedCountdown()` uppfærir aðeins niðurtalningu aðalferðar. `showDifference()` notar klukkusnið með textanum „mín“, sem getur verið óljóst fyrir lengri frávik. Textinn **Með vindkælingu** birtir almenna skynhitabreytuna `apparent_temperature`, sem notar fleiri þætti en vind einn. [Skýring Open-Meteo á skynhita](https://open-meteo.com/en/docs) |

Atriðin hér eru staðfest í kóða eða gögnum, eða merkt sem háð ytri aðgangi. Ég fann enga skráða sjálfvirka prófunarsvítu í útgáfu 44. Node-stafsetningarpróf á öllum JavaScript-skrám stóðust við þessa yfirferð. Núverandi CORS-hegðun undir nýjum GitHub Pages-vistuppruna hefur ekki verið prófuð.

## 9. Hönnun

- **Útlit.** Maxbreidd efnis er 960 px. Rúnnuð spjöld, stór talnagerð og lítil merki gera auðvelt að skanna síðu. Biðtími er sjónrænt fremst. Leiðarnúmer, áfangastaður og litur gefa saman samhengi.
- **Litakerfi.** Dökkur grunnur `#101d33`, spjöld `#192a46`, texti `#eff5ff` og áhersla `#a8d9ff`. Ljós grunnur `#edf4fd`, spjöld `#fcfdff`, texti `#172b48` og gulur aðalreitur `#fff4cb`. Stafamerki notar rauðan `#b52226` og gulan `#ffda24`. Leiðir 13/1/3/6 eru grænblá, rauð, gul og græn. Litakóðar leiða eru `#8de0e4`, `#c33e2d`, `#f3b721` og `#2b792c` í sömu röð. Veðurkort litar bakgrunn eftir ástandi spár.
- **Letur.** `Archivo Black` er geymt í `dist/fonts/archivo-black.ttf` með OFL-leyfi við hliðina. Það er notað í orðmerkið. Almennur texti er í kerfisleturgerð og tímar í jafnbreiðu kerfisletri. Klukkur eru 24 stunda og íslensk staðfærsla notuð. [Uppruni Archivo Black](https://github.com/Omnibus-Type/ArchivoBlack)
- **Sími og aðgengi.** CSS notar sveigjanlegar stærðir og brotpunkta sem setja efstu reiti í eina dálkaskipan og ferðaupplýsingar í færri dálka. Þema- og uppfærsluhnappar eru minnst 44 × 44 px. Hnappar hafa textamerkingar og `aria-pressed` þar sem við á, staða er tilkynnt með `role=status` og taflasvæði nota dálkahausa. Formleg úttekt á aðgengi eða hegðun í Safari á iOS er ekki skráð.
- **Tungumál.** Viðmótið er á íslensku, án tungumálavals. Stutt heiti á borð við **Brottför**, **Komu**, **Stoppistöð**, **Út úr húsi** og **Í vinnu** eru meðvituð. Stöðvarheitið getur verið brotið sjónrænt, til dæmis með mjúkum bandstriki í **Kringlumýrarbraut**. Leyfi og kóðaskýringar fylgja sínu upprunalega tungumáli.

## 10. Hugmyndir og óskir sem eru ekki komnar inn enn

1. **Sérsíða fyrir Mínar ferðir.** Eftir vistun fari notandinn á vistaða planið og geti áfram opnað lifandi brottfarir. Þegar síðasti vagn dagsins er farinn var rætt um að opna vistað plan sjálfkrafa ef það er til. Sama síða fari svo í niðurtalningu kl. 06:00, eða fyrr ef fyrsta þjónusta byrjar fyrr. Beinn smellur á **Brottfarir** á að virða vilja notandans, svo hann festist ekki í sjálfvirkri endurvísun. Vefurinn á að geta sýnt lok þjónustu og skipulagshnapp þegar plan vantar.
2. **Leiðsögn.** Rætt var um stöðuga botnstiku á síma með **Brottfarir** og **Mínar ferðir** og síðar **Leita**. **Undirbúa morguninn** og **Breyta plani** væru aðgerðir innan planasvæðis. Kort væri aðgengilegt úr leit og ferðaupplýsingum. Millistigið með tveimur flipum og aðskildri síðu var teiknað upp en hefur ekki verið birt.
3. **Sérsnið fyrir fleiri.** Leit að stoppum, að setja upp eigið heimili og vinnustað, vista uppáhaldsleiðir í báðar áttir og stilla undirbúningstíma. Gott fyrsta próf er hvort nýr notandi með önnur stopp geti fengið sama einfalda niðurtalningarskjá án hjálpar. Flytja þarf núverandi stillingar með sem fyrstu uppsetningu.
4. **Sameiginlegur bakendi og samstilling.** Sameiginleg sókn og skyndiminni fyrir áætlun og rauntíma, aldursmerkingar, útrunnin gögn, villuvöktun og gagnagrunnur fyrir plön hvers notanda. Almennur lestur og leit gæti verið án innskráningar, innskráning fyrir samstillingu. Sites Worker og D1 voru rædd sem möguleikar, án endanlegrar innleiðingar eða ákvörðunar um framtíðarhýsingu.
5. **Almenn ferðaleit og kort.** Höfuðborgarsvæðið fyrst. Nálæg stopp, akstursleið og síðan raunveruleg vagnastaðsetning ef viðeigandi straumur fæst. Heimilisfangaleit, ganga og skiptingar, **fara núna** eða **mæta fyrir**, og tilkynningar um truflanir. OpenTripPlanner og MapLibre voru rædd til skoðunar. Í fyrstu almennu útgáfunni var ráðlagt að greiðslur færu áfram fram í Klapp. [OpenTripPlanner](https://docs.opentripplanner.org/en/latest/) · [MapLibre](https://maplibre.org/maplibre-gl-js/docs/) · [Klapp og greiðslur](https://www.straeto.is/en/user-information/ticketing-information)

## 11. Hýsing

**Núna.** ChatGPT Sites birtir staðbundnar skrár úr `dist/` samkvæmt `.openai/hosting.json`. Aðgangsstillingin var staðfest sem sérsniðin með eiganda einum. Innskráning og aðgangur eru á hýsingarstigi. Appkóðinn sjálfur inniheldur ekki aðgangsstýringu eða notendagagnagrunn. [Í vinnuna](https://aribus-13-asvallagata.modernjuice4.chatgpt.site/)

| Skrár | Hlutverk |
|---|---|
| `dist/index.html`, `dist/a-hradferd/index.html`, `dist/undirbua-morguninn/index.html` | Þrír HTML-inngangar. Mínar ferðir eru hluti af fyrsta inngangi. |
| `dist/app.js`, `dist/commute-status.js` | Lifandi beiðnir, þjónustumörk, niðurtalning, val, birting og stöðutexti. |
| `dist/morning-plan.js`, `dist/undirbua-morguninn/planner.js` | Sameiginlegir útreikningar, lestur og vistun, ásamt skipulagsformi. |
| `dist/commute-weather.js`, `dist/theme.js` og CSS-skrárnar | Veðurkort, útlitsval og móttækileg hönnun. |
| `dist/timetable.json`, `tools/update-timetable.py` | Síðast birt tímaskrá og staðbundinn GTFS-innflutningur. Skriftan er Git-skrá og er utan birtingarmöppu. |
| `dist/manifest.webmanifest`, `dist/icons/`, `dist/favicon.ico`, `dist/fonts/` | Manifest, tákn og sjálfhýst letur með leyfisskrá. |

**Keyra og uppfæra.** Keyrið HTTP-þjón í rót Git-verkefnisins með `python3 -m http.server 8000 --directory dist` og opnið `http://localhost:8000/`. Vefurinn þarf HTTP(S)-uppruna svo JSON og undirsíður finnist. Enginn npm-pakki, þýðing eða forritsþjónn er nauðsynlegur fyrir þessa útgáfu. Til að endurgera tímaskrá er skipunin `python3 tools/update-timetable.py` eða `python3 tools/update-timetable.py /slod/ad/gtfs.zip`. Athugið `lastDay` áður en endurgerð skrá er birt. Núverandi Sites-ferill er að ýta staðfestu Git-commit með réttri hýsingarskrá, vista samsvarandi vefútgáfu og birta hana með aðgangsstillingu staðarins. `dist/` er keyrsluefnið og `tools/` er fyrir viðhald.

**Við GitHub-flutning.** ZIP-pakkinn úr útflutningi v44 inniheldur allar 24 skrár með möppuskipan. Hann er skyndimynd. Til að halda Git-sögu þarf að flytja hana úr upprunalega Git-verkefninu. Nákvæma útflutningsskráin heitir `i-vinnuna-v44.zip`. Hægt er að birta `dist/` sem útgáfugagn í GitHub Actions eða hýsa það á öðrum static-þjóni. Ef slóðin verður `https://notandi.github.io/verkefni/` þarf að laga allar rótartengdar slóðir, til dæmis `/app.js`, `/timetable.json`, `/a-hradferd/`, manifest, tákn og CSS-letur. Undirmöppuflutningur og nýr vefuppruni kalla einnig á prófun á CORS og ákvörðun um aðgangsstýringu og flutning vistaðra plana. GitHub Pages hefur sínar aðgangsstillingar og taka þær ekki sjálfkrafa við stillingum Sites. [GitHub Pages: birtingaruppspretta](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
