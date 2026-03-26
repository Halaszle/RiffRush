# RiffRush

Workspace startowy dla aplikacji treningowej do gry na gitarze z lokalnym silnikiem audio.

## Cel MVP

Pierwsza wersja ma dostarczyc jeden dzialajacy flow end to end:

1. Uzytkownik zaklada konto i loguje sie do aplikacji webowej.
2. Pobiera i uruchamia lokalny engine na Windows.
3. Web wykrywa engine po `localhost WebSocket`.
4. Uzytkownik przechodzi krotka kalibracje.
5. Uzytkownik uruchamia jeden typ treningu monofonicznego.
6. Engine wykrywa nuty i timing, liczy scoring i wysyla eventy.
7. Backend zapisuje wynik, a web pokazuje podsumowanie i prosty progres.

## Zakres pierwszego wydania

- Pierwsze wydanie produktu jest desktop-only.
- W praktyce oznacza to publikacje dla uzytkownikow korzystajacych z komputerow z Windows i lokalnego engine audio.
- Wersja mobilna i dodatkowy tuning mobile web nie wchodza do pierwszego release'u i sa odlozone na pozniejszy etap.
- Na obecnym etapie priorytetem jest domkniecie mechaniki gry, stabilnosci audio, sesji i progresji.
- Dalszy tuning wizualny i polishing layoutu sa celowo odlozone na etap po zakonczeniu prac nad funkcjonalnym MVP desktop.

## Struktura

- `apps/web` - frontend produktu
- `apps/backend` - API i logika danych
- `apps/engine` - lokalny silnik audio
- `packages/protocol` - kontrakty komunikacji engine <-> web
- `docs` - dokumenty robocze MVP, architektury i backlogu

## Dokumentacja

- `docs/mvp-scope.md`
- `docs/architecture.md`
- `docs/backlog-mvp.md`
- `docs/RiffRush-plan-realizacji-i-wdrozenia.pdf`
- `docs/*.pdf` - materialy zrodlowe i specyfikacje

## Następny krok

Najblizsza implementacja powinna zaczac sie od kontraktu protokolu i cienkiego backendu sesji, bo to ustala granice dla webu i engine.
