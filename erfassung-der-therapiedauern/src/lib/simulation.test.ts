import { describe, expect, it } from 'vitest'
import type { Patient, TherapyRecord, TherapyType } from '../types'
import { computeIcuMonthly, buildIcuRow, ventPercentage, avgVentDuration, tissPerCase } from './severity/severityStats'
import { buildTherapyMonthRow, buildTherapyYear, sumTherapyYear } from './therapyMonthlyStats'
import { buildPatientYearRows } from './exports/reportRows'
import { monthlyVentilation } from './statistics'
import { recordsToEpisodes } from './episodes/episodes'
import { buildEpisodeRows } from './exports/episodeRows'

/**
 * Intensive 14-Monats-Simulation (Dez 2025 – Jan 2027, über zwei Jahresgrenzen)
 * mit vielen Patienten und Szenario-Permutationen.
 *
 * Kernidee: Jede Kennzahl wird hier ein ZWEITES Mal, unabhängig und per einfacher
 * Brute-Force über die Roh-Records berechnet und feldweise mit den echten
 * App-Funktionen verglichen. Stimmen beide über alle Monate/Jahre/Patienten
 * überein, ist die App-Berechnung gegen die Spezifikation abgesichert.
 */

// ---- Deterministischer PRNG (mulberry32), damit die Simulation reproduzierbar ist ----
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const THERAPIES: TherapyType[] = ['beatmung', 'crrt', 'ila_ecmo']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** 14-Monats-Fenster als (Jahr, Monat)-Liste. */
const MONTHS: { year: number; month: number }[] = (() => {
  const out: { year: number; month: number }[] = []
  let y = 2025, m = 12
  for (let i = 0; i < 14; i++) {
    out.push({ year: y, month: m })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
})()
const YEARS = [...new Set(MONTHS.map((x) => x.year))] // [2025, 2026, 2027]

function rec(patientId: string, date: string, tt: TherapyType, activeHours: number[]): TherapyRecord {
  const hours = Array<boolean>(24).fill(false)
  for (const h of activeHours) hours[h] = true
  return { id: `${patientId}__${date}__${tt}`, patientId, date, therapyType: tt, hours, lastUpdatedAt: `${date}T12:00:00.000Z` }
}

/** Baut den kompletten Datensatz: handgemachte Grenzfälle + viele Zufalls-Patienten. */
function buildDataset(seed = 20260720) {
  const patients: Patient[] = []
  const records: TherapyRecord[] = []
  const addPatient = (id: string, cn: string) => {
    patients.push({ id, name: `Sim ${id}`, caseNumber: cn })
  }

  // ---- Handgemachte Permutationen (garantierte Grenzfälle) ----
  addPatient('H1', '900101') // Dauerlieger: Beatmung Tag 10, 24h, JEDEN Monat (durchgehend fortgeführt)
  for (const { year, month } of MONTHS) records.push(rec('H1', iso(year, month, 10), 'beatmung', range(0, 23)))

  addPatient('H2', '900102') // Einmalig: Beatmung 12h nur im März 2026
  records.push(rec('H2', iso(2026, 3, 15), 'beatmung', range(0, 11)))

  addPatient('H3', '900103') // Lücke: Beatmung Mai + Juli 2026 (Juni frei) -> Juli wieder NEU
  records.push(rec('H3', iso(2026, 5, 5), 'beatmung', range(0, 23)))
  records.push(rec('H3', iso(2026, 7, 5), 'beatmung', range(0, 23)))

  addPatient('H4', '900104') // Jahreswechsel: Beatmung Dez 2025 + Jan 2026 (fortgeführt über Jahresgrenze)
  records.push(rec('H4', iso(2025, 12, 30), 'beatmung', range(0, 23)))
  records.push(rec('H4', iso(2026, 1, 2), 'beatmung', range(0, 23)))

  addPatient('H5', '900105') // Multi: alle drei Arten am selben Tag (April 2026)
  records.push(rec('H5', iso(2026, 4, 3), 'beatmung', range(0, 9)))
  records.push(rec('H5', iso(2026, 4, 3), 'crrt', range(0, 23)))
  records.push(rec('H5', iso(2026, 4, 3), 'ila_ecmo', [6, 7, 8, 9, 10]))

  addPatient('H6', '900106') // Teilstunden
  records.push(rec('H6', iso(2026, 6, 1), 'beatmung', [8, 9, 10]))
  records.push(rec('H6', iso(2026, 6, 2), 'beatmung', [7, 8]))

  addPatient('H7', '900107') // Cross-Midnight: Aug 31 (22,23) + Sep 01 (0,1) -> Sep fortgeführt
  records.push(rec('H7', iso(2026, 8, 31), 'beatmung', [22, 23]))
  records.push(rec('H7', iso(2026, 9, 1), 'beatmung', [0, 1]))

  addPatient('H8', '900108') // Re-Intubation im selben Monat (zwei Läufe, ein Fall)
  records.push(rec('H8', iso(2026, 10, 3), 'beatmung', range(0, 5)))
  records.push(rec('H8', iso(2026, 10, 20), 'beatmung', range(0, 5)))

  // ---- Zufalls-Patienten (seeded) für breite Permutationsabdeckung ----
  const rng = mulberry32(seed)
  const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)]
  for (let p = 0; p < 45; p++) {
    const id = `R${p}`
    addPatient(id, `9002${pad(p)}`)
    // zufällige Anzahl von Monaten, in denen dieser Patient überhaupt auftaucht
    const monthCount = 1 + Math.floor(rng() * 6)
    for (let k = 0; k < monthCount; k++) {
      const { year, month } = pick(MONTHS)
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
      const day = 1 + Math.floor(rng() * daysInMonth)
      const tt = pick(THERAPIES)
      // zufälliges Stundenmuster: voll / Block / verstreut
      const mode = rng()
      let hours: number[]
      if (mode < 0.3) hours = range(0, 23)
      else if (mode < 0.8) {
        const start = Math.floor(rng() * 20)
        const len = 1 + Math.floor(rng() * (24 - start))
        hours = range(start, start + len - 1)
      } else {
        hours = []
        for (let h = 0; h < 24; h++) if (rng() < 0.35) hours.push(h)
      }
      if (hours.length === 0) hours = [Math.floor(rng() * 24)]
      records.push(rec(id, iso(year, month, day), tt, hours))
    }
  }

  // Doppelte (patient,date,therapie)-Kombinationen zusammenführen (letzter gewinnt),
  // damit die Roh-Records konfliktfrei sind wie in der App (upsert per id).
  const byId = new Map<string, TherapyRecord>()
  for (const r of records) byId.set(r.id, r)
  return { patients, records: [...byId.values()] }
}

function range(a: number, b: number): number[] {
  const out: number[] = []
  for (let i = a; i <= b; i++) out.push(i)
  return out
}

// ---- Unabhängige (Brute-Force-)Referenz über die Roh-Records ----
const activeHoursOf = (r: TherapyRecord) => r.hours.reduce((s, v) => s + (v ? 1 : 0), 0)
const isActive = (r: TherapyRecord) => r.hours.some(Boolean)
const inMonth = (r: TherapyRecord, y: number, m: number) => r.date.slice(0, 7) === `${y}-${pad(m)}`
const prevMonth = (y: number, m: number) => (m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 })

function patientsOfType(records: TherapyRecord[], tt: TherapyType, y: number, m: number): Set<string> {
  const s = new Set<string>()
  for (const r of records) if (r.therapyType === tt && inMonth(r, y, m) && isActive(r)) s.add(r.patientId)
  return s
}

/**
 * Führt ALLE differenziellen Feldvergleiche (App vs. Brute-Force) für einen
 * Datensatz aus. Wird sowohl für den Basis-Seed (Einzeltests unten) als auch in
 * der Schleife über viele Seeds genutzt.
 */
function verifyDataset(pats: Patient[], recs: TherapyRecord[], tag: string): void {
  for (const { year, month } of MONTHS) {
    const app = computeIcuMonthly(recs, year, month)
    const beatm = recs.filter((r) => r.therapyType === 'beatmung' && inMonth(r, year, month))
    const ventHours = beatm.reduce((s, r) => s + activeHoursOf(r), 0)
    const cur = patientsOfType(recs, 'beatmung', year, month)
    const pm = prevMonth(year, month)
    const prev = patientsOfType(recs, 'beatmung', pm.y, pm.m)
    let nw = 0, ct = 0
    for (const id of cur) { if (prev.has(id)) ct++; else nw++ }
    const L = `${tag} ${year}-${pad(month)}`
    expect(app.startedVentDays, `ICU.startedVentDays ${L}`).toBe(beatm.filter(isActive).length)
    expect(app.ventHours, `ICU.ventHours ${L}`).toBe(ventHours)
    expect(app.completeVentDays, `ICU.completeVentDays ${L}`).toBe(Math.floor(ventHours / 24))
    expect(app.ventPatients, `ICU.new ${L}`).toBe(nw)
    expect(app.continuedVentPatients, `ICU.cont ${L}`).toBe(ct)
    expect(app.crrtDays, `ICU.crrt ${L}`).toBe(recs.filter((r) => r.therapyType === 'crrt' && inMonth(r, year, month) && isActive(r)).length)
    expect(app.ecmoDays, `ICU.ecmo ${L}`).toBe(recs.filter((r) => r.therapyType === 'ila_ecmo' && inMonth(r, year, month) && isActive(r)).length)

    for (const tt of THERAPIES) {
      const a = buildTherapyMonthRow(recs, tt, year, month)
      const ofType = recs.filter((r) => r.therapyType === tt && inMonth(r, year, month))
      const c = patientsOfType(recs, tt, year, month)
      const p = patientsOfType(recs, tt, pm.y, pm.m)
      let n2 = 0, c2 = 0
      for (const id of c) { if (p.has(id)) c2++; else n2++ }
      const active = ofType.filter(isActive).length
      const hrs = ofType.reduce((s, r) => s + activeHoursOf(r), 0)
      expect(a.hours, `MS.hours ${tt} ${L}`).toBe(hrs)
      expect(a.startedDays, `MS.started ${tt} ${L}`).toBe(active)
      expect(a.completeDays, `MS.complete ${tt} ${L}`).toBe(Math.floor(hrs / 24))
      expect(a.newCases, `MS.new ${tt} ${L}`).toBe(n2)
      expect(a.continuedCases, `MS.cont ${tt} ${L}`).toBe(c2)
    }
  }

  for (const year of YEARS) {
    const mv = monthlyVentilation(recs, year)
    for (let m = 1; m <= 12; m++) {
      expect(mv[m], `MV ${tag} ${year}-${pad(m)}`).toBe(
        recs.filter((r) => r.therapyType === 'beatmung' && inMonth(r, year, m) && isActive(r)).length,
      )
    }
    const rows = buildPatientYearRows(pats, recs, year)
    for (const patient of pats) {
      const own = recs.filter((r) => r.patientId === patient.id && r.date.startsWith(`${year}-`))
      const row = rows.find((x) => x.patientId === patient.id)
      if (own.length === 0) { expect(row).toBeUndefined(); continue }
      expect(row!.ventilationDays).toBe(own.filter((r) => r.therapyType === 'beatmung' && isActive(r)).length)
      expect(row!.totalHours).toBe(own.reduce((s, r) => s + activeHoursOf(r), 0))
      expect(row!.crrtHours).toBe(own.filter((r) => r.therapyType === 'crrt').reduce((s, r) => s + activeHoursOf(r), 0))
      expect(row!.ilaEcmoHours).toBe(own.filter((r) => r.therapyType === 'ila_ecmo').reduce((s, r) => s + activeHoursOf(r), 0))
    }
  }

  // Episoden verlustfrei + Von/Bis-Summe
  const totalActive = recs.reduce((s, r) => s + activeHoursOf(r), 0)
  const NOW = '2027-12-31T23'
  expect(buildEpisodeRows(pats, recs, NOW).reduce((s, r) => s + r.hours, 0), `Episoden-Summe ${tag}`).toBe(totalActive)

  // Orthogonaler Check: Σ neue Fälle = Anzahl Monats-Läufe je Patient
  let appNew = 0
  for (const { year, month } of MONTHS) appNew += computeIcuMonthly(recs, year, month).ventPatients
  let runs = 0
  for (const patient of pats) {
    let prevA = false
    for (const { year, month } of MONTHS) {
      const a = recs.some((r) => r.patientId === patient.id && r.therapyType === 'beatmung' && inMonth(r, year, month) && isActive(r))
      if (a && !prevA) runs++
      prevA = a
    }
  }
  expect(appNew, `Σneu=Läufe ${tag}`).toBe(runs)
}

const { patients, records } = buildDataset()

describe(`Intensive Simulation über ${MONTHS.length} Monate (${records.length} Records, ${patients.length} Patienten)`, () => {
  it('ICU-Monatskennzahlen stimmen mit unabhängiger Brute-Force überein (alle Monate)', () => {
    for (const { year, month } of MONTHS) {
      const app = computeIcuMonthly(records, year, month)

      // Referenz
      const beatmInMonth = records.filter((r) => r.therapyType === 'beatmung' && inMonth(r, year, month) && isActive(r))
      const startedVentDays = beatmInMonth.length
      const ventHours = records
        .filter((r) => r.therapyType === 'beatmung' && inMonth(r, year, month))
        .reduce((s, r) => s + activeHoursOf(r), 0)
      const current = patientsOfType(records, 'beatmung', year, month)
      const pm = prevMonth(year, month)
      const prev = patientsOfType(records, 'beatmung', pm.y, pm.m)
      let newPat = 0, cont = 0
      for (const id of current) { if (prev.has(id)) cont++; else newPat++ }
      const crrtDays = records.filter((r) => r.therapyType === 'crrt' && inMonth(r, year, month) && isActive(r)).length
      const ecmoDays = records.filter((r) => r.therapyType === 'ila_ecmo' && inMonth(r, year, month) && isActive(r)).length

      const label = `${year}-${pad(month)}`
      expect(app.startedVentDays, `startedVentDays ${label}`).toBe(startedVentDays)
      expect(app.ventHours, `ventHours ${label}`).toBe(ventHours)
      expect(app.completeVentDays, `completeVentDays ${label}`).toBe(Math.floor(ventHours / 24))
      expect(app.ventPatients, `ventPatients(neu) ${label}`).toBe(newPat)
      expect(app.continuedVentPatients, `fortgeführt ${label}`).toBe(cont)
      expect(app.crrtDays, `crrtDays ${label}`).toBe(crrtDays)
      expect(app.ecmoDays, `ecmoDays ${label}`).toBe(ecmoDays)
    }
  })

  it('Monatsstatistik je Therapieart stimmt mit Brute-Force überein (alle Arten × alle Monate)', () => {
    for (const tt of THERAPIES) {
      for (const { year, month } of MONTHS) {
        const app = buildTherapyMonthRow(records, tt, year, month)
        const ofType = records.filter((r) => r.therapyType === tt && inMonth(r, year, month))
        const active = ofType.filter(isActive)
        const hours = ofType.reduce((s, r) => s + activeHoursOf(r), 0)
        const current = patientsOfType(records, tt, year, month)
        const pm = prevMonth(year, month)
        const prev = patientsOfType(records, tt, pm.y, pm.m)
        let newC = 0, contC = 0
        for (const id of current) { if (prev.has(id)) contC++; else newC++ }

        const label = `${tt} ${year}-${pad(month)}`
        expect(app.hours, `hours ${label}`).toBe(hours)
        expect(app.startedDays, `startedDays ${label}`).toBe(active.length)
        expect(app.completeDays, `completeDays ${label}`).toBe(Math.floor(hours / 24))
        expect(app.newCases, `newCases ${label}`).toBe(newC)
        expect(app.continuedCases, `continuedCases ${label}`).toBe(contC)
        expect(app.daysPerCase, `daysPerCase ${label}`).toBeCloseTo(newC > 0 ? active.length / newC : 0, 10)
      }
    }
  })

  it('Jahres-Summen (sumTherapyYear) sind konsistent mit der Summe der Monate', () => {
    for (const tt of THERAPIES) {
      for (const year of YEARS) {
        const rows = buildTherapyYear(records, tt, year)
        const totals = sumTherapyYear(rows)
        // Referenz aus den Monatszeilen
        const sum = rows.reduce(
          (a, r) => ({ hours: a.hours + r.hours, started: a.started + r.startedDays, complete: a.complete + r.completeDays, neu: a.neu + r.newCases, cont: a.cont + r.continuedCases }),
          { hours: 0, started: 0, complete: 0, neu: 0, cont: 0 },
        )
        const label = `${tt} ${year}`
        expect(totals.hours, `sum.hours ${label}`).toBe(sum.hours)
        expect(totals.startedDays, `sum.started ${label}`).toBe(sum.started)
        expect(totals.completeDays, `sum.complete ${label}`).toBe(sum.complete)
        expect(totals.newCases, `sum.neu ${label}`).toBe(sum.neu)
        expect(totals.continuedCases, `sum.cont ${label}`).toBe(sum.cont)
        // Doppel-Durchschnitt: ÷ neue vs ÷ (neu+fortgeführt)
        expect(totals.daysPerCase, `daysPerCase ${label}`).toBeCloseTo(sum.neu > 0 ? sum.started / sum.neu : 0, 10)
        expect(totals.daysPerCaseAllCases, `daysPerCaseAll ${label}`).toBeCloseTo(
          sum.neu + sum.cont > 0 ? sum.started / (sum.neu + sum.cont) : 0,
          10,
        )
      }
    }
  })

  it('Beatmungstage je Monat (monthlyVentilation) = Brute-Force', () => {
    for (const year of YEARS) {
      const app = monthlyVentilation(records, year)
      for (let m = 1; m <= 12; m++) {
        const expected = records.filter((r) => r.therapyType === 'beatmung' && inMonth(r, year, m) && isActive(r)).length
        expect(app[m], `beatmungstage ${year}-${pad(m)}`).toBe(expected)
      }
    }
  })

  it('MDK-Detail (buildPatientYearRows) je Patient = Brute-Force', () => {
    for (const year of YEARS) {
      const rows = buildPatientYearRows(patients, records, year)
      for (const patient of patients) {
        const own = records.filter((r) => r.patientId === patient.id && r.date.startsWith(`${year}-`))
        const row = rows.find((x) => x.patientId === patient.id)
        if (own.length === 0) {
          expect(row, `kein Row für ${patient.id} ${year}`).toBeUndefined()
          continue
        }
        const ventDays = own.filter((r) => r.therapyType === 'beatmung' && isActive(r)).length
        const totalHours = own.reduce((s, r) => s + activeHoursOf(r), 0)
        const crrtHours = own.filter((r) => r.therapyType === 'crrt').reduce((s, r) => s + activeHoursOf(r), 0)
        const ecmoHours = own.filter((r) => r.therapyType === 'ila_ecmo').reduce((s, r) => s + activeHoursOf(r), 0)
        const label = `${patient.id} ${year}`
        expect(row!.ventilationDays, `ventDays ${label}`).toBe(ventDays)
        expect(row!.totalHours, `totalHours ${label}`).toBe(totalHours)
        expect(row!.crrtHours, `crrtHours ${label}`).toBe(crrtHours)
        expect(row!.ilaEcmoHours, `ecmoHours ${label}`).toBe(ecmoHours)
      }
    }
  })

  it('Episoden sind verlustfrei: Summe Episodenstunden = Summe aktiver Record-Stunden', () => {
    const episodes = recordsToEpisodes(records)
    const totalActive = records.reduce((s, r) => s + activeHoursOf(r), 0)
    const NOW = '2027-12-31T23' // weit in der Zukunft; alle Episoden sind geschlossen
    const totalEpisodeHours = episodes.reduce((s, ep) => {
      // geschlossene Episode: endAt exklusiv
      const slots = (a: string) => {
        const [y, m, d] = a.slice(0, 10).split('-').map(Number)
        return Date.UTC(y, m - 1, d, Number(a.slice(11, 13))) / 3_600_000
      }
      return s + (slots(ep.endAt!) - slots(ep.startAt))
    }, 0)
    expect(totalEpisodeHours).toBe(totalActive)
    // Alle Episoden sind aus Records geschlossen erzeugt
    expect(episodes.every((ep) => ep.endAt !== null)).toBe(true)
    // Von/Bis-Export: Summe der Stundenspalte = gesamte aktive Zeit
    const rows = buildEpisodeRows(patients, records, NOW)
    expect(rows.reduce((s, r) => s + r.hours, 0)).toBe(totalActive)
    expect(rows.every((r) => r.hours > 0)).toBe(true)
  })

  it('Sicherheits-Check: Summe der monatlich NEUEN Fälle = Anzahl zusammenhängender Monats-Läufe je Patient', () => {
    // Ein Patient ist in einem Monat „neu", wenn er im Vormonat NICHT beatmet war.
    // Über alle Monate summiert = Anzahl maximaler Läufe aufeinanderfolgender
    // Beatmungsmonate. Das prüft die neu/fortgeführt-Logik global gegen eine
    // völlig andere Zählweise (Lauf-Zählung pro Patient).
    let appSumNew = 0
    for (const { year, month } of MONTHS) appSumNew += computeIcuMonthly(records, year, month).ventPatients

    // Referenz: Läufe pro Patient über das 14-Monats-Fenster
    let runCount = 0
    for (const patient of patients) {
      let prevActive = false
      for (const { year, month } of MONTHS) {
        const active = records.some((r) => r.patientId === patient.id && r.therapyType === 'beatmung' && inMonth(r, year, month) && isActive(r))
        if (active && !prevActive) runCount++
        prevActive = active
      }
    }
    // Hinweis: H4 hat einen Lauf, der schon im Dez 2025 (erster Monat) beginnt —
    // dort ist der „Vormonat" Nov 2025 (leer), also korrekt als neuer Lauf gezählt.
    expect(appSumNew).toBe(runCount)
  })

  it('Grenzfälle sind tatsächlich abgedeckt (gezielte Nachweise)', () => {
    // Der Datensatz ist nennenswert groß.
    expect(records.length).toBeGreaterThan(120)

    // H1 (Dauerlieger): im ERSTEN Monat neu, danach durchgehend fortgeführt.
    const dec25 = buildTherapyMonthRow(records, 'beatmung', 2025, 12)
    expect(dec25.newCases).toBeGreaterThanOrEqual(1) // H1 (+ ggf. H4) neu
    for (const { year, month } of MONTHS.slice(1)) {
      // In jedem Folgemonat ist H1 unter den fortgeführten Patienten.
      const cur = patientsOfType(records, 'beatmung', year, month)
      const pm = prevMonth(year, month)
      const prev = patientsOfType(records, 'beatmung', pm.y, pm.m)
      expect(cur.has('H1') && prev.has('H1'), `H1 fortgeführt in ${year}-${pad(month)}`).toBe(true)
    }

    // H3 (Lücke): Mai neu, Juni frei, Juli WIEDER neu (Lücke bricht die Fortführung).
    expect(patientsOfType(records, 'beatmung', 2026, 5).has('H3')).toBe(true)
    expect(patientsOfType(records, 'beatmung', 2026, 6).has('H3')).toBe(false)
    expect(patientsOfType(records, 'beatmung', 2026, 7).has('H3')).toBe(true)
    // -> im Juli ist H3 „neu" (Vormonat Juni ohne H3)

    // H4 (Jahreswechsel): Dez 2025 neu, Jan 2026 fortgeführt über die Jahresgrenze.
    expect(patientsOfType(records, 'beatmung', 2025, 12).has('H4')).toBe(true)
    expect(patientsOfType(records, 'beatmung', 2026, 1).has('H4')).toBe(true)

    // H7 (Cross-Midnight): Aug 31 (22-23) + Sep 01 (0-1) verschmelzen zu EINER Episode.
    const h7eps = recordsToEpisodes(records).filter((e) => e.patientId === 'H7')
    expect(h7eps).toHaveLength(1)
    expect(h7eps[0].startAt).toBe('2026-08-31T22')
    expect(h7eps[0].endAt).toBe('2026-09-01T02') // exklusiv
  })

  it('Intensiv: alle Berechnungen stimmen über 25 unabhängige Zufalls-Datensätze', () => {
    let totalRecords = 0
    for (let seed = 1; seed <= 25; seed++) {
      const ds = buildDataset(seed * 7919) // Primzahl-Streuung der Seeds
      totalRecords += ds.records.length
      verifyDataset(ds.patients, ds.records, `seed#${seed}`)
    }
    // Nachweis, dass es sich um eine große Menge geprüfter Daten handelt.
    expect(totalRecords).toBeGreaterThan(3000)
  })

  it('Abgeleitete ICU-Kennzahlen (Anteil %, Ø-Dauer, TISS/Fall) folgen exakt den Formeln', () => {
    // Für einen Monat mit Daten manuelle Fälle/TISS einsetzen und Ableitung prüfen.
    const { year, month } = { year: 2026, month: 1 }
    const calc = computeIcuMonthly(records, year, month)
    const row = buildIcuRow(records, year, month, 12, 360)
    expect(row.ventPercentage).toBeCloseTo(ventPercentage(calc.ventPatients, 12), 10)
    expect(row.ventPercentage).toBeCloseTo(calc.ventPatients > 0 ? (calc.ventPatients / 12) * 100 : 0, 10)
    expect(row.avgVentDuration).toBeCloseTo(avgVentDuration(calc.startedVentDays, calc.ventPatients), 10)
    expect(row.tissPerCase).toBeCloseTo(tissPerCase(360, 12), 10)
    expect(row.tissPerCase).toBeCloseTo(30, 10) // 360/12
  })
})
