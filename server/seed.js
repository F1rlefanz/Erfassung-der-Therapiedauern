'use strict'

/**
 * RNG-Datenbank-Seeder (Dev-Tool) für realistische Testdaten.
 *
 * Erzeugt Beatmungs-/CRRT-/ILA-ECMO-Records für mehrere fiktive Patienten über
 * 2024, 2025 (komplett) und 2026 (bis heute). Der Zufall ist NICHT
 * gleichverteilt: Beatmungstage folgen einer saisonalen Wahrscheinlichkeitskurve
 * (Winter hoch, Sommer niedrig), damit das dynamische Saisonalitätsmodell
 * sichtbar von der linearen Hochrechnung abweicht.
 *
 * Deterministisch: fester PRNG-Seed → reproduzierbare Ergebnisse.
 * Aufruf:  npm run db:seed        (leert vorher die Tabellen — Clean Slate)
 *          npm run db:seed -- --keep   (behält vorhandene Daten)
 */

const db = require('./db')

// ---- Seeded PRNG (mulberry32) — deterministische Läufe ----
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260716)

// ---- Fiktive Patienten ----
const PATIENTS = Array.from({ length: 6 }, (_, i) => ({
  id: `seed-patient-${i + 1}`,
  caseNumber: `90000${i + 1}`,
  name: `Patient ${i + 1}`,
}))

// ---- Saisonales Wahrscheinlichkeitsprofil (pro Patient/Tag) ----
// Winter (Dez–Mär) hoch, Sommer (Jun–Aug) niedrig, Übergang mittel.
function ventilationProbability(month) {
  if ([12, 1, 2, 3].includes(month)) return 0.12
  if ([6, 7, 8].includes(month)) return 0.03
  return 0.06
}

/** Erzeugt ein realistisches 24h-Array: oft durchgehend, sonst ein Block. */
function makeHours() {
  const hours = Array(24).fill(false)
  if (rand() < 0.5) {
    hours.fill(true) // durchgehende Therapie
  } else {
    const start = Math.floor(rand() * 20)
    const length = 4 + Math.floor(rand() * 16)
    for (let h = start; h < Math.min(24, start + length); h++) hours[h] = true
  }
  if (!hours.some(Boolean)) hours[0] = true
  return hours
}

function isoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function makeRecord(patientId, date, therapyType) {
  const hours = makeHours()
  return {
    id: `${patientId}__${date}__${therapyType}`,
    patientId,
    date,
    therapyType,
    hours,
    lastUpdatedAt: `${date}T12:00:00.000Z`,
  }
}

function main() {
  const keep = process.argv.includes('--keep')

  if (!keep) {
    db.clearAll()
    console.log('[seed] Tabellen geleert (Clean Slate).')
  }

  const start = new Date(2024, 0, 1)
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  // Statistik je Jahr: Beatmungstage + Records gesamt.
  const stats = {}
  const records = []

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const date = isoDate(d)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    stats[year] ??= { beatmung: 0, records: 0 }

    for (const patient of PATIENTS) {
      if (rand() < ventilationProbability(month)) {
        records.push(makeRecord(patient.id, date, 'beatmung'))
        stats[year].beatmung += 1
        stats[year].records += 1
      }
      if (rand() < 0.03) {
        records.push(makeRecord(patient.id, date, 'crrt'))
        stats[year].records += 1
      }
      if (rand() < 0.015) {
        records.push(makeRecord(patient.id, date, 'ila_ecmo'))
        stats[year].records += 1
      }
    }
  }

  // Alles in einer Transaktion schreiben.
  db.bulkWrite(() => {
    for (const patient of PATIENTS) db.upsertPatient(patient)
    for (const record of records) db.upsertRecord(record)
  })

  console.log(`[seed] ${PATIENTS.length} Patienten angelegt.`)
  for (const year of Object.keys(stats).sort()) {
    const s = stats[year]
    console.log(`[seed] ${year}: ${s.beatmung} Beatmungstage (${s.records} Records gesamt)`)
  }
  console.log(`[seed] Gesamt: ${records.length} Records geschrieben (bis ${isoDate(today)}).`)
}

main()
