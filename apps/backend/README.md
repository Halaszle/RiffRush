# apps/backend

Minimalny backend MVP dla RiffRush.
Aktualnie stan trwały backendu jest zapisywany lokalnie w `SQLite`.

Aktualnie zawiera:

- `GET /health`
- `GET /trainings`
- `GET /users/:id/dashboard`
- `GET /users/:id/diagnostics`
- `GET /users/:id/diagnostics/devices/:deviceName`
- `POST /sessions`
- `POST /sessions/:id/summary`
- `PUT /users/:id/calibration`

Obslugiwane tryby sesji:

- `synthetic`
- `wav-file`
- `live-stream`
- `native-capture`

Architektura jest celowo modularna:

- `src/data` - dane startowe
- `src/repositories` - dostep do danych
- `src/services` - logika biznesowa
- `src/lib` - HTTP i walidacja
- `src/persistence` - warstwa trwałości i migracje SQLite
- `src/create-app.js` - skladanie zaleznosci
- `src/server.js` - uruchomienie procesu

Trwalosc i migracje:

- backend zapisuje dane do `SQLite` w katalogu `BACKEND_DATA_DIR` albo domyslnie do `apps/backend/storage`
- migracje schematu sa wersjonowane w `src/persistence/sqlite-migrations.js`
- tabela `schema_migrations` oraz `PRAGMA user_version` sa utrzymywane automatycznie przy starcie backendu
- diagnostyka sesji jest zapisywana nie tylko w `summary_json`, ale tez w osobnych tabelach `session_capture_snapshots` i `session_notice_events`
- raporty diagnostyczne czytaja dane bezposrednio z tabel diagnostycznych, z fallbackiem do `summary_json` tylko dla starszych rekordow
- filtrowanie, recent sessions i grupowanie sciezek diagnostycznych sa wykonywane bezposrednio w `SQLite`, a warstwa serwisowa doklada insighty i scoring
- raporty diagnostyczne agreguja tez warning notice'y per kod i etap (`preflight`, `runtime`, `session`), co pozwala analizowac jakosc capture nie tylko przy starcie, ale tez w trakcie sesji
- snapshot capture zapisuje tez metryki runtime, m.in. `maxChunkGapMs`, `lowSignalEventCount` i `lowSignalChunkCount`
