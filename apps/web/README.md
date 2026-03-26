# apps/web

Prosty frontend shell dla MVP.

Aktualny kierunek produktu dla pierwszego wydania:

- desktop-first dla komputerow stacjonarnych i laptopow,
- brak wsparcia mobilnego w pierwszym publicznym release,
- dalszy rozwoj mobile web odlozony na pozniejszy etap po domknieciu desktopowego flow produktu,
- dalszy tuning wizualny UI odlozony na faze po zakonczeniu prac nad mechanika, audio, sesjami i progresja.

Aktualnie zawiera:

- status polaczenia z backendem
- status polaczenia z local engine
- mock onboarding kalibracji
- prosty dashboard progresu uzytkownika
- pobieranie listy treningow
- start sesji treningowej
- wybor zrodla sygnalu: synthetic, wav-file, live-stream albo native-capture
- streaming mikrofonu z przegladarki do engine
- natywny capture audio przez lokalny helper Windows
- wybor konkretnego urzadzenia wejściowego dla native-capture
- odbior mock scoring events
- zapis podsumowania sesji wygenerowanego przez engine

Pliki:

- `public/index.html`
- `public/styles.css`
- `public/app.js`
- `scripts/static-server.js`
