# Changelog

Alle nennenswerten Änderungen an „Erfassung der Therapiedauern" werden hier
dokumentiert. Das Format orientiert sich an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionierung an
[Semantic Versioning](https://semver.org/lang/de/).

## [0.8.0] - 2026-07-16 — Action Cycle 9: Monatswerte & Year-over-Year-Overlays

### Changed
- **Beatmungstage-Chart auf absolute Monatswerte umgestellt** (nicht mehr
  kumuliert) — die Saisonalität (Winter-Peaks, Sommer-Täler) ist direkt ablesbar.
- **Recharts `ComposedChart`**: das gewählte Jahr als prägnante Balken (Ist),
  die übrigen Jahre als dezente graue Overlay-Linien, die Prognose der
  Restmonate als gestrichelte Linie in der Markenfarbe. Custom-Tooltip listet
  alle Jahreswerte (Ist, Vergleichsjahre, Prognose) je Monat.

### Added
- `buildMonthlyComparison` / `monthlyVentilation` in `src/lib/statistics.ts`:
  flache Monatsobjekte mit einem Key je Jahr (`{ month, '2026', '2025', … }`)
  plus isolierten Prognose-Monatswerten (`'<jahr>_Prognose'`) für die Restmonate
  des laufenden Jahres. Unit-Tests für nicht-kumulierte Monatsscheiben und
  Prognose-Keys.

### Notes
- KPI-Karten (Patienten, Beatmungstage, Stunden) unverändert; die
  Jahresend-Prognose bleibt als Text-Kennzahl erhalten, ist aber vom Chart
  entkoppelt.

## [0.7.0] - 2026-07-16 — Action Cycle 8: Jahresauswahl in der Statistik

### Added
- **Jahres-Filter** im Statistik-Dashboard: dezentes `YearSelector`-Dropdown im
  Header. Auswählbare Jahre werden dynamisch aus den vorhandenen Records/Aggregaten
  ermittelt (aktuelles Jahr immer enthalten).
- Kennzahlen (Patienten, Beatmungstage, Therapiestunden) und die
  Therapiearten-Verteilung filtern verzögerungsfrei clientseitig auf das gewählte
  Jahr.
- **Bedingtes Rendering der Prognose**: nur im laufenden Jahr Toggle (Linear/
  Saisonal) + Jahresend-Prognose; für abgeschlossene Vorjahre wird ausschließlich
  der finale kumulierte Ist-Verlauf über alle 12 Monate gezeigt (keine Hochrechnung).
- Jahresbezogene Logik ausgelagert nach `src/lib/statistics.ts` (`availableYears`,
  `buildYearProjection`) mit Unit-Tests (`statistics.test.ts`): Vorjahre liefern
  statische Ist-Arrays ohne Prognose.

## [0.6.0] - 2026-07-16 — Action Cycle 7: RNG-Datenbank-Seeder (Dev-Tool)

### Added
- **Seeder-Skript** `server/seed.js` (`npm run db:seed`): generiert deterministisch
  (fester PRNG-Seed) realistische Testdaten für 2024, 2025 (komplett) und 2026
  (bis heute) für sechs fiktive Patienten. Beatmungstage folgen einer **saisonalen
  Wahrscheinlichkeitskurve** (Winter Dez–Mär hoch, Sommer Jun–Aug niedrig,
  Übergang mittel); zusätzlich vereinzelt CRRT und ILA/ECMO. IDs im Format
  `patientId__date__therapyType`. Optionaler Clean-Slate (Standard) bzw. `--keep`.
- Klarer Konsolen-Output je Jahr (z. B. „2024: 153 Beatmungstage (249 Records)").
- `server/db.js`: `clearAll()` (Tabellen leeren) und `bulkWrite()` (Transaktion).

### Notes
- Mit den Seed-Daten greifen die gelernten Vorjahresgewichte: die saisonale
  Jahresend-Prognose weicht nun sichtbar von der linearen ab (Demo: 117 vs. 139
  Beatmungstage).

## [0.5.0] - 2026-07-16 — Action Cycle 6: Intelligente Prognosen (Dynamic Seasonal Weighting)

### Added
- **Prognose-Engine** `src/lib/projections/` (rein, unit-getestet):
  - **Lineare Hochrechnung** (Baseline): `Wert_YTD / verstrichene Tage * Tage/Jahr`.
  - **Dynamische saisonale Hochrechnung** (Standard): rechnet die Jahresend-
    Prognose über die Monatsverteilung heraus. Die Gewichte werden aus den
    Beatmungstagen der **Vorjahre gelernt**; ohne Historie greift ein
    **ICU-Fallback** (Winter hoch, Sommer niedrig). Teilmonate anteilig.
- **Server-Aggregation** ohne Rohdaten-Transfer: `server/db.js` liefert
  Beatmungstage je (Jahr, Monat); Auslieferung an den Client per Socket-Event
  (`aggregates:monthly-ventilation`) und REST (`/aggregates/monthly-ventilation`).
  Der Client hält nur die kompakten Monatsaggregate im Store (mitpersistiert →
  Prognose auch offline mit gelernten Gewichten).
- **UI im Statistik-Dashboard**: `ProjectionToggle` (Linear ↔ Saisonal/Empfohlen)
  mit Info-Tooltip zur Datenbasis („… von X Vorjahren" bzw. „Klinischer
  Standard-Fallback"); kumulativer Beatmungstage-Verlauf mit **Ist (durchgezogen)**
  und **gestrichelter Prognose-Linie** (Recharts) sowie Jahresend-Prognose-Kennzahl.
- Unit-Tests `projections.test.ts`: lineare Hochrechnung zur Jahresmitte und
  saisonale Hochrechnung im Februar (moderater als linear bei Winter-Gewicht).

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
