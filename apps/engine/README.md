# apps/engine

Lokalny engine MVP uruchamiany jako osobny proces.

Aktualnie zawiera:

- serwer HTTP z `GET /health`
- `localhost WebSocket` z handshake i heartbeat
- mock flow kalibracji z rekomendowanym offsetem
- obsluge `session.start`
- syntetyczne zrodlo ramek audio
- pipeline analizy sygnalu: RMS, onset detection, pitch estimation, scoring
- natywny helper Windows do capture mikrofonu do WAV
- replay artefaktow audio przez `wav-file`
- chunkowany native capture stream z helpera Windows do engine
- metadata capture zapisywane w `session.summary` i widoczne w dashboardzie
- profile capture `safe`, `balanced`, `low-latency` przekazywane przez caly flow sesji

Aktualny etap:

- architektura engine jest przygotowana pod realny input audio
- sesja treningowa przechodzi juz przez warstwe analizy sygnalu
- istnieje natywny capture z rozroznieniem backendow `wavein` i `wasapi`
- sesje raportuja backend, urzadzenie, profil capture, sample rate i liczbe chunkow
- kolejnym krokiem pozostaje zejscie do nizszej latencji i bardziej bezposredniego pipeline dla interfejsow audio

To jest etap integracyjny. Wlasciwe przetwarzanie audio zostanie podmienione w kolejnych krokach bez zmiany publicznego kontraktu komunikacji.
