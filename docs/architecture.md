# Architektura robocza

## Zasady

- Engine jest zrodlem prawdy dla wykrycia nut, czasu i scoringu.
- Web odpowiada za UX, sesje produktu i prezentacje danych.
- Backend odpowiada za auth, dane treningow, zapis wynikow i analityke produktu.
- Kontrakt komunikacji musi byc wersjonowany i wspoldzielony.

## Komponenty

### 1. Web

Odpowiedzialnosc:

- logowanie i onboarding
- wykrycie lokalnego engine
- uruchomienie treningu
- wyswietlanie statusow polaczenia
- podsumowanie wynikow i dashboard

### 2. Backend

Odpowiedzialnosc:

- konta uzytkownikow
- katalog treningow
- zarzadzanie sesja treningowa
- zapis wynikow i progresu
- telemetry and product analytics

### 3. Local Engine

Odpowiedzialnosc:

- capture audio
- preprocessing
- onset detection
- pitch detection
- scoring
- `localhost WebSocket`

### 4. Shared Protocol

Odpowiedzialnosc:

- envelope komunikatow
- wersjonowanie protokolu
- handshake i heartbeat
- komendy sesji
- eventy scoringowe
- raportowanie bledow

## Przeplyw end to end

1. Web laczy sie z backendem i pobiera profil oraz definicje treningow.
2. Web probuje polaczyc sie z local engine po `ws://127.0.0.1`.
3. Engine zwraca `ready` z wersja i capabilities.
4. Web inicjuje sesje treningowa.
5. Backend tworzy rekord sesji.
6. Web przekazuje konfiguracje treningu do engine.
7. Engine przetwarza audio i emituje eventy scoringowe.
8. Web przesyla podsumowanie do backendu.
9. Backend zapisuje wynik i zwraca aktualny progres.

## Proponowana struktura kodu

- `apps/web`
- `apps/backend`
- `apps/engine`
- `packages/protocol`

## Otwarte decyzje

- Dokladny stack frontendu i backendu.
- Format dystrybucji engine.
- Strategia auto-update engine.
- Mechanizm auth w MVP.
