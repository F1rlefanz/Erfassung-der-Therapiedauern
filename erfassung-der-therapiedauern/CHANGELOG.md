# Changelog

Alle nennenswerten Änderungen an „Erfassung der Therapiedauern" werden hier
dokumentiert. Das Format orientiert sich an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionierung an
[Semantic Versioning](https://semver.org/lang/de/).

## [0.14.0] - 2026-07-20 — Rohdaten-Export (Von/Bis) & laufende Therapie verwerfen

### Added
- **CSV-Rohdaten-Export „Von/Bis"** im MDK-Tab: eine Zeile je zusammenhängender
  Therapie-Episode (auch über Mitternacht), mit Fallnummer, Name, Therapieart,
  Beginn-Datum, Von (`HH:00`), Ende-Datum, Bis (`HH:59`) und Stunden. Laufende
  Therapien fließen bis zur aktuellen Stunde ein. Ergänzt den aggregierten
  CSV-Export, ersetzt ihn nicht.
- **Laufende Therapie verwerfen**: „✕" neben „Beenden" entfernt eine laufende
  Therapie, OHNE Stunden zu speichern — für einen versehentlichen „Läuft"-Klick.

## [0.13.0] - 2026-07-20 — Laufende Therapien, Patientenverwaltung & Legacy-Regeln

### Added
- **Laufende Therapien**: Je Therapiezeile „▶ Läuft" merkt den Start, „■ Beenden"
  schließt ab. Eine laufende Therapie füllt automatisch bis zur aktuellen Stunde
  — auch über Mitternacht und nach einem Absturz/Server-Neustart (nur der Start
  wird gemerkt und synchronisiert; Zeitvergehen erzeugt keinen Schreibvorgang).
  Ersetzt den bisherigen manuellen Button „Vortag fortführen".
- **Langzeit-Warnung** an laufenden Therapien: dezenter Puls unter 14 Tagen; ab
  14 Tagen (Langzeitbeatmung) und ab 28 Tagen („Ende vergessen?") ein ⓘ mit
  erklärendem Maus-Over. Schwellen an den klinischen Definitionen orientiert.
- **Patienten bearbeiten & löschen**: Name/Fallnummer über ✎ ändern (explizites
  Speichern/Abbrechen, keine stillen Änderungen). Löschen in drei Stufen (Tag
  zurücksetzen · Therapieart über alle Tage · ganzer Patient) mit konkret
  bezifferter Warnung. Fallnummern sind eindeutig; Doppelvergabe wird abgelehnt.
- **Monatsstatistik je Therapieart** (Analysen, aus dem Legacy nachgebaut):
  Stunden, begonnene/ganze Tage, neue & fortgeführte Fälle, Tage/Fall, mit
  Jahres-Summe und Monatsdurchschnitt.
- **Regel-Legende** in der Schweregradstatistik: aufklappbare Erklärung jeder
  Spalte, manuelle Felder (✎) klar von berechneten unterschieden, Header-Tooltips.
- Neue Spalte **„Fortgeführte Beatmungspatienten"** (ICU): im Vormonat beatmete
  Patienten zählen nicht als neuer Fall des Monats (Re-Intubation = kein neuer
  Fall) — wirkt legacy-treu auf Beatmungspatienten, Anteil % und Ø Beatmungsdauer.

### Changed
- **Prognose** rechnet erst ab 3 Monaten Datenbasis hoch (sonst Hinweis statt
  erfundener Zahl) und zeigt eine Konfidenz-Angabe.
- **Tages-Summenzeile** der Erfassung zeigt zusätzlich die Fallzahl je Therapieart.

### Fixed
- Endlosschleife im Stundenraster bei einer laufenden Therapie (weiße Seite).

### Technical
- On-Premise-Server: neue SQLite-Tabelle `open_therapies` mit Socket.io-Sync
  (`sync:open_therapies` / `open_therapy:upsert` / `open_therapy:delete`),
  kaskadiert beim Patienten-Löschen. Löschungen via „Grabsteine" gegen
  Wiederauferstehen offline gelöschter Einträge.

## [0.12.0] - 2026-07-16 — Action Cycle 13: IA-Refactoring (Visuell vs. Tabellarisch)

### Changed
- **Routen umbenannt & fachlich getrennt** nach „Visuell vs. Tabellarisch":
  - `/hochrechnungen` → **`/analysen`** (Sidebar „Analysen & Graphen",
    Lucide `bar-chart-3`).
  - `/statistik` → **`/reporting`** (Sidebar „Reporting & Controlling",
    Lucide `table`).
- **`/analysen`** enthält nur noch die visuellen Elemente: Jahr-Dropdown,
  KPI-Karten, Prognose-Toggle und die Charts (ComposedChart + Verteilung).
  Detailtabelle und CSV/PDF-Export wurden entfernt.
- **`/reporting`** bündelt alle Tabellen mit einer Tab-Navigation (CSJR-
  Border-Bottom-Tabs): Tab **„Schweregrad"** (ICU/IMC) und Tab **„MDK-Export"**
  (Detailtabelle + CSV/PDF). Das Jahr-Dropdown filtert die ganze Seite.
  Beim Drucken wird nur der aktive Tab gerendert; die Tab-Leiste ist `no-print`.
- **Dateien reorganisiert**: `components/analysen/` (ProjectionToggle),
  `components/reporting/` (DetailTable, SeverityInput, SeverityTables),
  geteilter `components/YearSelector`; Seiten `AnalysenPage`/`ReportingPage`.

## [0.11.0] - 2026-07-16 — Action Cycle 12: Routing-Split & Schweregradstatistik (ICU/IMC)

### Added
- **Neue Route `/hochrechnungen`**: alle bisherigen Analytics (Monats-/YoY-
  `ComposedChart`, Prognose-Toggle, KPI-Karten, MDK-Detailtabelle) von
  `/statistik` hierher verschoben. Sidebar-Eintrag „Hochrechnungen"
  (Lucide `trending-up`).
- **Schweregradstatistik auf `/statistik`** (aus dem Legacy-System nachgebaut):
  - **ICU (Intensivstation 10)** — 12 Monatszeilen + Summe: berechnete Spalten
    (begonnene/ganze Beatmungstage, Beatmungsstunden, Beatmungspatienten,
    Anteil %, Ø Beatmungsdauer, Hämofiltrations-/ECMO-Tage) aus den
    TherapyRecords, plus manuelle Felder Fälle & TISS-28 und die abgeleitete
    TISS-28/Fall.
  - **IMC (Operative IMC)** — 12 Monatszeilen + Summe: manuelle Fälle & TISS-28
    plus abgeleitete TISS-28/Fall.
- **Persistenz für manuelle Eingaben** (On-Premise): neue SQLite-Tabelle
  `severity_stats` (id `year__month__unit`, cases, tiss_points) mit CRUD und
  Socket.io-Sync (`sync:severity_stats` / `severity_stat:upsert`). Store hält
  die Werte offline-first (idb-keyval) und pusht debounced an den Server.
- Reiner Berechnungs-Service `src/lib/severity/severityStats.ts` (ICU-Monats-
  aggregation + abgeleitete Kennzahlen) mit Unit-Tests.

### Changed
- Nur noch die Hochrechnungen laden `recharts` nach (Code-Splitting verschoben);
  `/statistik` (Schweregrad) ist damit leichtgewichtig.

## [0.10.0] - 2026-07-16 — Action Cycle 11: Gesamtzeiten & Summenzeilen in der Erfassung

### Added
- **Gesamtzeit je Zeile** in `/erfassung`: am Ende jeder Therapie-Zeile eine
  nicht-interaktive Zelle mit der Summe der markierten Stunden (dezenter grauer
  Hintergrund, `font-bold`), plus „Gesamt"-Spaltenkopf im Stundenlineal.
- **Tages-Summenzeile** unter der Tabelle (`TherapyDayTotals`): Gesamtzeit je
  Therapieart über alle Patienten am gewählten Tag (Beatmung / CRRT / ILA/ECMO)
  sowie ein Tagesgesamt — abgeleitet aus dem alten Legacy-Konzept
  („Gesamtzeit aller Patienten").

## [0.9.0] - 2026-07-16 — Action Cycle 10: MDK-Reporting & Controlling-Exporte (CSV/Print)

### Added
- **Detailauswertung je Patient** (`/statistik`): tabellarische Ansicht für das
  gewählte Jahr — Patient, Fallnummer, Beatmungstage, Therapiestunden, davon
  CRRT (h), davon iLA/ECMO (h), inkl. Summenzeile. Sticky Header, Hover-Zeilen,
  Corporate Design (`DetailTable`).
- **Export-Engine** `src/lib/exports/`:
  - `reportRows.ts`: reine Aggregation je Patient/Jahr (`buildPatientYearRows`).
  - `csvExport.ts`: standardisiertes CSV (`;`-getrennt, CRLF, UTF-8-BOM für
    deutsches Excel) inkl. Summenzeile; Download als `beatmungstage_<jahr>.csv`.
  - Unit-Tests für Aggregation und CSV-Generator (Header, Zuordnung, Escaping).
- **Print-/PDF-Export** ohne schwere Library: `@media print`-Stylesheet blendet
  Sidebar, Navigation, interaktive Steuerungen und Diagramme aus und optimiert
  KPIs + Tabelle für DIN A4 (helles Schema erzwungen, Seitenumbruch-Schutz,
  wiederholter Tabellenkopf). Auslösung per `window.print()` → nativ „Als PDF
  speichern".
- **Action Bar** über der Tabelle: „Als CSV herunterladen" und „Drucken / PDF"
  (mit Icons); Buttons sind deaktiviert, wenn keine Daten für das Jahr vorliegen.

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
