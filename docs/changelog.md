# RiffRush — Changelog

Format: `[data] Krótki opis zmiany — pliki których dotyczy`

---

## 2026-03-26 (8)

### Gameplay UI — 6-strunowa autostrada nut (multi-lane highway)

**Problem:**
Poprzedni ekran gry miał jeden poziomy pas z nutami opatrzonymi etykietą "str X". Gracz nie wiedział intuicyjnie, co i na której strunie zagrać — UI nie przypominało gitarowego neck view ani tabulatury.

**Rozwiązanie:**
Autostrada nut podzielona na 6 torów — po jednym na każdą strunę gitary (1 = wysokie e, 6 = niskie E). Każda struna ma własny kolor (zgodny z konwencją Rock Band / Rocksmith), a nuty umieszczane są dokładnie w torze odpowiadającym ich strunie. Etykiety strun (e, B, G, D, A, E) widoczne jako stała kolumna po lewej stronie.

**Zmiany wizualne:**

| Poprzednio | Teraz |
|---|---|
| Jeden pas, wys. 88 px | 6 torów, wys. 216 px (6 × 36 px) |
| Nuty wyśrodkowane pionowo | Nuty w torze swojej struny |
| Etykieta "str X" na każdej nucie | Kolor i pozycja toru wystarczą |
| Jednolity kolor (pomarańczowy) | Struna 1: żółty · 2: fiolet · 3: cyjan · 4: zielony · 5: pomarańcz · 6: czerwony |

**Szczegóły implementacji:**

Kolory strun zdefiniowane przez CSS custom property `--s-hue` — jedno źródło prawdy dla toru i nuty:
```
String 1 (e) → hue 52  (żółty)
String 2 (B) → hue 280 (fiolet)
String 3 (G) → hue 195 (cyjan)
String 4 (D) → hue 130 (zielony)
String 5 (A) → hue 22  (pomarańczowy)
String 6 (E) → hue 0   (czerwony)
```

- `apps/web/public/index.html` — dodano `.gameplay-string-labels` (6 divów z nazwami strun) i `.gameplay-lane-track` (6 divów tła torów) wewnątrz `#gameplay-highway`
- `apps/web/public/styles.css` — `gameplay-highway-wrap` zmieniony na flex; nowe reguły: `.gameplay-string-labels`, `.gameplay-string-label`, `.gameplay-lane-track`, `.gameplay-lane`; `.gameplay-note` — usunięto `top: 50% / translateY`, dodano dziedziczenie `--s-hue`; `is-hit` — zielony glow; `is-miss` — wygaszony czerwony
- `apps/web/public/app.js` — nowe stałe: `LANE_HEIGHT_PX = 36`, `NOTE_LANE_PADDING_PX = 3`, `STRING_NAMES`, `STRING_HUES`; `createNoteElement` — `top` / `height` obliczane z `stringNumber`, `--s-hue` ustawiane inline przez `setProperty`, usunięty element "str X"

**Testy:** `smoke:web` (pass), `smoke:backend` (pass), `smoke:vertical` (pass), `build:web` (340 ms, 42 kB gzip)

---

## 2026-03-26 (7)

### CI/CD, git init, admin seed — infrastruktura deweloperska

**Konto admina do testowania:**

| Pole | Wartość |
|------|---------|
| Email | `admin@riffrush.local` |
| Hasło | `admin` |

```bash
npm run seed:admin   # tworzy konto w lokalnej bazie; bezpieczny re-run (idempotent)
```

Hasło "admin" ma 5 znaków (mniej niż minimalne 8 dla nowych kont), ale `AuthService.login()` nie sprawdza długości przy logowaniu — seed działa bezpośrednio przez `SqliteUserRepository.createWithCredentials` + `hashPassword` (scrypt), pomijając walidację rejestracji.

**CI/CD — GitHub Actions:**

Workflow `.github/workflows/ci.yml` uruchamia się przy każdym push i pull request:

```
Job: smoke-tests (ubuntu-latest)
  → actions/checkout@v4
  → actions/setup-node@v4 (Node 22 + npm cache)
  → npm ci
  → smoke:backend
  → smoke:auth
  → smoke:web
  → smoke:vertical

Job: build-web (depends on smoke-tests)
  → vite build
  → upload-artifact apps/web/dist/ (retention: 7 dni)
```

Wszystkie smoke testy działają na portach efemerycznych (port 0) — żadnych wymagań infrastrukturalnych na CI.

**Git — initial commit:**
- `git init` w katalogu projektu
- `.gitignore` — zaktualizowany o `apps/backend/storage/`, `*.sqlite*`, `apps/engine/*.exe`, `riffrush-vertical-*/`
- `.gitattributes` — `* text=auto eol=lf` eliminuje ostrzeżenia CRLF na Windows
- Initial commit: 92 pliki, 39 653 linii

**Nowe pliki:**
- `apps/backend/scripts/seed-admin.js` — seed konta admin
- `.github/workflows/ci.yml` — GitHub Actions CI pipeline
- `.gitattributes` — normalizacja końców linii

**Zmodyfikowane pliki:**
- `package.json` (root) — dodano `seed:admin`
- `.gitignore` — rozszerzono o wpisy specyficzne dla projektu

**Testy:** `smoke:backend` (pass), `smoke:auth` (pass), `smoke:web` (pass), `smoke:vertical` (pass)

---

## 2026-03-26 (6)

### Build system frontendu — Vite 6 bundler i minifikacja produkcyjna

**Problem:**
Plik `apps/web/public/app.js` (~8300 linii) był serwowany bezpośrednio do przeglądarki bez żadnego przetwarzania — brak minifikacji, brak tree-shakingu, brak sourcemapy dla błędów produkcyjnych.

**Rozwiązanie:**
Dodano Vite 6 jako bundler produkcyjny. Jeden polecenie (`npm run build:web`) generuje zoptymalizowany bundle gotowy do deploymentu. Dev server z HMR dostępny jako `npm run dev:web`.

**Wyniki builda:**
| Plik | Rozmiar | Gzip |
|------|---------|------|
| `dist/index.html` | 30.82 kB | 5.34 kB |
| `dist/assets/index-[hash].css` | 35.15 kB | 6.61 kB |
| `dist/assets/index-[hash].js` | 180.76 kB | **41.94 kB** |
| sourcemap JS | 470.53 kB | — |

Czas builda: 351 ms. Transfer JS w przeglądarce: ~42 kB gzip (przy surowym pliku byłoby ~300+ kB).

**Nowe pliki:**
- `apps/web/vite.config.js` — konfiguracja Vite: `root: "public"`, `outDir: "../dist"`, `minify: "esbuild"`, `sourcemap: true`; dev server i preview na porcie 4173

**Zmodyfikowane pliki:**
- `apps/web/package.json` — dodano `vite ^6.0.0` do `devDependencies`; nowe skrypty: `build` (vite build), `preview` (vite preview), `dev:static` (stary serwer statyczny zachowany); `dev` zmieniony na Vite dev server z HMR
- `package.json` (root) — `dev:web` teraz uruchamia Vite przez workspace; dodano `dev:web:static` (stary serwer) i `build:web` (produkcyjny build)

**Uwagi deploymentowe:**
- `apps/web/dist/` należy dodać do `.gitignore` gdy repo zostanie zainicjalizowane
- `npm run smoke:web` testuje surowe pliki źródłowe (przez `static-server.js`) — nie zależy od builda; testy przeszły bez zmian

**Testy:** `smoke:web` (pass), `smoke:backend` (pass), `smoke:auth` (pass), `smoke:vertical` (pass)

---

## 2026-03-26 (5)

### Telemetria / crash reporting — automatyczne zbieranie błędów JS

**Problem:**
Błędy w przeglądarce były ciche — nie wiedziałeś, że coś się posypało, dopóki użytkownik sam nie zgłosił.

**Rozwiązanie:**
Zaimplementowano pełen pipeline telemetrii: globalny handler błędów w przeglądarce → REST endpoint → SQLite. Błędy są zbierane automatycznie bez żadnej akcji ze strony użytkownika.

**Backend — nowa tabela i endpoint:**
- SQLite migration v7 (`telemetry_events`) — tabela z indeksami po `created_at` i `user_id`; retencja automatycznie ograniczona do 500 najnowszych wpisów
- `POST /telemetry/events` — przyjmuje raporty z przeglądarki; waliduje `eventType` (`js-error` | `unhandled-rejection` | `manual-report`) i `message`; zapisuje `stack`, `url`, `user_agent`, `appContext`; obcina długie pola (message: 2000 znaków, stack: 8000 znaków)
- `GET /telemetry/events` — stronicowana lista zdarzeń (domyślnie 50, max 200); zwraca `total`, `limit`, `offset`
- Oba endpointy zwracają 501 gdy `telemetryRepository` nie jest skonfigurowane (np. w testach jednostkowych)

**Nowe pliki:**
- `apps/backend/src/repositories/sqlite-telemetry-repository.js` — `SqliteTelemetryRepository` z metodami `insert`, `list`, `count`; automatyczny pruning do MAX_RETAINED_EVENTS

**Zmodyfikowane pliki:**
- `apps/backend/src/persistence/sqlite-migrations.js` — SQLITE_SCHEMA_VERSION: 6 → 7; dodano migration v7
- `apps/backend/src/persistence/create-persistent-dependencies.js` — wstrzyknięto `SqliteTelemetryRepository` do zależności produkcyjnych
- `apps/backend/src/create-app.js` — stała `TELEMETRY_EVENT_TYPES`; opcjonalny `telemetryRepository` w `createApp`; dwie nowe trasy telemetryczne

**Frontend (`apps/web/public/app.js`):**
- `reportTelemetryEvent(eventType, message, extra)` — debouncing per klucz `eventType:message` (okno 5 sekund); używa `navigator.sendBeacon` gdy dostępny (przeżywa zamknięcie karty), fallback na `fetch` z timeout 3 s; dołącza `userId`, `backendUrl`, `engineUrl`, `pathname` jako `appContext`
- `window.onerror` — wyłapuje nieobsłużone błędy synchroniczne
- `window.addEventListener("unhandledrejection")` — wyłapuje odrzucone Promise

**Testy (`apps/backend/scripts/smoke-test.js`):**
- 501 na `POST /telemetry/events` bez skonfigurowanego repository
- 501 na `GET /telemetry/events` bez skonfigurowanego repository
- 400 na brakujące/nieznane `eventType` i brakujące `message`
- 201 na prawidłowy event z pełnymi polami
- 200 na listę eventów z poprawną kolejnością (najnowsze pierwsze) i paginacją

**Testy:** `smoke:backend` (pass), `smoke:auth` (pass), `smoke:vertical` (pass)

---

## 2026-03-26 (4)

### Więcej contentu — 6 nowych ćwiczeń, rozszerzony graf odblokowań

**Problem:**
Katalog zawierał wyłącznie 3 ćwiczenia (exercise-001/002/003) — za mało, żeby nowy użytkownik poczuł progres lub znalazł coś odpowiedniego do swojego poziomu.

**Rozwiązanie:**
Dodano 6 nowych treningów pokrywających pełne spektrum materiału MVP: od spokojnych ćwiczeń dla absolutnych początkujących przez skalę docelową po zaawansowane przebiegi szesnastkowe. Graf odblokowań rozszerzono z łańcucha liniowego do drzewa z 3 gałęziami.

**Nowe ćwiczenia (engine + backend, łącznie 9 treningów):**

| ID | Tytuł | Poziom | BPM | Technika |
|---|---|---|---|---|
| training-004 | First Pentatonic Steps | beginner | 72 | Am pentatonic box 1 — ascending, quarter notes |
| training-005 | Pentatonic Reverse | beginner | 80 | Am pentatonic box 1 — descending + resolve |
| training-006 | Major Triad Arpeggio | intermediate | 90 | C major arpeggio up & down, 3-string jump |
| training-007 | Low String Groove | intermediate | 85 | A–D–E roots na strunach 4–5 |
| training-008 | A Natural Minor Scale | intermediate | 92 | Pełna skala A minor, 15 nut, 8 beats |
| training-009 | Pentatonic Speed Run | advanced | 130 | Am pentatonic 16th-note burst up & down |

**Nowy graf odblokowań:**
```
training-001 (root) ─→ training-003 ─→ training-002 ─→ training-006
                    │               └→ training-008
                    └→ training-004 ─→ training-005
training-007 ← training-002
training-009 ← training-007
```

**Zmodyfikowane pliki:**
- `apps/engine/src/audio/training-catalog.js` — dodano exercise-004…009 z pełnymi definicjami (sekcje, eventy, lead-in)
- `apps/backend/src/data/trainings.js` — dodano 6 nowych wpisów (chart, targetSequence, contentGraph); rozszerzono `unlocks` dla training-001 (`+training-004`), training-002 (`+training-006, +training-007`), training-003 (`+training-008`)

**Poprawka systemu rekomendacji (`apps/backend/src/services/user-service.js`):**
- `buildTargetedPracticeRecommendation` — dodano filtrowanie `trainings` do odblokowanych przez użytkownika przed przekazaniem do funkcji sub-rekomendacji; zapobiega to sugerowaniu zablokowanych treningów jako celów promocji
- `selectPromotionGraduationTarget` — zmieniono warunek `>=` na `>` (tylko treningi TRUDNIEJSZE, nie tej samej trudności); zapobiega traktowaniu bocznych intermediate ćwiczeń jako celów graduacji
- `selectTerminalMasteryGraduationTarget` — ta sama poprawka `>=` → `>` dla spójności

**Poprawka testów (`apps/backend/scripts/smoke-test.js`):**
- `lockedTrainingCount` dla nowego użytkownika: 2 → 8
- `unlockTransition.unlockedTrainingCount` po ukończeniu training-001: 1 → 2 (teraz odblokowuje training-003 i training-004)
- `unlockTransition.unlockedTrainingIds` — zmieniono z `deepEqual` na dwa osobne `includes` (porządek tablicy nie jest gwarantowany)
- `contentUnlockGraph.unlockedTrainingCount` po ukończeniu 3 treningów: 3 → 7
- `contentUnlockGraph.lockedTrainingCount` po ukończeniu 3 treningów: 0 → 2
- `summary.unlockedTrainingCount` dla user-001: 3 → 7

**Testy:** `smoke:backend` (pass), `smoke:auth` (24/24 pass), `smoke:vertical` (pass)

---

## 2026-03-26 (3)

### Onboarding flow — prowadzenie nowego użytkownika po pierwszym logowaniu

**Problem:**
Nowy użytkownik po rejestracji trafiał bezpośrednio na surowy panel roboczy MVP bez żadnego wprowadzenia — nie wiedział, że musi uruchomić lokalny silnik ani jak zacząć trening.

**Rozwiązanie:**
Trójkrokowy wizard wyświetlany raz po pierwszym zalogowaniu (na podstawie klucza per-user w `localStorage`). Po ukończeniu nie pojawia się ponownie — kolejne logowania pomijają onboarding.

**Nowy plik:** brak — zmiany wyłącznie w istniejących plikach web.

**Zmodyfikowany plik: `apps/web/public/index.html`**
- Nowy overlay `#onboarding-overlay` wstawiony przed `#gameplay-overlay`
- Trzy kroki jako `div.onboarding-step` z atrybutem `hidden`:
  - Krok 1 — Welcome: tytuł, opis produktu, przycisk „Get started →"
  - Krok 2 — Start the engine: instrukcja uruchomienia `riffrush-engine.exe`, animowany wskaźnik stanu połączenia, przycisk „Continue" (disabled do czasu połączenia), przycisk „Skip for now"
  - Krok 3 — Ready: podsumowanie i przycisk „Start playing"
- Wskaźnik postępu: trzy kropki `#onboarding-dot-{1,2,3}` ze stanami `onboarding-dot-active` / `onboarding-dot-done`

**Zmodyfikowany plik: `apps/web/public/styles.css`**
- `.onboarding-overlay` — pełnoekranowy fixed overlay (z-index 100, gradient tło identyczne jak auth)
- `.onboarding-card` — karta 480px, ta sama estetyka co `.auth-card`
- `.onboarding-dot` / `.onboarding-dot-active` / `.onboarding-dot-done` — wskaźnik kroków
- `.onboarding-step[hidden]` — ukrywanie kroków
- `.onboarding-engine-status` — panel statusu silnika z animowaną kropką
- `.onboarding-status-checking` — pulsująca animacja `onboarding-pulse` gdy silnik nie połączony
- `.onboarding-status-connected` — zielona kropka gdy silnik dostępny

**Zmodyfikowany plik: `apps/web/public/app.js`**
- Stała `ONBOARDING_STORAGE_KEY = "riffrush_onboarding_v1"` — klucz localStorage z sufiksem `_${userId}` (per-user)
- `state.onboarding: { step, enginePollTimer }` — aktualny krok i timer pollingu
- Nowe elementy w `elements`: `onboardingOverlay`, `onboardingStep{1,2,3}`, `onboardingDot{1,2,3}`, `onboardingStatusDot`, `onboardingEngineStatusText`, `onboardingNext1`, `onboardingNext2`, `onboardingSkipEngine`, `onboardingFinish`
- `hasCompletedOnboarding(userId)` / `markOnboardingComplete(userId)` — odczyt/zapis localStorage
- `showOnboardingOverlay()` / `hideOnboardingOverlay()` — przełączanie widoczności (overlay ↔ appContent)
- `setOnboardingStep(step)` — przełącza widoczność kroków, aktualizuje kropki, startuje/zatrzymuje polling
- `startOnboardingEnginePoll()` / `stopOnboardingEnginePoll()` — polling `GET /health` co 2s
- `checkOnboardingEngineHealth()` — `fetch` z `AbortSignal.timeout(1500)` do `http://127.0.0.1:3210/health`; URL wyprowadzony z `state.engineUrl` (`ws://` → `http://`, `/ws` odcięte)
- `setOnboardingEngineStatus("checking" | "connected")` — aktualizuje dot, tekst, stan przycisku Continue
- `initOnboarding()` — sprawdza czy userId istnieje i czy onboarding nie był ukończony; jeśli nie — `showOnboardingOverlay()` + `setOnboardingStep(1)`
- Integracja: `initOnboarding()` wywoływane po `hideAuthPanel()` w `handleLogin`, `handleRegister` oraz `initAuth`
- Event listenery: `onboardingNext1` → krok 2, `onboardingNext2` → krok 3, `onboardingSkipEngine` → krok 3, `onboardingFinish` → `markOnboardingComplete` + `hideOnboardingOverlay`

**Testy:** `smoke:auth` (24/24 pass), `smoke:vertical` (pass)

---

## 2026-03-26 (2)

### Engine packaging — Windows executable (Node.js SEA)

**Problem:**
Silnik uruchamiał się wyłącznie przez `node ./apps/engine/src/server.js`. Żaden normalny użytkownik nie ma zainstalowanego Node.js ani nie wie jak uruchomić polecenie w terminalu.

**Rozwiązanie:**
Packager oparty na **Node.js Single Executable Applications** (SEA, stabilne od Node 22) + esbuild do bundle'owania ES modules. Nie dodano żadnych runtime dependencies — esbuild i postject są wywoływane przez `npx` (tylko podczas buildu, nie w runtime).

**Nowy plik: `apps/engine/scripts/build-exe.js`**

Skrypt 5-krokowy z kolorowym wyjściem i obsługą błędów:
1. **Bundle** — `npx esbuild` bundluje wszystkie pliki engine do jednego `engine-bundle.cjs` (ESM → CJS, Node.js built-ins jako external, `import.meta.url` → `__filename`)
2. **SEA blob** — `node --experimental-sea-config sea-config.json` generuje binarny blob z `disableExperimentalSEAWarning: true`
3. **Kopia Node.js binary** — kopiuje `node.exe` jako `riffrush-engine.exe` (runtime jest zawarty w pliku)
4. **Injektowanie** — `npx postject` wstrzykuje blob z sentinel fuse `NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`
5. **Czyszczenie** — usuwa tymczasowe pliki build (bundle, config, blob)
- Flaga `--full`: dodaje krok 6 — `dotnet publish` native-capture-bridge jako `native-capture-bridge.exe`
- Pre-flight check: weryfikuje Node.js >= 20 i istnienie entry pointa
- `shell: false` dla bezpośredniego wywołania `node.exe` (ścieżki ze spacjami jak `C:\Program Files\nodejs\node.exe`), `shell: true` dla komend shell (npx, dotnet)

**Zmodyfikowany plik: `apps/engine/src/audio/native-capture-runner.js`**
- Dodano `import { isSea } from "node:sea"` — w środowisku dev `isSea()` zwraca `false`, brak wpływu na istniejące testy
- `buildNativeCaptureCommandArgs` podzielony na dwa: `buildCaptureBridgeArgs` (tylko argumenty capture) i `getNativeBridgeContext` (command + prefix + cwd zależne od kontekstu)
- W trybie SEA: wywołuje `native-capture-bridge.exe` obok pliku `.exe` silnika
- W trybie dev: zachowanie identyczne jak poprzednio (`dotnet run --project`)
- Ścieżka artefaktu WAV: `resolve(cwd, 'tmp/native-capture/...')` zamiast `resolve('./tmp/...')` — poprawnie rozwiązuje się w obu kontekstach

**Nowe skrypty:**
- `apps/engine/package.json`: `build:exe`, `build:exe:full`
- `package.json` (root): `build:engine-exe`, `build:engine-exe:full`

**Wynik build:**
- `dist/riffrush-engine.exe` — 80 MB (Node.js runtime + cały engine, ~23 kB JS)
- Zawiera własny runtime Node.js — działa bez zainstalowanego Node.js
- Uruchomiony, odpowiada na `http://127.0.0.1:3210/health` i `ws://127.0.0.1:3210/ws`

**Dystrybucja (pełny build `--full`):**
```
dist/
  riffrush-engine.exe          ← uruchamia silnik (samo-wystarczalne)
  native-capture-bridge.exe    ← obsługa audio native (wymaga .NET runtime)
```

**Testy:** `test:engine-audio` (pass), `smoke:auth` (24/24 pass), `smoke:vertical` (pass)

---

## 2026-03-26

### Pitch detection — zastąpienie ZCR algorytmem YIN

**Zmodyfikowany plik:** `apps/engine/src/audio/analyzers.js`

**Problem z poprzednią implementacją:**
Funkcja `estimateFrequency` używała metody zero-crossing rate (ZCR). ZCR zlicza przejścia przez zero sygnału i szacuje częstotliwość jako `zeroCrossings * sampleRate / (2 * N)`. Metoda działa poprawnie tylko dla czystych sinusoid — w rzeczywistym sygnale gitary harmoniki wyższe powodują fałszywe przejścia przez zero, przez co ZCR zwraca częstotliwość 2–4× wyższą niż fundamentalna. Wynik: nieprawidłowe wykrywanie nut na prawdziwym instrumencie.

**Rozwiązanie — algorytm YIN:**
YIN (de Cheveigné & Kawahara, 2002) działa na funkcji autokorelacji sygnału i szuka okresu fundamentalnego zamiast zliczać zero-crossings. Jest odporny na harmoniki, szum ataku kostki i noise floor mikrofonu.

**Implementacja — 4 kroki YIN:**
1. **Funkcja różnicowa** `d[τ] = Σ (x[j] − x[j+τ])²` — dla każdego lagu τ w zakresie odpowiadającym 50–1200 Hz
2. **Skumulowana średnia normalizowana różnica (CMND)** `d'[τ] = d[τ]·τ / Σd[j]` — eliminuje bias dla małych lagów
3. **Próg absolutny** — pierwszy τ gdzie `d'[τ] < 0.12` (nieco luźniejszy niż oryginalny paper 0.10 dla lepszej tolerancji na nagrania instrumentalne); fallback: globalny minimum jeśli żaden lag nie przejdzie progu
4. **Interpolacja paraboliczna** — precyzja sub-próbkowa przez dopasowanie paraboli przez 3 punkty wokół minimum

**Zakres detekcji:** 50–1200 Hz (pokrywa pełny zakres gitary E2–E5 z marginesem)

**Zabezpieczenia:**
- Sprawdzenie energii sygnału (< 1e−8): cisze zwracają 0 Hz bez uruchamiania algorytmu
- Jeśli minimum CMND > 0.5: sygnał bez wyraźnej tonacji → 0 Hz
- Interpolacja tylko gdy mianownik > 1e−10 (uniknięcie dzielenia przez zero)

**Zmierzona dokładność (48 kHz, 2048 próbek):**

| Nuta | Cel Hz | Błąd | Sygnał harmoniczny |
|---|---|---|---|
| E2 | 82.41 | 0.13 Hz | identyczny ✓ |
| A2 | 110.00 | 0.18 Hz | identyczny ✓ |
| D3 | 146.83 | 0.09 Hz | identyczny ✓ |
| G3 | 196.00 | 0.16 Hz | identyczny ✓ |
| B3 | 246.94 | 0.96 Hz | identyczny ✓ |
| E4 | 329.63 | 1.72 Hz | identyczny ✓ |
| A4 | 440.00 | 0.72 Hz | identyczny ✓ |
| D5 | 587.33 | 3.95 Hz | identyczny ✓ |
| E5 | 659.26 | 3.49 Hz | identyczny ✓ |

Błąd < 4 Hz w całym zakresie — zawsze poniżej połowy semitonu (najmniejszy odstęp: ~37 Hz przy E5). Sygnały harmoniczne (gitara z 6 harmonicznymi) dają identyczną precyzję jak czyste sinusoidy — YIN nie myli harmonik z fundamentalną.

**Złożoność obliczeniowa:** O(N²) na pierwszej połowie bufora. Przy 2048 próbkach i 48 kHz: ~23 klatki/s × ~1M operacji = ~23M mnożeń/s — poniżej 1% budżetu CPU Node.js.

**Signature funkcji bez zmian:** `estimateFrequency(samples, sampleRate)` → `session-analyzer.js` i wszystkie testy nie wymagały modyfikacji.

**Testy:** `test:engine-audio` (pass), `smoke:vertical` (pass)

---

## 2026-03-25 (3)

### Gameplay UI — note highway, countdown, real-time feedback

**Nowe elementy w `apps/web/public/index.html`:**
- `#gameplay-overlay` — pełnoekranowa nakładka rozgrywki (ciemny motyw), ukryta domyślnie
  - `#gameplay-training-name`, `#gameplay-tempo-label` — nagłówek z nazwą treningu i tempem
  - `#gameplay-score`, `#gameplay-combo`, `#gameplay-accuracy` — live countery
  - `#gameplay-stop` — przycisk zatrzymania sesji
  - `#gameplay-highway` + `#gameplay-notes` — highway nut z kontenerem na elementy DOM
  - `#gameplay-countdown` — nakładka "Get Ready" podczas lead-in
  - `#gameplay-feedback` — flash z informacją zwrotną (Perfect! / Early / Late / Miss)
  - `#gameplay-results` + karta wyników — ocena (S–F), score, accuracy, feedback coach, przycisk Continue

**Nowe style w `apps/web/public/styles.css`:**
- `.gameplay-overlay`, `.gameplay-header`, `.gameplay-meta` — ciemna nakładka fullscreen
- `.gameplay-scores`, `.gameplay-score-block`, `.gameplay-score-value` — live HUD
- `.gameplay-highway`, `.gameplay-playhead`, `.gameplay-notes` — szyna nut
- `.gameplay-note`, `.gameplay-note-pitch`, `.gameplay-note-string` — karta nuty na highway
- `.gameplay-note.is-hit` (zielone), `.gameplay-note.is-miss` (czerwone) — stany po ocenie
- `.gameplay-countdown` — nakładka lead-in
- `.gameplay-feedback`, `.is-hit`, `.is-late`, `.is-miss` — flash feedback przy playheadzie
- `.gameplay-results`, `.gameplay-results-card`, `.gameplay-results-grade` — ekran wyników

**Nowe funkcje w `apps/web/public/app.js`:**
- `state.gameplay` — obiekt stanu rozgrywki: `active`, `startedAt`, `targets[]`, `totalScore`, `hitCount`, `missCount`, `comboMultiplier`, `rafId`, `feedbackTimer`
- 19 nowych referencji DOM w `elements` dla komponentów gameplay
- `buildGameplayTargets(training, tempoBpm, practiceScope, ...)` — oblicza `expectedTimeMs` dla każdego targetu, mirroruje timing engine (lead-in = 1 beat), obsługuje full-chart i section-loop (z repetycjami i tempo step)
- `createNoteElement(target, highwayWidth, pxPerMs)` — tworzy element DOM dla nuty na highway z szerokością proporcjonalną do czasu trwania
- `openGameplayOverlay(training, sessionStartedPayload)` — inicjalizuje overlay, buduje targety, tworzy DOM nut, startuje pętlę rAF
- `gameplayRenderFrame()` — pętla `requestAnimationFrame`; przesuwa kontener nut przez `transform: translateX()` na podstawie czasu (brak reflow per-nuta)
- `onGameplayScoreEvent(payload)` — obsługuje `score.event`: oznacza nutę is-hit/is-miss, aktualizuje score/combo/accuracy, wywołuje feedback flash
- `showGameplayFeedback(eventKind, timingClass, hit)` — wyświetla label (Perfect! / Early / Late / Miss / Ghost) i autoukrywa po 600ms
- `onGameplaySessionSummary(summaryPayload)` — wyświetla panel wyników z oceną, score, accuracy, feedback coach
- `closeGameplayOverlay()` — zatrzymuje rAF, czyści DOM, ukrywa overlay
- hookowanie w istniejące handlery: `session.started` → `openGameplayOverlay`, `score.event` → `onGameplayScoreEvent`, `session.summary` → `onGameplaySessionSummary`
- event listenery: `gameplay-stop` → `closeGameplayOverlay + stopLiveSession`, `gameplay-results-continue` → `closeGameplayOverlay`

**Stałe konfiguracyjne:**
- `HIGHWAY_VISIBLE_MS = 4000` — okno czasowe widoczne na highway
- `HIGHWAY_PLAYHEAD_RATIO = 0.25` — pozycja playheada (25% od lewej)
- `NOTE_MIN_WIDTH_PX = 56` — minimalna szerokość karty nuty

**Testy:** `smoke:auth` (24/24 pass), `smoke:vertical` (pass)

---

## 2026-03-25 (2)

### Auth web UI — ekrany logowania i rejestracji

**Nowe elementy w `apps/web/public/index.html`:**
- `#auth-panel` — nakładka pełnoekranowa z kartą auth (widoczna gdy niezalogowany); zawiera dwa formularze (login / register) przełączane zakładkami
- `#app-content` — `id` dodane do `<main class="layout">` (potrzebne do ukrywania apki gdy panel auth jest widoczny)
- `#user-bar` — pasek w `connection-panel` pokazujący email zalogowanego użytkownika i przycisk "Log out"

**Nowe style w `apps/web/public/styles.css`:**
- `.auth-overlay`, `.auth-card` — nakładka i karta logowania
- `.auth-tabs`, `.auth-tab`, `.auth-tab-active` — przełącznik zakładek login/register
- `.auth-form`, `.auth-field`, `.auth-error`, `.auth-submit` — formularz i komunikaty błędów
- `.user-bar`, `.user-bar-email`, `.button-small` — pasek użytkownika w panelu połączenia

**Zmiany w `apps/web/public/app.js`:**
- `state.auth` — nowe pole: `{ token, userId, email }` przechowujące stan sesji w pamięci
- nowe elementy w `elements` — 17 nowych referencji DOM dla komponentów auth
- `getActiveUserId()` — zwraca `state.auth.userId` gdy zalogowany, fallback do `elements.userId.value.trim()` (wsteczna kompatybilność)
- `request()` — automatycznie dodaje nagłówek `Authorization: Bearer <token>` gdy token jest dostępny
- `loadAuthFromStorage()`, `saveAuthToStorage()`, `clearAuthFromStorage()` — persystencja w `localStorage` pod kluczem `riffrush_auth`
- `applyAuthState()`, `clearAuthState()` — synchronizują `state.auth` z UI (user bar)
- `showAuthPanel()`, `hideAuthPanel()` — przełączają widoczność nakładki auth i głównej apki
- `handleLogin()`, `handleRegister()` — obsługa formularzy; komunikaty błędów inline
- `handleLogout()` — czyści stan i wraca do ekranu auth
- `initAuth()` — przy starcie sprawdza `localStorage`; jeśli token istnieje weryfikuje go przez `GET /auth/me`; nieważny token → ekran auth
- `switchAuthTab()` — przełącza zakładki login/register
- wszystkie 11 miejsc z `elements.userId.value.trim()` zastąpione wywołaniem `getActiveUserId()`
- nowe event listenery: `submit` na obu formularzach, `click` na zakładkach i przycisku logout
- `void initAuth()` wywołane na końcu pliku

**Testy:** `smoke:auth` (24/24 pass), `smoke:vertical` (pass)

---

## 2026-03-25

- Dodano `docs/project-status.md` — pełna analiza stanu projektu: architektura, co działa, co brakuje, stan 14 etapów planu realizacji, następne kroki
- Dodano `docs/changelog.md` — ten plik

### Auth — rejestracja i logowanie użytkowników

**Nowe pliki:**
- `apps/backend/src/lib/crypto.js` — hashowanie haseł (scrypt, Node.js built-in) i JWT HS256 (HMAC-SHA256, Node.js built-in); timing-safe porównania
- `apps/backend/src/services/auth-service.js` — `register(email, password)`, `login(email, password)`, `verifyToken(token)`; walidacja pól, normalizacja emaila, ochrona przed user enumeration
- `apps/backend/scripts/auth-smoke-test.js` — 24 testy: rejestracja, duplikat emaila, błędne hasło, login, case-insensitive email, GET /auth/me z/bez tokenu

**Zmodyfikowane pliki:**
- `apps/backend/src/persistence/sqlite-migrations.js` — migracja v6: kolumny `email` i `password_hash` w tabeli `users`, unikalny indeks na email
- `apps/backend/src/repositories/sqlite-user-repository.js` — metody `findCredentialsByEmail(email)` i `createWithCredentials({ id, email, passwordHash })`; zaktualizowany `#insertUser` o nowe kolumny
- `apps/backend/src/repositories/user-repository.js` — te same metody w in-memory repository; dodany `#emailIndex` (Map)
- `apps/backend/src/create-app.js` — import `AuthService`; helper `readBearerToken`; trasy `POST /auth/register`, `POST /auth/login`, `GET /auth/me`; `authService` jako wstrzykiwana zależność
- `apps/backend/src/config.js` — pole `jwtSecret` z env `JWT_SECRET` (fallback dev-only)
- `apps/backend/src/persistence/create-persistent-dependencies.js` — tworzy i wstrzykuje `AuthService`; przyjmuje `jwtSecret`
- `apps/backend/src/server.js` — przekazuje `jwtSecret` do `createPersistentDependencies`
- `apps/backend/src/lib/http.js` — `Authorization` dodany do `Access-Control-Allow-Headers`
- `apps/backend/package.json` — skrypt `smoke:auth`
- `package.json` (root) — skrypt `smoke:auth`

**Testy:** `smoke:auth` (24/24 pass), `smoke:vertical` (pass)
