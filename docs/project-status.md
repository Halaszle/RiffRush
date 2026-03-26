# RiffRush — Stan projektu (2026-03-25)

## Czym jest projekt

RiffRush to hybrydowa platforma treningowa dla gitarzystów. Łączy aplikację webową z lokalnym silnikiem audio działającym na komputerze użytkownika. Nie jest to gra rytmiczna ani kurs wideo — celem jest realny, precyzyjny feedback z grania na prawdziwej gitarze.

Architektura hybrydowa: web obsługuje UX i produkt, lokalny engine (działający w tle) robi całą robotę DSP. Engine jest źródłem prawdy dla detekcji nut, czasu i scoringu.

---

## Struktura projektu

```
apps/web                  — frontend (Vanilla JS, HTML, CSS)
apps/engine               — lokalny silnik audio (Node.js)
apps/backend              — API i dane (Node.js + SQLite)
apps/native-capture-bridge — natywny helper audio (C# / .NET 8)
packages/protocol         — wspólny kontrakt komunikacji web <-> engine (TypeScript)
docs/                     — dokumentacja
```

---

## Architektura techniczna

| Warstwa | Stack | Rola |
|---|---|---|
| Web | Vanilla JS + HTML | UI, logowanie (brak), dashboard, ekran treningu |
| Backend | Node.js, SQLite | Auth (brak), katalog treningów, zapis wyników, progres |
| Local Engine | Node.js (docelowo Rust) | Audio capture → DSP → scoring → WebSocket |
| native-capture-bridge | C# / .NET 8 | Natywny dostęp do urządzeń Windows (WaveIn/WASAPI) |
| Protocol | TypeScript (JSON/WebSocket) | Wersjonowany kontrakt komunikacji |

Komunikacja web ↔ engine: WebSocket na `ws://127.0.0.1:3210/ws`
Komunikacja web ↔ backend: HTTP na `http://127.0.0.1:3001`

---

## Przepływ sesji treningowej

1. Użytkownik loguje się → web pobiera profil i treningi z backendu
2. Web łączy się z lokalnym engine przez WebSocket
3. Engine odpowiada `engine.ready` (handshake)
4. Kalibracja wejścia audio (mock — zwraca deterministyczny wynik)
5. Web tworzy sesję w backendzie (`POST /sessions`)
6. Web wysyła `session.start` do engine
7. Engine analizuje audio: RMS → onset detection → pitch detection → scoring
8. Engine wysyła `score.event` w czasie rzeczywistym
9. Po zakończeniu engine wysyła `session.summary`
10. Web wysyła podsumowanie do backendu (`POST /sessions/:id/summary`)
11. Backend zapisuje wynik, aktualizuje progres i zwraca dashboard

---

## Protokół komunikacji (packages/protocol)

Wersja: 1. Każda wiadomość ma envelope:
```json
{
  "type": "...",
  "protocolVersion": 1,
  "sessionId": "...",
  "timestamp": "...",
  "requestId": "...",
  "payload": {}
}
```

Zaimplementowane typy wiadomości:
- `engine.init` / `engine.ready` — handshake
- `engine.heartbeat` — co 5 sekund
- `engine.error` — błędy (UNSUPPORTED_PROTOCOL, AUDIO_DEVICE_NOT_FOUND, itd.)
- `calibration.start` / `calibration.started` / `calibration.progress` / `calibration.result`
- `native.devices.request` / `native.devices.response`
- `native.preflight.request` / `native.preflight.response`
- `session.start` / `session.started` / `session.stop` / `session.notice`
- `audio.stream.chunk` — PCM16 base64 z przeglądarki
- `score.event` — trafienie/miss z pełnymi metadanymi
- `session.summary` — podsumowanie sesji z breakdownami

---

## Co jest zaimplementowane

### Protocol — KOMPLETNY
Pełny TypeScript kontrakt znacznie przekraczający minimalny MVP:
- CaptureMetadata z pełną diagnostyką (fallback, gaps, low signal, runtime metrics)
- ScoreEventMessage: target-hit/ghost-note/missed-target, sustain, release, combo, multiplier, timing class
- SessionSummaryMessage: scoreBreakdown, sectionBreakdown, practicePreset z repetitions/masteryGate/adaptiveExecution, rating (S/A/B/C/D/F), feedback z coachHints, verification

### Engine — ZAAWANSOWANY
- Custom WebSocket server (raw HTTP + frame encoding, bez zewnętrznych bibliotek)
- Session lifecycle z AbortController i czyszczeniem zasobów
- 4 tryby wejścia audio:
  - `synthetic` — generowane syntetycznie na podstawie note map
  - `wav-file` — replay z pliku WAV
  - `live-stream` — mikrofon przeglądarki strumieniowany jako PCM16 base64
  - `native-capture` — natywny capture przez C# bridge
- Pipeline analizy audio: RMS → onset detection (energy delta) → pitch detection (zero-crossing rate) → note mapping
- SessionAnalyzer: pełne scoring z sustain/release/combo/multiplier, adaptive early stop, section-loop z repetitions i mastery gate, ocena S/A/B/C/D/F, feedback z coach hints
- Native capture bridge: C# .NET 8, WaveIn + WASAPI, profile safe/balanced/low-latency
- Native preflight check (weryfikacja konfiguracji przed sesją)
- Runtime monitor (chunk gaps, low signal events)
- Katalog ćwiczeń: 3 ćwiczenia (exercise-001/002/003)

### Backend — KOMPLETNY dla MVP
- SQLite schema v5 z migracjami (5 wersji)
- Tabele: users, sessions, session_capture_snapshots, session_notice_events, schema_migrations
- Endpointy:
  - `GET /health`
  - `GET /trainings`
  - `POST /sessions`
  - `POST /sessions/:id/summary`
  - `GET /users/:id/dashboard`
  - `GET /users/:id/diagnostics`
  - `GET /users/:id/diagnostics/devices/:deviceName`
  - `PUT /users/:id/calibration`
- Content unlock graph: training-001 → training-003 → training-002
- Capture preferences + override history per user
- Diagnostyki z filtrowanie po device/backend/profile, eksport JSON/CSV
- Checkpoint progression system (unlock/recovery/return/promotion/mastery)

### Web — DEVELOPER SHELL (nie product UI)
- Połączenie z backendem i enginem
- Katalog treningów, tworzenie sesji ze wszystkimi trybami
- Native device listing + preflight
- Dashboard z progression, streak
- Zaawansowany panel diagnostyki
- Section-loop controls (repetitions, tempo step, mastery gate)
- Checkpoint/progression workspace z historią i action rail
- Capture recommendation system
- Live event log ze score events

### native-capture-bridge — KOMPLETNY
- WaveIn + WASAPI backends
- Profile: safe (bufferMs=120), balanced (bufferMs=60), low-latency (bufferMs=25)
- Lista urządzeń (JSON) z wykrywaniem microphone vs audio-interface
- Capture do WAV + streaming PCM chunks do engine

### Testy
- `smoke:vertical` — vertical slice test (backend + engine + WAV session end-to-end)
- `smoke:engine` — engine WebSocket smoke test
- `test:engine-audio` — audio pipeline test
- `smoke:engine-live` — live stream smoke test
- `smoke:engine-native` — native capture smoke test

---

## Co brakuje

### Krytyczne (blokuje testy z użytkownikami)

1. **Auth / konta użytkowników**
   - Brak logowania i rejestracji
   - UserId to hardcoded string `"user-001"` w UI
   - Minimalny zakres: email + password lub magic link

2. **Gameplay UI**
   - Web shell to narzędzie developerskie, nie interfejs produktowy
   - Brakuje: note highway / timeline, countdown, real-time wizualny feedback podczas grania
   - Użytkownik nie widzi co ma zagrać ani kiedy

3. **Pitch detection — jakość algorytmu**
   - Aktualnie: zero-crossing rate — bardzo prymitywna metoda
   - Problem: będzie nieprecyzyjny dla realnej gitary (harmoniki, szum, pick attack)
   - Potrzeba: YIN, autocorrelacja lub FFT-based (zgodnie ze specyfikacją engine)
   - Bez tego scoring dla prawdziwego instrumentu będzie niewiarygodny

4. **Installer / packaging engine**
   - Engine startuje przez `node ./apps/engine/src/server.js`
   - Żaden normalny użytkownik tego nie uruchomi
   - Potrzeba: .exe, instalator Windows, auto-update lub update prompt

### Ważne (P1, po powyższych)

5. **Onboarding flow** — brak właściwego przeprowadzenia nowego użytkownika
6. **Telemetria / crash reporting** — brak
7. **Więcej contentu** — tylko 3 ćwiczenia (exercise-001/002/003)
8. **Build system frontendu** — jeden ogromny plik `app.js` bez bundlera (React/Vue/Svelte lub chociaż Vite)
9. **CI/CD** — brak konfiguracji ciągłej integracji

---

## Stan względem planu realizacji (14 etapów)

| Etap | Nazwa | Status |
|---|---|---|
| 01 | Zamknięcie zakresu MVP | Zrobione |
| 02 | Uszczegółowienie architektury systemu | Zrobione |
| 03 | Przygotowanie repozytorium i infrastruktury developerskiej | Zrobione (brak CI) |
| 04 | Implementacja podstaw local engine | Zrobione |
| 05 | Implementacja algorytmów audio i scoringu MVP | Częściowo — scoring gotowy, pitch detection do poprawy |
| 06 | Warstwa backendu i danych | Zrobione |
| 07 | Frontend aplikacji webowej | Częściowo — shell techniczny, brak product UI i auth |
| 08 | Content, ekonomia produktu i mechaniki progresu | Częściowo — progression system jest, brak auth i więcej contentu |
| 09 | Packaging, aktualizacje i dystrybucja local engine | Nie zrobione |
| 10 | Jakość, testy systemowe i hardening | Częściowo — smoke testy są, brak pełnego QA |
| 11 | Beta zamknięta i walidacja z użytkownikami | Nie zrobione |
| 12 | Operacje, support i gotowość do launchu | Nie zrobione |
| 13 | Soft launch | Nie zrobione |
| 14 | Publiczny launch i pierwsze 30 dni | Nie zrobione |

**Projekt jest na granicy etapów 7-8.** Fundament techniczny jest solidny i przekracza minimalne wymagania MVP. Blokada przed testami z użytkownikami to auth, gameplay UI i brak instalatora.

---

## Katalog treningów (aktualny)

| ID | Tytuł | Trudność | BPM | Nuty |
|---|---|---|---|---|
| training-001 | Single String Timing Foundations | beginner | 80 | E4, F4, G4, A4 |
| training-002 | Alternate Picking Basics | beginner | 95 | A3, B3, C4, B3 |
| training-003 | Timing Control Ladder | intermediate | 110 | D4, E4, F4, G4, A4, G4 |

Graf odblokowania: training-001 (root) → training-003 → training-002

---

## Uruchomienie lokalne

```bash
# Backend
node ./apps/backend/src/server.js        # port 3001

# Engine
node ./apps/engine/src/server.js         # port 3210

# Web
node ./apps/web/scripts/static-server.js # port 3000

# Native capture bridge (C#)
dotnet build ./apps/native-capture-bridge/native-capture-bridge.csproj

# Testy
node ./scripts/vertical-slice-smoke.js   # vertical slice end-to-end
```

---

## Następne kroki (rekomendacja)

Kolejność zgodna z priorytetami blokującymi testy z użytkownikami:

1. **Auth** — minimalnie email+password, JWT, endpointy rejestracji/logowania w backendzie, formularz w web
2. **Gameplay UI** — właściwy ekran z note highway (canvas/SVG), countdown, real-time feedback
3. **Pitch detection** — zastąpienie zero-crossing algorytmem YIN lub autocorrelation
4. **Installer engine** — packaging jako .exe dla Windows (np. przez pkg lub Tauri jeśli migracja do Rust)
