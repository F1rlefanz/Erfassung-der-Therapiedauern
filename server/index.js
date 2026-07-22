'use strict'

// On-Premise-Sync-Server: Express + Socket.io + SQLite.
// Empfängt CRUD-Events von Clients, persistiert sie lokal und broadcastet sie an
// alle anderen verbundenen Clients im Intranet. Kein Cloud-Dienst.
//
// Für den autonomen Windows-Server-Betrieb ausgelegt:
// - liefert das gebaute Frontend (dist/) gleich mit aus (Ein-Prozess-Betrieb),
// - schreibt Logs in eine Tages-Logdatei,
// - erstellt selbsttätig tägliche SQLite-Backups (mit Aufbewahrungsgrenze),
// - fährt bei SIGINT/SIGTERM sauber herunter und protokolliert Abstürze.

const fs = require('fs')
const path = require('path')
const http = require('http')
const express = require('express')
const cors = require('cors')
const { Server } = require('socket.io')
const db = require('./db')
const log = require('./logger')
const v = require('./validate')

const PORT = process.env.PORT || 3001

const app = express()
app.use(cors())

// Health-/Status-Endpoint (praktisch zum schnellen Prüfen im Browser).
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    patients: db.getAllPatients().length,
    records: db.getAllRecords().length,
    dbPath: db.DB_PATH,
    uptimeSeconds: Math.round(process.uptime()),
  })
})

// Kompakte Monatsaggregate (aktive Tage/Monat/Jahr/Therapieart) für die Prognose-Engine.
app.get('/aggregates/monthly-therapy', (_req, res) => {
  res.json(db.getMonthlyTherapyAggregates())
})

// ---- Frontend statisch ausliefern (falls gebaut) ------------------------
// So genügt EIN Prozess/Port für UI + Sync. Fehlt dist/, läuft der Server als
// reiner Sync-Server (Entwicklung nutzt den Vite-Dev-Server separat).
const FRONTEND_DIST =
  process.env.FRONTEND_DIST || path.join(__dirname, '..', 'erfassung-der-therapiedauern', 'dist')
const indexHtml = path.join(FRONTEND_DIST, 'index.html')
const serveFrontend = fs.existsSync(indexHtml)
if (serveFrontend) {
  app.use(express.static(FRONTEND_DIST))
  // SPA-Fallback: alle übrigen GET-Anfragen auf index.html (Client-Routing).
  // API- und Socket.io-Pfade sind oben bzw. am http-Server bereits behandelt.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/socket.io')) return next()
    res.sendFile(indexHtml)
  })
}

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

io.on('connection', (socket) => {
  log.info(`[server] Client verbunden: ${socket.id}`)

  // Neuen Client mit dem kompletten Bestand versorgen.
  socket.emit('sync:init', {
    patients: db.getAllPatients(),
    records: db.getAllRecords(),
  })
  socket.emit('aggregates:monthly-therapy', db.getMonthlyTherapyAggregates())
  socket.emit('sync:severity_stats', db.getAllSeverityStats())
  socket.emit('sync:open_therapies', db.getAllOpenTherapies())

  // Verwirft ungültige Payloads (protokolliert), bevor sie in die DB gelangen.
  const reject = (event) => log.error(`[server] ${event}: ungültige Payload verworfen`)

  socket.on('patient:upsert', (patient) => {
    if (!v.isValidPatient(patient)) return reject('patient:upsert')
    try {
      db.upsertPatient(patient)
      socket.broadcast.emit('patient:upsert', patient)
    } catch (err) {
      log.error('[server] patient:upsert fehlgeschlagen:', err.message)
    }
  })

  socket.on('record:upsert', (record) => {
    if (!v.isValidRecord(record)) return reject('record:upsert')
    try {
      db.upsertRecord(record)
      socket.broadcast.emit('record:upsert', record)
    } catch (err) {
      log.error('[server] record:upsert fehlgeschlagen:', err.message)
    }
  })

  socket.on('record:delete', (id) => {
    if (!v.isValidId(id)) return reject('record:delete')
    try {
      db.deleteRecord(id)
      socket.broadcast.emit('record:delete', id)
    } catch (err) {
      log.error('[server] record:delete fehlgeschlagen:', err.message)
    }
  })

  socket.on('patient:delete', (id) => {
    if (!v.isValidId(id)) return reject('patient:delete')
    try {
      db.deletePatient(id)
      socket.broadcast.emit('patient:delete', id)
    } catch (err) {
      log.error('[server] patient:delete fehlgeschlagen:', err.message)
    }
  })

  socket.on('severity_stat:upsert', (stat) => {
    if (!v.isValidSeverity(stat)) return reject('severity_stat:upsert')
    try {
      db.upsertSeverityStat(stat)
      socket.broadcast.emit('severity_stat:upsert', stat)
    } catch (err) {
      log.error('[server] severity_stat:upsert fehlgeschlagen:', err.message)
    }
  })

  socket.on('open_therapy:upsert', (open) => {
    if (!v.isValidOpenTherapy(open)) return reject('open_therapy:upsert')
    try {
      db.upsertOpenTherapy(open)
      socket.broadcast.emit('open_therapy:upsert', open)
    } catch (err) {
      log.error('[server] open_therapy:upsert fehlgeschlagen:', err.message)
    }
  })

  socket.on('open_therapy:delete', (id) => {
    if (!v.isValidId(id)) return reject('open_therapy:delete')
    try {
      db.deleteOpenTherapy(id)
      socket.broadcast.emit('open_therapy:delete', id)
    } catch (err) {
      log.error('[server] open_therapy:delete fehlgeschlagen:', err.message)
    }
  })

  socket.on('disconnect', () => {
    log.info(`[server] Client getrennt: ${socket.id}`)
  })
})

// ---- Autonomes tägliches SQLite-Backup ----------------------------------
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, 'data', 'backups')
const BACKUP_KEEP = Number(process.env.BACKUP_KEEP || 14)
const BACKUP_INTERVAL_MS = Number(process.env.BACKUP_INTERVAL_MS || 24 * 60 * 60 * 1000)
const p2 = (n) => String(n).padStart(2, '0')

function runBackup() {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    const d = new Date()
    const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}-${p2(d.getMinutes())}`
    const dest = path.join(BACKUP_DIR, `therapiedauern-${stamp}.db`)
    db.backupTo(dest)
    // Alte Backups über der Aufbewahrungsgrenze entfernen (Namen sind sortierbar).
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('therapiedauern-') && f.endsWith('.db'))
      .sort()
    while (files.length > BACKUP_KEEP) {
      const oldest = files.shift()
      fs.unlinkSync(path.join(BACKUP_DIR, oldest))
    }
    log.info(`[server] Backup erstellt: ${dest} (Aufbewahrung: ${BACKUP_KEEP})`)
  } catch (err) {
    log.error('[server] Backup fehlgeschlagen:', err.message)
  }
}

// ---- Sauberes Herunterfahren + Absturz-Protokollierung ------------------
let shuttingDown = false
function shutdown(signal, code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  log.info(`[server] ${signal} empfangen – fahre herunter …`)
  io.close()
  server.close(() => {
    try {
      db.checkpointAndClose()
    } catch (err) {
      log.error('[server] DB-Close-Fehler:', err.message)
    }
    log.info('[server] sauber beendet')
    process.exit(code)
  })
  // Notausstieg, falls sich Verbindungen nicht schließen lassen.
  setTimeout(() => {
    log.error('[server] Shutdown-Timeout – erzwinge Beenden')
    process.exit(code || 1)
  }, 5000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('uncaughtException', (err) => {
  log.error('[server] uncaughtException:', err)
  shutdown('uncaughtException', 1) // Dienst startet danach automatisch neu
})
process.on('unhandledRejection', (reason) => {
  log.error('[server] unhandledRejection:', reason)
})

server.listen(PORT, () => {
  log.info(`[server] On-Premise-Server läuft auf http://localhost:${PORT}`)
  log.info(`[server] SQLite-Datei: ${db.DB_PATH}`)
  log.info(`[server] Frontend: ${serveFrontend ? FRONTEND_DIST : '(nicht gebaut – reiner Sync-Server)'}`)
  runBackup() // einmal beim Start …
  setInterval(() => {
    runBackup()
    log.pruneLogs() // alte Logdateien mit aufräumen
  }, BACKUP_INTERVAL_MS).unref() // … dann täglich
})
