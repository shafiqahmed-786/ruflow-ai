# Techninių specifikacijų vietinis tikrintuvas (macOS)

Autonominis macOS įrankis, skirtas nuskaityti specifikacijų nuorodas iš `~/Desktop/TS_nuorodos.xlsx`, atsisiųsti viešus PDF/DOCX dokumentus, palyginti aiškiai įvardytus skaitinius parametrus su `~/Desktop/Katalogai/` katalogais ir parengti Excel/PDF ataskaitas. Apple Silicon Mac (įskaitant M5 su 16 GB Unified Memory) naudoja pasirenkamą vietinį Ollama `qwen3.5:4b` modelį, `num_ctx=8192`, vienu metu vieną analizės užklausą. Nėra mokamo AI API, debesijos modelio ar API raktų. Be Ollama dokumentų parsisiuntimas, taisyklėmis grįsta analizė ir ataskaitos veikia toliau.

Šiame repo įrankis laikomas atskirame `technical-specifications/` kataloge; esama RuFlow aplikacija nekeičiama.

## Kas veikia

- Excel nuorodų ir hipersaitų nuskaitymas; HTTP/HTTPS puslapių paieška į viešus PDF/DOCX failus per `requests` ir `BeautifulSoup`. Jei nuorodų statiniame HTML nėra, pasirenkamas Playwright Chromium gali įvykdyti JavaScript ir perskaityti sugeneruotas nuorodas.
- PDF teksto ir DOCX teksto / lentelių nuskaitymas; skenuotiems PDF puslapiams pasirenkamas Tesseract OCR su PyMuPDF.
- Skaitinių `min`, `max`, tikslių ir intervalinių apribojimų palyginimas, kai reikalavimo bei katalogo eilutėse aiškiai nurodytas tas pats parametras ir suderinami vienetai.
- SHA-256 turinio talpykla SQLite duomenų bazėje: nepakitęs failas iš naujo neanalizuojamas. Pakeistas turinys gauna naują analizės įrašą.
- Vietinė Ollama analizė reikalavimų ir katalogo puslapių citatoms ištraukti. PDF puslapiai skaidomi į iki 4 puslapių / 18 000 ženklų dalis; kiekvienoje užduotyje saugomas šaltinis, turinio SHA-256 ir PDF puslapių numeriai. Ollama grąžina tik pažodinę citatą ir puslapį. Python patikrina, kad citata tiksliai randama tam pačiam originaliam puslapyje; modelio sukurtos reikšmės, ryšiai ar puslapiai atmetami. Galutinį skaitinį palyginimą atlieka Python taisyklės.
- AI eilė saugoma SQLite: Ollama pasiekiamumo, HTTP, JSON ar citatos patikros klaidos darbą palieka `pending` būsenoje su bandymų skaičiumi, klaida ir didėjančiu pakartojimo laukimo laiku. Dokumentų parsisiuntimas, taisyklinė analizė ir ataskaitų generavimas tęsiami. Nauji darbai deduplikuojami pagal šaltinį, dokumento SHA-256, rolę, dalį ir prompto versiją.
- Atskiru `flock` užraktu ir proceso semaforu užtikrinama, kad vienu metu būtų vykdoma tik viena Ollama užklausa net keliuose to paties projekto procesuose. Ollama endpoint leidžiamas tik localhost.
- Viešos DuckDuckGo paieškos užklausos ir rezultatų 24 val. talpykla; iki penkių paieškos rezultatų puslapių gali būti tikrinama dėl viešų PDF/DOCX katalogų. Atskirai ieškoma kataloguose aiškiai įvardytų modelių gamintojų ir tiekėjų. Kai viešas produkto puslapis JSON-LD struktūroje nurodo konkretų modelį ir `manufacturer` arba `offers.seller`, ataskaitoje atskirai pateikiamas gamintojo arba tiekėjo **kandidatas**, šaltinio URL ir susiję struktūriniai duomenys. Šalis, svetainė ir kontaktai pateikiami tik tiesiogiai pateikti to paties įrašo duomenyse.
- Excel ataskaitoje sukuriami lapai: **Suvestinė**, **Techniniai reikalavimai**, **Gamintojai ir modeliai**, **Tiekėjai ir kontaktai**, **Atitikties matrica**, **PDF įrodymų nuorodos**, **Neatitikimai**, **Tikrinimo istorija**.
- Atskiras specifikacijos PDF komentarų egzempliorius ir parinktų katalogų PDF įrodymų puslapių rinkinys. Originalūs failai nekeičiami.
- Paleidimo užraktas neleis dviem to paties projekto procesams dirbti vienu metu; launchd pavėluotą po miego paleidimą praleidžia, jei vietos laikas nėra vienas iš leistinų laikų.

## Svarbios tikslumo ribos

Šis MVP **nepatvirtina pirkimo atitikties automatiškai**. Reikalavimų ištraukimas iš laisvo teksto yra kandidatinis; neaiškūs reikalavimai ir nerasti įrodymai pažymimi **REIKIA PATIKRINTI**. Parametro pavadinimas privalo aiškiai sutapti šaltinio eilutėje, kad skaitinis įrodymas būtų lyginamas; vien raktažodžių atitikmuo netinka. Nepalaikomos vienetų poros taip pat grąžina žmogaus patikros būseną.

Internetinės paieškos ištraukos ar JSON-LD neįrodo, kad puslapis oficialus, kad įmonė tiekia konkretų modelį ar kad nurodyti kontaktai aktualūs. Todėl visi rasti gamintojo ir tiekėjo ryšiai, šalys bei kontaktai pažymėti **KANDIDATAS – REIKIA PATIKRINTI**; žmogus turi juos patikrinti oficialiame šaltinyje. Duomenų, kurių produkto įraše nėra, įrankis neatspėja. Paieškos rezultatams be patikrinamo modelio ir vaidmens ryšio nurodoma „Nežinoma“. Jei iš specifikacijos teksto nepavyksta ištraukti reikalavimų, ataskaita parengiama su pastaba; tai nėra „atitinka“ rezultatas.

PDF puslapio numeris yra PDF puslapio eilės numeris, o ne visada spausdintas puslapio numeris. Vaizdo OCR priklauso nuo įdiegtų Tesseract kalbų; OCR duomenys nelaikomi automatiniu atitikties įrodymu. Dokumentuose su keliais modeliais modelio ir reikšmės ryšys taip pat turi būti patikrintas žmogaus. OCR ir tekstinė paieška nepakeičia originalo rankinės peržiūros.

Dinaminiai puslapiai apdorojami tik jei `playwright_enabled: true` ir yra įdiegtas Chromium. Nėra prisijungimo, CAPTCHA apėjimo, mygtukų spaudinėjimo ar neriboto laukimo; Playwright paleidžiamas tik neradus statinių nuorodų arba produkto kandidatų. Modelių įmonių paieška atpažįsta aiškiai įvardytus modelius, paprastus JSON-LD produkto ryšius ir aiškias puslapio žymas „Gamintojas:“ / „Tiekėjas:“ (ar anglų atitikmenis). Žymos ir modelio paminėjimas tame pačiame puslapyje nėra jų tarpusavio ryšio įrodymas ir visada lieka nepatvirtintas kandidatas. Kitais formatais pateiktos įmonės gali būti praleistos. Paieškos rezultatų nebuvimas nereiškia, kad gamintojų ar tiekėjų nėra.

## Diegimas

1. Naudokite macOS ir Python 3.9 ar naujesnį (`python3 --version`). Įrankis naudoja macOS `launchd`; Windows scenarijų ar kelių nėra.
2. Suteikite Terminal/iTerm arba naudojamam Python/LaunchAgent procesui prieigą prie **Desktop**: **System Settings → Privacy & Security → Files and Folders**. Jei Desktop sinchronizuojamas per iCloud Drive, palaukite, kol `TS_nuorodos.xlsx` ir failai atsisiųs lokaliai; failų prieinamumas gali priklausyti nuo iCloud būsenos.
3. Sukurkite `~/Desktop/Katalogai/` ir įdėkite teisėtai naudoti leidžiamus PDF/DOCX gamintojų katalogus.
4. Sukurkite `~/Desktop/TS_nuorodos.xlsx`; viename ar daugiau lapų įrašykite viešas HTTPS/HTTP nuorodas į specifikacijas arba puslapius, kuriuose yra PDF/DOCX nuorodos. Nuoroda gali būti langelio tekstas arba hipersaitas.
5. Terminale pereikite į `technical-specifications/` ir vykdykite:

   ```sh
   ./install.sh
   ```

   Diegiklis sukuria vietinę `.venv`, įdiegia Python paketus ir Playwright Chromium, tada įrašo ir įjungia naudotojo LaunchAgent į `~/Library/LaunchAgents/`. Jokie slapti raktai nekonfigūruojami. Jei norite tik rankinio naudojimo be LaunchAgent, vietoj diegiklio atlikite:

   ```sh
   python3 -m venv .venv
   .venv/bin/python -m pip install -r requirements.txt
   .venv/bin/python -m playwright install chromium
   ```

Jei reikia skenuotų dokumentų OCR, įdiekite Tesseract iš patikimo šaltinio (pvz. `brew install tesseract`) ir patikrinkite, ar prieinami reikalingi kalbų duomenys. OCR priklausomybės jau nurodytos `requirements.txt`; jei Tesseract nėra arba trūksta kalbos paketo, ataskaitoje įrašoma konkreti klaida, o ne tyliai apsimetama, kad puslapis buvo perskaitytas. `urllib3` apribotas iki v1, kad būtų suderinamas ir su Apple pateikiamu Python, susietu su LibreSSL.

### Vietinis Ollama (pasirenkamas, nemokamas vykdymo metu)

Ollama įrankis neįdiegia ir nepaleidžia Ollama pats. Jei naudotojas pats pasirenka ją įdiegti, įdiegia Ollama programą savo macOS įprastu būdu, atskirame Terminal lange paleidžia Ollama serverį, tada atsisiunčia modelį:

```sh
ollama pull qwen3.5:4b
ollama list
```

`config.yaml` nurodo tik `http://127.0.0.1:11434`, modelį `qwen3.5:4b`, `num_ctx: 8192` ir vienos užklausos eilę. Jokie nuotoliniai Ollama/AI serveriai neleidžiami. Modelio atsisiuntimas naudoja vietinę disko vietą ir internetą; po atsisiuntimo kasdienis inferencijos vykdymas vietinis ir nemokamas. Jei Ollama neveikia, SQLite AI darbų eilė lieka patvari ir tikrinimas tęsia darbą be AI. Žmogus gali išjungti Ollama konfigūracijoje nustatydamas `ollama.enabled: false`.

## Paleidimas ir tikrinimas

```sh
./run.sh                         # vienas rankinis tikrinimas
./run.sh --demo                  # neprisijungusi demonstracija
./run.sh --demo --output-dir /tmp/ts-demo
./.venv/bin/python -m pytest -q  # tiksliniai testai
```

Numatyti rezultatai: `~/Desktop/TS_rezultatai/`. SQLite būsena ir parsisiųsti failai: projekto `data/` kataloge. `--demo` sugeneruoja pavyzdinę specifikaciją, katalogą ir ataskaitas išgalvotais bandymo duomenimis, neatlieka interneto užklausų ir nekeičia Desktop failų.

## LaunchAgent grafikas

LaunchAgent tikrina kasdien kas 10 minučių per **08:00–08:50, 12:00–12:50 ir 16:00–16:50** (iš viso 18 laikų) pagal Mac vietinę laiko juostą. Po miego paleistas launchd įvykis už šių tikslių minučių ribų iškart nutraukiamas; praleisti tikrinimai neatkuriami. Bendras proceso užraktas apsaugo nuo sutampančių rankinių ir suplanuotų paleidimų, o atskiras AI užraktas — nuo lygiagrečių modelio užklausų.

```sh
launchctl print gui/$(id -u)/com.ruflow.ts-monitor
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.ruflow.ts-monitor.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ruflow.ts-monitor.plist
```

Žurnalai: `technical-specifications/data/logs/launchd.log` ir `launchd-error.log`. Norėdami išjungti planavimą, vykdykite `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.ruflow.ts-monitor.plist`; plist failą galima palikti. Norėdami pašalinti LaunchAgent failą, pirmiausia jį iškraukite, tada pašalinkite tik šį plist.

## Konfigūracija ir duomenų naudojimas

`config.yaml` nustato Desktop kelius, 18 laikų tvarkaraštį, HTTP timeout, Ollama modelį ir analizės eilės ribas. `web_search_enabled: false` išjungia DuckDuckGo užklausas; `model_search_enabled: false` išjungia tik modelių įmonių paiešką; `playwright_enabled: false` išjungia dinaminį Chromium atsarginį kelią; `ollama.enabled: false` išjungia modelį, bet nekeičia taisyklinės analizės. Pagal nutylėjimą per vieną vykdymą ieškoma daugiausia 3 modelių, kiekvienam nagrinėjami iki 4 paieškos rezultatų puslapių (`max_models_per_run`, `max_model_pages_per_model`). Jei Chromium ar puslapis nepasiekiamas, klaida įtraukiama į ataskaitos pastabas; kiti dokumentai vis tiek apdorojami. Internetas reikalingas nuotoliniams šaltiniams/modelio atsisiuntimui, tačiau sistema nesikreipia į mokamus API ar debesų AI.

Playwright vykdo viešo puslapio JavaScript atskirame laikiname naršyklės kontekste, leidžia tik GET/HEAD užklausas ir blokuoja privačius tinklo adresus, WebSocket ir service workers. DNS tikrinimas prieš užklausą nėra tinklo ugniasienės pakaitalas; nepatikimose aplinkose naudokite atskirą tinklo izoliaciją.

Naudokite tik viešai teisėtai pasiekiamus failus. Prieš automatizuodami svetainės parsisiuntimą patikrinkite jos naudojimo sąlygas, robots.txt, autorių teises, atsisiuntimo apribojimus ir asmens duomenų tvarkymo reikalavimus. Įrankis nenaudoja prisijungimo apeidinėjimo, CAPTCHA apėjimo ar uždarų svetainių duomenų.

## Paleidimo patikros sąrašas

- `./.venv/bin/python -m pytest -q` — apribojimų palyginimai, 18 laikų grafikas, procesų/AI užraktai, SHA-256 ir eilės deduplikavimas, Ollama imitacija/gedimai, įrodymų citatos bei Excel hipersaitai.
- `./run.sh --demo --output-dir /tmp/ts-demo` — patikrinkite, kad sugeneruoti `.xlsx`, komentarų `.pdf` ir katalogo įrodymų `.pdf`.
- `launchctl print gui/$(id -u)/com.ruflow.ts-monitor` — patikrinkite, kad naudotojo LaunchAgent užregistruotas.
- Patikrinkite, kad `~/Desktop/TS_rezultatai/` gali būti rašomas ir iCloud Desktop failai yra lokaliai prieinami.
