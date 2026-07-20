# Betrieb auf einem Windows-Server (autonom)

Der Server läuft als **Windows-Dienst**: startet automatisch beim Booten,
startet nach einem Absturz von selbst neu, liefert die Web-Oberfläche gleich mit
aus (ein Prozess, ein Port), sichert die Datenbank täglich und schreibt Logs in
eine Datei.

## Voraussetzungen

- **Node.js LTS** (x64) auf dem Server installiert.
- Der Projektordner liegt lokal auf dem Server (z. B. `D:\therapiedauern\`).

## Einmalige Einrichtung

In einer Eingabeaufforderung **im Projektordner**:

```bat
:: 1) Abhängigkeiten installieren und die Web-Oberfläche bauen
npm install
npm run build:all

:: 2) (optional) Konfiguration setzen – sonst gelten die Defaults
set PORT=3001
set DB_PATH=D:\therapiedauern\data\therapiedauern.db
set BACKUP_DIR=D:\therapiedauern\data\backups

:: 3) Als Windows-Dienst installieren  (Eingabeaufforderung ALS ADMINISTRATOR)
npm run service:install
```

Danach läuft der Dienst „**Erfassung der Therapiedauern**". Die Anwendung ist im
Intranet erreichbar unter:

```
http://<Servername-oder-IP>:3001/
```

Alle Arbeitsplätze öffnen einfach diese Adresse im Browser — es ist keine lokale
Installation nötig.

## Konfiguration (Umgebungsvariablen)

| Variable | Default | Bedeutung |
|---|---|---|
| `PORT` | `3001` | Port für UI + Sync. |
| `DB_PATH` | `server/data/therapiedauern.db` | Speicherort der SQLite-Datenbank. |
| `BACKUP_DIR` | `server/data/backups` | Ablage der automatischen Backups. |
| `BACKUP_KEEP` | `14` | Anzahl aufbewahrter Backups (älteste werden gelöscht). |
| `LOG_DIR` | `server/logs` | Ablage der Tages-Logdateien. |
| `FRONTEND_DIST` | `erfassung-der-therapiedauern/dist` | Verzeichnis der gebauten Web-Oberfläche. |

Variablen **vor** `npm run service:install` setzen — sie werden fest in den
Dienst übernommen. Zum Ändern: Dienst deinstallieren, Variablen neu setzen, neu
installieren.

## Was der Dienst autonom tut

- **Auto-Start** beim Hochfahren des Servers.
- **Neustart nach Absturz** (durch den Dienst-Wrapper).
- **Tägliches Backup** der Datenbank nach `BACKUP_DIR` (Dateiname mit Datum/Zeit),
  Aufbewahrung der letzten `BACKUP_KEEP` Stände. Ein Backup wird auch bei jedem
  Start erstellt.
- **Logdatei** je Tag unter `LOG_DIR` (`server-JJJJ-MM-TT.log`) mit Verbindungen,
  Backups und etwaigen Fehlern/Abstürzen.
- **Sauberes Herunterfahren** (WAL-Checkpoint) bei Dienststopp.

## Dienst verwalten

- Grafisch: `services.msc` → „Erfassung der Therapiedauern".
- Kommandozeile (als Administrator):
  ```bat
  net stop  "Erfassung der Therapiedauern"
  net start "Erfassung der Therapiedauern"
  ```

## Aktualisieren (neue Version einspielen)

```bat
net stop "Erfassung der Therapiedauern"
:: neuen Code holen (git pull o. Ä.)
npm install
npm run build:all
net start "Erfassung der Therapiedauern"
```

Bei geänderter Datenbankstruktur ist nichts weiter zu tun — fehlende Tabellen
werden beim Start automatisch angelegt (bestehende Daten bleiben erhalten).

## Backup zurückspielen

1. Dienst stoppen: `net stop "Erfassung der Therapiedauern"`.
2. Die gewünschte Datei aus `BACKUP_DIR` über `DB_PATH` kopieren (die aktuelle
   `*.db` ersetzen; eventuelle `*.db-wal`/`*.db-shm` daneben vorher löschen).
3. Dienst starten: `net start "Erfassung der Therapiedauern"`.

> Zusätzlich gibt es in der App unter **Einstellungen → Backup & Restore** einen
> manuellen JSON-Export/-Import (Patienten, Therapiezeiten, Schweregrad-Kennzahlen,
> laufende Therapien).

## Dienst entfernen

```bat
npm run service:uninstall   :: als Administrator
```

## Ohne Dienst starten (Test/Entwicklung)

```bat
npm run start:server
```

Der Server läuft dann im Vordergrund (Logs zusätzlich auf der Konsole). Für die
reine Entwicklung nutzt das Frontend weiterhin den Vite-Dev-Server
(`npm run dev` im Ordner `erfassung-der-therapiedauern`).
