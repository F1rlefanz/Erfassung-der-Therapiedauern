# Erfassung der Therapiedauern

On-Premise-Anwendung zur **stundengenauen Erfassung von Therapiedauern** auf der
Intensivstation (Beatmung, Nierenersatz/CRRT, ILA/ECMO) samt Auswertung
(Schweregradstatistik, MDK-Export, Prognosen). Läuft vollständig im eigenen
Intranet — **keine Cloud**, klinische Daten bleiben lokal.

## Aufbau (Monorepo)

| Ordner | Inhalt |
|---|---|
| `erfassung-der-therapiedauern/` | React-Frontend (Vite, TypeScript, Zustand, Tailwind). |
| `server/` | Sync-Server (Express + Socket.io + SQLite). Liefert im Produktivbetrieb auch die Web-Oberfläche aus. |
| `docs/` | Dokumentation (siehe unten). |

Datenmodell: ein Datensatz je **Patient × Tag × Therapieart** mit einem
24-Stunden-Raster. Alle Kennzahlen werden daraus abgeleitet; nur Fallzahlen und
TISS-28-Punkte der Schweregradstatistik werden manuell erfasst.

## Schnellstart (Entwicklung)

```bash
# 1) Sync-Server (Port 3001)
npm install
npm run start:server

# 2) Frontend mit Hot-Reload (Port 5173) – in einem zweiten Terminal
cd erfassung-der-therapiedauern
npm install
npm run dev
```

App unter <http://localhost:5173/>. Tests: `npm test` (im Frontend-Ordner).

## Produktivbetrieb (autonom auf einem Windows-Server)

Der Server läuft als Windows-Dienst (Auto-Start, Neustart nach Absturz),
liefert die UI selbst aus (ein Prozess/Port), sichert die Datenbank täglich und
schreibt Logdateien. Vollständige Anleitung:

➡️ **[docs/Betrieb-Windows.md](docs/Betrieb-Windows.md)**

## Dokumentation

- **[docs/Feldverarbeitung.md](docs/Feldverarbeitung.md)** — für jedes Feld
  eineindeutig: Herkunft (manuell/berechnet) und Verarbeitung, mit Screenshots.
- **[docs/Betrieb-Windows.md](docs/Betrieb-Windows.md)** — Einrichtung, Betrieb,
  Backup, Update auf dem Windows-Server.
- **[erfassung-der-therapiedauern/CHANGELOG.md](erfassung-der-therapiedauern/CHANGELOG.md)**
  — Versionsverlauf.
