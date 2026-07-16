# Changelog

Alle nennenswerten Änderungen an „Erfassung der Therapiedauern" werden hier
dokumentiert. Das Format orientiert sich an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionierung an
[Semantic Versioning](https://semver.org/lang/de/).

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
