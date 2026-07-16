'use strict'

// On-Premise-Sync-Server (MVP): Express + Socket.io + SQLite.
// Empfängt CRUD-Events von Clients, persistiert sie lokal und broadcastet sie
// an alle anderen verbundenen Clients im Intranet. Kein Cloud-Dienst.

const http = require('http')
const express = require('express')
const cors = require('cors')
const { Server } = require('socket.io')
const db = require('./db')

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
  })
})

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

io.on('connection', (socket) => {
  console.log(`[server] Client verbunden: ${socket.id}`)

  // Neuen Client mit dem kompletten Bestand versorgen.
  socket.emit('sync:init', {
    patients: db.getAllPatients(),
    records: db.getAllRecords(),
  })

  socket.on('patient:upsert', (patient) => {
    try {
      db.upsertPatient(patient)
      // An alle ANDEREN Clients weiterreichen (Sender hat den Wert lokal schon).
      socket.broadcast.emit('patient:upsert', patient)
    } catch (err) {
      console.error('[server] patient:upsert fehlgeschlagen:', err.message)
    }
  })

  socket.on('record:upsert', (record) => {
    try {
      db.upsertRecord(record)
      socket.broadcast.emit('record:upsert', record)
    } catch (err) {
      console.error('[server] record:upsert fehlgeschlagen:', err.message)
    }
  })

  socket.on('disconnect', () => {
    console.log(`[server] Client getrennt: ${socket.id}`)
  })
})

server.listen(PORT, () => {
  console.log(`[server] On-Premise-Sync-Server läuft auf http://localhost:${PORT}`)
  console.log(`[server] SQLite-Datei: ${db.DB_PATH}`)
})
