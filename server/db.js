'use strict'

// Lokale SQLite-Datenhaltung des On-Premise-Sync-Servers.
// Bewusst simpel (MVP): eine Datei im Intranet, kein Cloud-Dienst.

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'therapiedauern.db')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

// Schema — analog zum fachlichen Datenmodell des Clients.
// hours_array wird als JSON-Text (boolean[24]) gespeichert.
db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id          TEXT PRIMARY KEY,
    case_number TEXT NOT NULL,
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS therapy_records (
    id              TEXT PRIMARY KEY,
    patient_id      TEXT NOT NULL,
    date            TEXT NOT NULL,
    therapy_type    TEXT NOT NULL,
    hours_array     TEXT NOT NULL,
    last_updated_at TEXT NOT NULL,
    UNIQUE (patient_id, date, therapy_type)
  );

  CREATE INDEX IF NOT EXISTS therapy_records_patient_date_idx
    ON therapy_records (patient_id, date);

  -- Manuell erfasste Schweregrad-Kennzahlen je (Jahr, Monat, Station).
  CREATE TABLE IF NOT EXISTS severity_stats (
    id          TEXT PRIMARY KEY,
    year        INTEGER NOT NULL,
    month       INTEGER NOT NULL,
    unit        TEXT NOT NULL,
    cases       INTEGER NOT NULL DEFAULT 0,
    tiss_points INTEGER NOT NULL DEFAULT 0
  );

  -- Aktuell laufende Therapien (gemerkter Start ohne Ende). Der Start übersteht
  -- Server-Neustarts, sodass Clients jederzeit bis zur aktuellen Stunde ableiten.
  CREATE TABLE IF NOT EXISTS open_therapies (
    id              TEXT PRIMARY KEY,
    patient_id      TEXT NOT NULL,
    therapy_type    TEXT NOT NULL,
    start_at        TEXT NOT NULL,
    last_updated_at TEXT NOT NULL
  );
`)

// ---- Mapper: DB-Row <-> Wire-Modell (camelCase, wie im Client) ----

function rowToPatient(row) {
  return { id: row.id, caseNumber: row.case_number, name: row.name }
}

function rowToRecord(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    therapyType: row.therapy_type,
    hours: JSON.parse(row.hours_array),
    lastUpdatedAt: row.last_updated_at,
  }
}

// ---- Prepared Statements ----

const stmtAllPatients = db.prepare('SELECT * FROM patients ORDER BY created_at ASC')
const stmtAllRecords = db.prepare('SELECT * FROM therapy_records')

const stmtUpsertPatient = db.prepare(`
  INSERT INTO patients (id, case_number, name)
  VALUES (@id, @caseNumber, @name)
  ON CONFLICT(id) DO UPDATE SET
    case_number = excluded.case_number,
    name        = excluded.name
`)

// Guard: Ein ÄLTERES Echo (z. B. von einem Client, der lange offline war und
// beim Reconnect seinen alten Stand pusht) darf einen neueren Serverstand NICHT
// überschreiben. Der WHERE-Zweig macht den Upsert dann zu einem No-Op.
const stmtUpsertRecord = db.prepare(`
  INSERT INTO therapy_records (id, patient_id, date, therapy_type, hours_array, last_updated_at)
  VALUES (@id, @patientId, @date, @therapyType, @hoursJson, @lastUpdatedAt)
  ON CONFLICT(id) DO UPDATE SET
    hours_array     = excluded.hours_array,
    last_updated_at = excluded.last_updated_at
  WHERE excluded.last_updated_at > therapy_records.last_updated_at
`)

// ---- Öffentliche API ----

function getAllPatients() {
  return stmtAllPatients.all().map(rowToPatient)
}

function getAllRecords() {
  return stmtAllRecords.all().map(rowToRecord)
}

function upsertPatient(patient) {
  stmtUpsertPatient.run({
    id: patient.id,
    caseNumber: patient.caseNumber,
    name: patient.name,
  })
}

function upsertRecord(record) {
  stmtUpsertRecord.run({
    id: record.id,
    patientId: record.patientId,
    date: record.date,
    therapyType: record.therapyType,
    hoursJson: JSON.stringify(record.hours),
    lastUpdatedAt: record.lastUpdatedAt,
  })
}

// ---- Löschen ----

const stmtDeleteRecord = db.prepare('DELETE FROM therapy_records WHERE id = ?')
const stmtDeletePatient = db.prepare('DELETE FROM patients WHERE id = ?')
const stmtDeleteRecordsOfPatient = db.prepare('DELETE FROM therapy_records WHERE patient_id = ?')
const stmtDeleteOpenOfPatient = db.prepare('DELETE FROM open_therapies WHERE patient_id = ?')

function deleteRecord(id) {
  stmtDeleteRecord.run(id)
}

/**
 * Löscht einen Patienten samt aller seiner Therapie-Records und laufenden
 * Therapien. Alles in einer Transaktion — ein Patient ohne Records wäre
 * unsichtbar, Records/offene Therapien ohne Patient würden weiter mitzählen.
 */
const deletePatient = db.transaction((patientId) => {
  stmtDeleteRecordsOfPatient.run(patientId)
  stmtDeleteOpenOfPatient.run(patientId)
  stmtDeletePatient.run(patientId)
})

// Nur Beatmungs-Records mit Datum/Stunden — die Aggregation zählt Tage mit
// mindestens einer markierten Stunde je (Jahr, Monat). So wandern nur die
// kompakten Monatsaggregate zum Client, nicht der gesamte Rohdatensatz.
const stmtVentilationRecords = db.prepare(
  "SELECT date, hours_array FROM therapy_records WHERE therapy_type = 'beatmung'",
)

/**
 * Aggregiert Beatmungstage je (Jahr, Monat) über alle Jahre. Ein Beatmungstag =
 * ein Beatmungs-Record mit ≥1 markierter Stunde. Rückgabe: kompakte Liste
 * { year, month, ventilationDays } für das Lern-Modell der Prognose.
 */
function getMonthlyVentilationAggregates() {
  const counts = new Map() // "YYYY-M" -> Anzahl
  for (const row of stmtVentilationRecords.all()) {
    let hours
    try {
      hours = JSON.parse(row.hours_array)
    } catch {
      continue
    }
    if (!Array.isArray(hours) || !hours.some(Boolean)) continue
    const year = Number(row.date.slice(0, 4))
    const month = Number(row.date.slice(5, 7))
    if (!year || !month) continue
    const key = `${year}-${month}`
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts.entries()].map(([key, ventilationDays]) => {
    const [year, month] = key.split('-').map(Number)
    return { year, month, ventilationDays }
  })
}

// ---- Schweregrad-Kennzahlen (manuelle Eingaben) ----

const stmtAllSeverity = db.prepare('SELECT * FROM severity_stats')
const stmtUpsertSeverity = db.prepare(`
  INSERT INTO severity_stats (id, year, month, unit, cases, tiss_points)
  VALUES (@id, @year, @month, @unit, @cases, @tissPoints)
  ON CONFLICT(id) DO UPDATE SET
    cases       = excluded.cases,
    tiss_points = excluded.tiss_points
`)

function rowToSeverity(row) {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    unit: row.unit,
    cases: row.cases,
    tissPoints: row.tiss_points,
  }
}

function getAllSeverityStats() {
  return stmtAllSeverity.all().map(rowToSeverity)
}

function upsertSeverityStat(stat) {
  stmtUpsertSeverity.run({
    id: stat.id,
    year: stat.year,
    month: stat.month,
    unit: stat.unit,
    cases: stat.cases,
    tissPoints: stat.tissPoints,
  })
}

// ---- Laufende Therapien ----

const stmtAllOpenTherapies = db.prepare('SELECT * FROM open_therapies')
const stmtUpsertOpenTherapy = db.prepare(`
  INSERT INTO open_therapies (id, patient_id, therapy_type, start_at, last_updated_at)
  VALUES (@id, @patientId, @therapyType, @startAt, @lastUpdatedAt)
  ON CONFLICT(id) DO UPDATE SET
    start_at        = excluded.start_at,
    last_updated_at = excluded.last_updated_at
  WHERE excluded.last_updated_at > open_therapies.last_updated_at
`)
const stmtDeleteOpenTherapy = db.prepare('DELETE FROM open_therapies WHERE id = ?')

function rowToOpenTherapy(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    therapyType: row.therapy_type,
    startAt: row.start_at,
    lastUpdatedAt: row.last_updated_at,
  }
}

function getAllOpenTherapies() {
  return stmtAllOpenTherapies.all().map(rowToOpenTherapy)
}

function upsertOpenTherapy(open) {
  stmtUpsertOpenTherapy.run({
    id: open.id,
    patientId: open.patientId,
    therapyType: open.therapyType,
    startAt: open.startAt,
    lastUpdatedAt: open.lastUpdatedAt,
  })
}

function deleteOpenTherapy(id) {
  stmtDeleteOpenTherapy.run(id)
}

/** Leert die Tabellen (für den deterministischen Seeder / Clean Slate). */
function clearAll() {
  db.exec('DELETE FROM therapy_records; DELETE FROM open_therapies; DELETE FROM patients;')
}

/** Führt `work` in einer einzigen Transaktion aus (schnelles Bulk-Insert). */
function bulkWrite(work) {
  db.transaction(work)()
}

/**
 * Schreibt das WAL in die Hauptdatei zurück und schließt die Datenbank sauber.
 * Beim Herunterfahren aufrufen, damit keine offenen WAL-Segmente zurückbleiben.
 */
function checkpointAndClose() {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)')
  } catch {
    /* Checkpoint ist best effort */
  }
  db.close()
}

/**
 * Konsistente Kopie der Datenbank nach `destPath` (Hot-Backup). Vor dem Kopieren
 * wird das WAL in die Hauptdatei gemergt; da better-sqlite3 synchron und
 * single-threaded ist, findet währenddessen kein konkurrierender Schreibzugriff
 * statt.
 */
function backupTo(destPath) {
  db.pragma('wal_checkpoint(TRUNCATE)')
  fs.copyFileSync(DB_PATH, destPath)
}

module.exports = {
  DB_PATH,
  getAllPatients,
  getAllRecords,
  upsertPatient,
  upsertRecord,
  getMonthlyVentilationAggregates,
  getAllSeverityStats,
  upsertSeverityStat,
  getAllOpenTherapies,
  upsertOpenTherapy,
  deleteOpenTherapy,
  deleteRecord,
  deletePatient,
  clearAll,
  bulkWrite,
  checkpointAndClose,
  backupTo,
}
