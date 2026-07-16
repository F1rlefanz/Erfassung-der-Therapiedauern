# Changelog

Alle nennenswerten Änderungen an „Erfassung der Therapiedauern" werden hier
dokumentiert. Das Format orientiert sich an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionierung an
[Semantic Versioning](https://semver.org/lang/de/).

## [0.4.0] - 2026-07-16 — Action Cycle 5: Klinische Logik, Continuation & Statistik-Dashboard

### Added
- **Berechnungs-Service** `src/lib/therapyCalculator.ts` (rein, unit-getestet):
  Therapiestunden, **Beatmungstage** (Beatmung + ≥1 Stunde = 1 Kalendertag),
  Aggregation gesamt/Monat und Therapiearten-Verteilung.
- **Continuation „Vortag fortführen"**: Therapien, die am Vortag um 23 Uhr noch
  liefen, werden heute ab Stunde 0 fortgesetzt (Button in `/erfassung`); die
  Events synchronisieren über den bestehenden Socket.io/SQLite-Stack.
- **Statistik-Dashboard** (`/statistik`) mit `recharts`: Kennzahlen (Patienten,
  Beatmungstage gesamt/Monat, Therapiestunden) und ein Balkendiagramm der
  Therapiearten-Verteilung — im Corporate Design, theme-aware, ohne Animationen.
- **Schicht-Header** über dem 24h-Raster: dezente Bänder Früh/Spät/Nacht
  (06/13/21 Uhr) zusätzlich zu den Spaltentrennern.
- Unit-Tests für `therapyCalculator` (Schwerpunkt Beatmungstage-Regel) und die
  Continuation-Logik.

### Changed
- Therapiearten-Metadaten in `src/lib/therapyTypes.ts` zentralisiert (eine Quelle
  für Tabelle, Statistik, Berechnungen).
- Kennzahlenkachel als geteilte Komponente `src/components/StatTile.tsx`
  (Dublette im Dashboard entfernt).

### Removed
- Ungenutzte `PlaceholderView`-Komponente (Statistik/Settings sind jetzt echt).

## [0.3.1] - 2026-07-16 — Action Cycle 4.1: On-Premise-Architektur (Node + SQLite + Socket.io)

Strategiewechsel: Wegen DSGVO (klinische Patientendaten) bleiben alle Daten
on-premise im Krankenhaus-Intranet — kein Cloud-Dienst.

### Added
- **Lokaler On-Premise-Server** (`server/`, Monorepo): Express + Socket.io +
  SQLite (`better-sqlite3`). `server/db.js` (Schema + CRUD), `server/index.js`
  (empfängt CRUD-Events, persistiert lokal, broadcastet an alle Clients im
  Intranet). Start via `npm run start:server` (Root-`package.json`).
- **Client-Sync via Socket.io** (`src/lib/syncClient.ts`): Optimistic Updates —
  Mutationen schreiben sofort lokal (IndexedDB) und pushen (debounced) an den
  Server. **Offline-Fallback:** ohne Server bleibt alles lokal; beim Reconnect
  wird der lokale Bestand nachgereicht. Deterministische Record-IDs sorgen für
  konfliktfreie Konvergenz.
- **Backup & Restore** (`/settings`): Export des gesamten Zustand-Stores als
  `.json` und Import (ersetzen oder zusammenführen).
- **Sync-Status-Indikator** (Sidebar/Settings): online / offline / verbinde.
- Offline-First gehärtet: `persist`-Versionierung + Rehydration-Fehlerlogging.

### Changed
- Datenmodell nutzt deterministische Record-IDs `patientId__date__therapyType`.

### Removed
- **Supabase/Cloud-BaaS-Ausbau verworfen** (DSGVO-Veto): Die in einem
  Feature-Branch vorbereitete `@supabase/supabase-js`-Anbindung (Cloud-Postgres +
  Realtime) wird nicht weiterverfolgt; stattdessen die obige On-Premise-Lösung.

## [0.2.0] - 2026-07-16 — Action Cycle 3: Routing, Persistenz & Dashboard

### Added
- **Routing (React Router):** `BrowserRouter` mit Routen `/` (Dashboard),
  `/erfassung`, `/statistik`, `/settings` und Fallback-Redirect. Unbekannte
  Pfade leiten auf das Dashboard.
- **Hauptnavigation (Sidebar)** im Corporate Design mit aktivem Zustand
  (`NavLink`) und Inline-SVG-Icons (keine Icon-Library-Dependency); auf schmalen
  Viewports als horizontale Leiste.
- **Zustand-Persistenz via IndexedDB:** `persist`-Middleware mit `idb-keyval`
  als custom Storage-Engine (`src/lib/idbStorage.ts`). Umgeht das 5-MB-Limit von
  `localStorage`; dient als Offline-Cache/Brücke bis zur BaaS-Anbindung. Nur der
  fachliche Zustand wird persistiert (`partialize`), nicht der Paint-Zustand.
- **Dashboard (`/`):** Schnellzugriff-Karten zu den übrigen Routen und eine
  „Aktuelle Übersicht", die live aus dem Store zieht (erfasste Therapien heute,
  Therapiestunden, Patienten, letzte Aktualisierung).
- **Platzhalter-Views** für Statistik und Einstellungen (`PlaceholderView`).
- **Tests:** Round-Trip-Test der IndexedDB-Brücke; `fake-indexeddb` als
  Test-Umgebung, damit die Persistenz ohne Browser läuft.

### Changed
- `App.tsx` ist jetzt die Layout-Shell (Sidebar + Routen + Footer); die frühere
  direkte Einbindung der `TherapyTable` wandert in `ErfassungPage`.
- `todayISO` nach `src/lib/date.ts` ausgelagert (geteilt von Store und Dashboard).

## [0.1.0] - 2026-07-16 — Action Cycle 2: Corporate Design & State-Management

### Added
- **Corporate Design (CSJR)** als Tailwind-v4-Tokens in `src/index.css` via
  `@theme`: Markenpalette (BrandRed `#E2001A` u. a.), semantische, theme-aware
  Tokens (Light/Dark), Typografie (Mulish/Roboto) und Eckenradien (4–24 px).
- **State-Management mit Zustand** (`src/store/therapyStore.ts`): `selectedDate`,
  `patients`, `therapyRecords` sowie Actions zum Datumswechsel, Patient-Anlegen
  und Stunden-Toggeln. Records werden lazy je (Patient, Datum, Therapieart)
  angelegt.
- **„Malen"-Geste (Drag-to-Paint):** Mit gedrückter Maustaste über die Stunden
  wischen, um mehrere Stunden in einem Zug zu markieren oder zu löschen. Die
  Startzelle bestimmt Füllen vs. Löschen; das Malen bleibt auf die gestartete
  Zeile beschränkt (kein versehentliches Übermalen fremder Zeilen).
- **UI-Wiring:** `TherapyTable` (Datumswahl, Patient-Anlage, Stundenlineal),
  `TherapyRow` (24 Zellen je Therapieart) und `HourCell` an Store und Design
  angebunden; Schichtmarker (6/13/21 Uhr) im CD-Look.
- **Unit-Tests (Vitest):** 10 Tests für die Store-Kernlogik (Paint-Verhalten,
  Same-Row-Schutz, Toggle, Datum-Isolation, Lazy-Records). Scripts `test` /
  `test:watch`.

### Changed
- `App.tsx` nutzt jetzt die semantischen CD-Tokens statt generischer Slate-Farben.

## [0.0.0] - 2026-07-16 — Action Cycle 1: Fundament

### Added
- Vite-Projekt (React + TypeScript) im Ordner `erfassung-der-therapiedauern/`.
- Tailwind CSS v4 nativ via `@tailwindcss/vite`.
- Datenmodell in `src/types/`: `TherapyType`, `Patient`, `TherapyRecord`
  (24-Stunden-boolean-Array).
- Komponenten-Skelett `src/components/therapies/`: `HourCell` (mit Schichtmarkern
  bei 6/13/21 Uhr) und `TherapyTable`-Rahmen.

### Removed
- Vite-Demo-Ballast (`App.css`, ungenutzte Beispiel-Assets).
