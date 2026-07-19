import { describe, expect, it } from 'vitest'
import type { TherapyRecord, TherapyType } from '../types'
import {
  averagePerMonth,
  buildTherapyMonthRow,
  buildTherapyYear,
  sumTherapyYear,
} from './therapyMonthlyStats'

function rec(
  patientId: string,
  date: string,
  therapyType: TherapyType,
  count: number,
): TherapyRecord {
  const hours = Array<boolean>(24).fill(false)
  for (let i = 0; i < count; i++) hours[i] = true
  return {
    id: `${patientId}__${date}__${therapyType}`,
    patientId,
    date,
    therapyType,
    hours,
    lastUpdatedAt: `${date}T12:00:00.000Z`,
  }
}

describe('buildTherapyMonthRow', () => {
  const records = [
    rec('p1', '2026-01-05', 'beatmung', 24),
    rec('p1', '2026-01-06', 'beatmung', 24),
    rec('p2', '2026-01-10', 'beatmung', 12),
    rec('p3', '2026-01-11', 'crrt', 8), // andere Therapieart
    rec('p4', '2026-01-20', 'beatmung', 0), // 0 h -> zählt nicht
  ]

  it('aggregiert Stunden, Tage und Fälle je Therapieart', () => {
    const row = buildTherapyMonthRow(records, 'beatmung', 2026, 1)
    expect(row.hours).toBe(60)
    expect(row.startedDays).toBe(3)
    expect(row.completeDays).toBe(2) // floor(60/24)
    expect(row.newCases).toBe(2) // p1, p2
    expect(row.continuedCases).toBe(0)
    expect(row.daysPerCase).toBeCloseTo(1.5, 10) // 3 / 2
  })

  it('trennt die Therapiearten sauber', () => {
    const row = buildTherapyMonthRow(records, 'crrt', 2026, 1)
    expect(row.hours).toBe(8)
    expect(row.newCases).toBe(1)
  })

  it('zählt Fälle aus dem Vormonat als fortgeführt', () => {
    const r = [
      rec('p1', '2026-01-30', 'beatmung', 24),
      rec('p1', '2026-02-02', 'beatmung', 24),
      rec('p2', '2026-02-03', 'beatmung', 24),
    ]
    const feb = buildTherapyMonthRow(r, 'beatmung', 2026, 2)
    expect(feb.newCases).toBe(1)
    expect(feb.continuedCases).toBe(1)
    // Tage/Fall nutzt nur die neuen Fälle (Legacy-Regel).
    expect(feb.daysPerCase).toBeCloseTo(2, 10) // 2 begonnene Tage / 1 neuer Fall
  })

  it('liefert 0 Tage/Fall, wenn es keine neuen Fälle gibt', () => {
    const r = [
      rec('p1', '2026-01-30', 'beatmung', 24),
      rec('p1', '2026-02-02', 'beatmung', 24),
    ]
    expect(buildTherapyMonthRow(r, 'beatmung', 2026, 2).daysPerCase).toBe(0)
  })
})

describe('Jahres-Summen & Durchschnitte', () => {
  const records = [
    rec('p1', '2026-01-05', 'beatmung', 24),
    rec('p2', '2026-03-10', 'beatmung', 12),
  ]
  const rows = buildTherapyYear(records, 'beatmung', 2026)

  it('liefert zwölf Monatszeilen', () => {
    expect(rows).toHaveLength(12)
    expect(rows[0].month).toBe(1)
    expect(rows[11].month).toBe(12)
  })

  it('summiert das Jahr korrekt', () => {
    const t = sumTherapyYear(rows)
    expect(t.hours).toBe(36)
    expect(t.startedDays).toBe(2)
    expect(t.newCases).toBe(2)
  })

  it('rechnet die beiden Tage/Fall-Werte bewusst unterschiedlich (Legacy)', () => {
    const r = [
      rec('p1', '2026-01-30', 'beatmung', 24),
      rec('p1', '2026-02-02', 'beatmung', 24), // fortgeführt
      rec('p2', '2026-02-03', 'beatmung', 24), // neu
    ]
    const t = sumTherapyYear(buildTherapyYear(r, 'beatmung', 2026))
    expect(t.startedDays).toBe(3)
    expect(t.newCases).toBe(2) // p1 (Jan) + p2 (Feb)
    expect(t.continuedCases).toBe(1) // p1 (Feb)
    expect(t.daysPerCase).toBeCloseTo(3 / 2, 10) // nur neue Fälle
    expect(t.daysPerCaseAllCases).toBeCloseTo(3 / 3, 10) // alle Fälle
    expect(t.daysPerCase).not.toBeCloseTo(t.daysPerCaseAllCases, 10)
  })

  it('teilt den Monatsdurchschnitt durch den übergebenen Divisor', () => {
    const t = sumTherapyYear(rows)
    expect(averagePerMonth(t, 12).hours).toBeCloseTo(36 / 12, 10)
    // Laufendes Jahr: Schnitt über verstrichene Monate ist höher.
    expect(averagePerMonth(t, 3).hours).toBeCloseTo(36 / 3, 10)
  })

  it('fängt Divisor 0 ab', () => {
    expect(averagePerMonth(sumTherapyYear(rows), 0).hours).toBe(36)
  })
})
