import { describe, expect, it } from 'vitest'
import type { TherapyRecord, TherapyType } from '../../types'
import {
  avgVentDuration,
  buildIcuRow,
  buildImcRow,
  computeIcuMonthly,
  tissPerCase,
  ventPercentage,
} from './severityStats'

/** Record mit `count` aktiven Stunden. */
function rec(patientId: string, date: string, therapyType: TherapyType, count: number): TherapyRecord {
  const hours = Array<boolean>(24).fill(false)
  for (let i = 0; i < count; i++) hours[i] = true
  return { id: `${patientId}__${date}__${therapyType}`, patientId, date, therapyType, hours, lastUpdatedAt: `${date}T12:00:00.000Z` }
}

describe('computeIcuMonthly', () => {
  const records = [
    rec('p1', '2026-01-05', 'beatmung', 24),
    rec('p1', '2026-01-06', 'beatmung', 24),
    rec('p2', '2026-01-10', 'beatmung', 12),
    rec('p2', '2026-01-11', 'crrt', 8),
    rec('p3', '2026-01-15', 'ila_ecmo', 6),
    rec('p1', '2026-02-01', 'beatmung', 10), // anderer Monat
    rec('p9', '2026-01-20', 'beatmung', 0), // 0h -> zählt nicht
  ]

  it('aggregiert Beatmungskennzahlen korrekt (nicht-kumuliert, pro Monat)', () => {
    const calc = computeIcuMonthly(records, 2026, 1)
    expect(calc.startedVentDays).toBe(3) // p1 (2x) + p2 (1x)
    expect(calc.ventHours).toBe(24 + 24 + 12) // 60
    expect(calc.completeVentDays).toBe(2) // floor(60/24)
    expect(calc.ventPatients).toBe(2) // p1, p2
    expect(calc.crrtDays).toBe(1)
    expect(calc.ecmoDays).toBe(1)
  })

  it('grenzt strikt auf den Monat ab', () => {
    expect(computeIcuMonthly(records, 2026, 2).startedVentDays).toBe(1)
  })
})

describe('abgeleitete Kennzahlen', () => {
  it('ventPercentage = ventPatients / cases * 100 (0 bei cases=0)', () => {
    expect(ventPercentage(2, 8)).toBeCloseTo(25, 10)
    expect(ventPercentage(2, 0)).toBe(0)
  })

  it('avgVentDuration = startedVentDays / ventPatients (0 bei 0 Patienten)', () => {
    expect(avgVentDuration(6, 3)).toBeCloseTo(2, 10)
    expect(avgVentDuration(6, 0)).toBe(0)
  })

  it('tissPerCase = tissPoints / cases (0 bei cases=0)', () => {
    expect(tissPerCase(280, 10)).toBeCloseTo(28, 10)
    expect(tissPerCase(280, 0)).toBe(0)
  })
})

describe('Zeilen-Builder', () => {
  const records = [
    rec('p1', '2026-01-05', 'beatmung', 24),
    rec('p2', '2026-01-10', 'beatmung', 12),
  ]

  it('buildIcuRow kombiniert berechnete + manuelle Werte', () => {
    const row = buildIcuRow(records, 2026, 1, 8, 240)
    expect(row.ventPatients).toBe(2)
    expect(row.cases).toBe(8)
    expect(row.tissPoints).toBe(240)
    expect(row.ventPercentage).toBeCloseTo(25, 10) // 2/8*100
    expect(row.tissPerCase).toBeCloseTo(30, 10) // 240/8
  })

  it('buildImcRow enthält nur manuelle + abgeleitete Werte', () => {
    const row = buildImcRow(3, 12, 360)
    expect(row).toEqual({ month: 3, cases: 12, tissPoints: 360, tissPerCase: 30 })
  })
})
