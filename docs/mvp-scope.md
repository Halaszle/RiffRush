# MVP Scope

## Problem

RiffRush ma dawac gitarzyscie natychmiastowy, wiarygodny feedback z realnego grania, a nie tylko content edukacyjny albo gre rytmiczna bez prawdziwego instrumentu.

## Co wchodzi do MVP

- Jeden wspierany system operacyjny: Windows.
- Pierwszy publiczny release tylko dla desktopu; mobile web nie jest celem tego wydania.
- Priorytet implementacyjny to mechanika gry, stabilnosc audio, flow sesji, zapis wynikow i progres uzytkownika.
- Tuning wizualny interfejsu nie jest teraz osobnym celem MVP i zostaje przesuniety na etap po domknieciu funkcjonalnego desktop MVP.
- Jeden lokalny engine audio uruchamiany jako osobny proces.
- Polaczenie web <-> engine przez `localhost WebSocket`.
- Jeden typ treningu monofonicznego.
- Jedna metoda scoringu oparta o poprawnosc nuty i timing.
- Konto uzytkownika, logowanie i prosty profil.
- Onboarding z wykryciem engine i podstawowa kalibracja.
- Zapis sesji treningowej i prosty ekran wynikow.
- Dashboard z historia ostatnich wynikow i streakiem.

## Co nie wchodzi do MVP

- Mobilna wersja produktu w pierwszym wydaniu.
- Polifonia.
- Multiplayer.
- Rozbudowany ranking globalny.
- Zaawansowana ekonomia gry.
- Wiele systemow operacyjnych od pierwszego dnia.
- Zaawansowane studio audio, efekty i routing.
- Marketplace contentu.

## Krytyczne flow produktu

1. Rejestracja lub logowanie.
2. Pobranie engine.
3. Uruchomienie engine i pozytywny handshake.
4. Kalibracja wejscia audio.
5. Start treningu.
6. Przesyl eventow scoringowych.
7. Zapis wyniku.
8. Podsumowanie i decyzja o kolejnym treningu.

## Metryki sukcesu MVP

- Uzytkownik dociera do pierwszej zakonczonej sesji bez pomocy operatora.
- Odsetek udanych handshake z engine jest stabilny.
- Czas od wejscia na strone do pierwszego treningu jest akceptowalny.
- Scoring jest postrzegany jako wiarygodny przez pierwszych testerow.
