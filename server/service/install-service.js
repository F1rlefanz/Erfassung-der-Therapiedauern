'use strict'

// Installiert den On-Premise-Server als Windows-Dienst (Auto-Start beim Booten,
// automatischer Neustart nach Absturz). Muss in einer Eingabeaufforderung mit
// Administratorrechten ausgeführt werden:
//
//   npm run service:install
//
// Optionale Konfiguration über Umgebungsvariablen VOR dem Aufruf, z. B.:
//   set PORT=3001
//   set DB_PATH=D:\therapiedauern\data\therapiedauern.db
//   set BACKUP_DIR=D:\therapiedauern\backups
//   npm run service:install

const path = require('path')
const { Service } = require('node-windows')

// Nur gesetzte Variablen an den Dienst weiterreichen (sonst greifen die
// Defaults aus index.js/db.js).
const passthrough = ['PORT', 'DB_PATH', 'BACKUP_DIR', 'BACKUP_KEEP', 'LOG_DIR', 'FRONTEND_DIST']
const env = passthrough
  .filter((name) => process.env[name] !== undefined)
  .map((name) => ({ name, value: process.env[name] }))

const svc = new Service({
  name: 'Erfassung der Therapiedauern',
  description: 'On-Premise-Sync-Server + Web-UI für die Erfassung der Therapiedauern.',
  script: path.join(__dirname, '..', 'index.js'),
  env,
  // node-windows startet den Dienst nach einem Absturz automatisch neu.
  wait: 2,
  grow: 0.5,
  maxRestarts: 10,
})

svc.on('install', () => {
  console.log('[service] Dienst installiert – starte …')
  svc.start()
})
svc.on('alreadyinstalled', () => console.log('[service] Dienst ist bereits installiert.'))
svc.on('start', () => console.log('[service] Dienst läuft. Auto-Start beim Booten ist aktiv.'))
svc.on('error', (err) => console.error('[service] Fehler:', err))

svc.install()
