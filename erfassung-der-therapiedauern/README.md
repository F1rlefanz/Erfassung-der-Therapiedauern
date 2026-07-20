# Frontend — Erfassung der Therapiedauern

React-Frontend (Vite + TypeScript + Zustand + Tailwind) der Anwendung. Die
Projekt-Übersicht, den Produktivbetrieb und die Fachdokumentation findest du im
**[Repo-README](../README.md)** und unter **[../docs/](../docs/)**.

## Befehle

```bash
npm install
npm run dev       # Entwicklungsserver mit Hot-Reload (Port 5173)
npm run build     # Produktions-Build nach dist/
npm test          # Unit-Tests (Vitest)
npm run lint      # Oxlint
```

Der Sync-Server (Standard: <http://localhost:3001>) wird separat gestartet
(`npm run start:server` im Repo-Root); die Adresse ist über
`VITE_SYNC_SERVER_URL` konfigurierbar.
