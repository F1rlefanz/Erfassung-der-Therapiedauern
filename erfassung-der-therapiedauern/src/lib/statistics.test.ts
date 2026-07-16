import { describe, expect, it } from 'vitest'
import type { TherapyRecord, TherapyType } from '../types'
import {
  availableYears,
  buildMonthlyComparison,
  buildYearProjection,
  monthlyVentilation,
} from './statistics'
import { ICU_FALLBACK_WEIGHTS } from './projections/seasonalWeights'

function rec(date: string, therapyType: TherapyType = 'beatmung'): TherapyRecord {
  const hours = Array<boolean>(24).fill(false)
  hours[8] = true
  return { id: `${date}__${therapyType}`, patientId: 'p1', date, therapyType, hours, lastUpdatedAt: `${date}T12:00:00.000Z` }
}

describe('availableYears', () => {
  it('vereint aktuelles Jahr, Record-Jahre und Aggregat-Jahre (absteigend)', () => {
    const records = [rec('2024-03-05'), rec('2026-01-02')]
    const aggregates = [{ year: 2025, month: 1, ventilationDays: 10 }]
    expect(availableYears(records, aggregates, 2026)).toEqual([2026, 2025, 2024])
  })

  it('enthält das aktuelle Jahr auch ohne Daten', () => {
    expect(availableYears([], [], 2026)).toEqual([2026])
  })
})

describe('buildYearProjection — Vorjahr (abgeschlossen)', () => {
  const records = [rec('2024-01-10'), rec('2024-01-20'), rec('2024-11-05'), rec('2025-01-01')]

  it('liefert eine statische Ist-Kurve über 12 Monate ohne Prognose', () => {
    const result = buildYearProjection(records, 2024, false, '2026-07-16', 'seasonal', [
      ...ICU_FALLBACK_WEIGHTS,
    ])
    expect(result.isProjected).toBe(false)
    expect(result.chart).toHaveLength(12)
    // Keine einzige Prognose-Zahl.
    expect(result.chart.every((p) => p.prognose === null)).toBe(true)
    // Kumulativ: Jan=2, ab Nov=3, Ist an jedem Monat gesetzt.
    expect(result.chart[0].ist).toBe(2) // Januar (2 Records)
    expect(result.chart[9].ist).toBe(2) // Oktober (noch keine neuen)
    expect(result.chart[10].ist).toBe(3) // November (+1)
    expect(result.chart[11].ist).toBe(3) // Dezember final
    expect(result.yearEnd).toBe(3)
    // Records anderer Jahre fließen nicht ein.
  })
})

describe('monthlyVentilation', () => {
  it('liefert absolute (nicht-kumulierte) Monatswerte', () => {
    const records = [rec('2024-01-10'), rec('2024-01-20'), rec('2024-03-05')]
    const perMonth = monthlyVentilation(records, 2024)
    expect(perMonth[1]).toBe(2) // Januar
    expect(perMonth[2]).toBe(0) // Februar (kein Wert, NICHT kumuliert)
    expect(perMonth[3]).toBe(1) // März
  })
})

describe('buildMonthlyComparison (YoY)', () => {
  const records = [
    rec('2024-01-10'),
    rec('2024-01-20'),
    rec('2024-03-05'),
    rec('2025-01-02'),
    rec('2026-01-04'),
    rec('2026-02-08'),
  ]
  const years = [2026, 2025, 2024]

  it('legt flache, nicht-kumulierte Jahres-Keys je Monat an', () => {
    const data = buildMonthlyComparison(records, 2024, years, 2026, '2026-07-16', 'seasonal', [
      ...ICU_FALLBACK_WEIGHTS,
    ])
    expect(data).toHaveLength(12)
    const jan = data[0]
    expect(jan.month).toBe('Jan')
    expect(jan['2024']).toBe(2) // absolut, nicht kumuliert
    expect(jan['2025']).toBe(1)
    expect(jan['2026']).toBe(1)
    const feb = data[1]
    expect(feb['2024']).toBe(0) // Februar 2024 leer (keine Kumulierung)
    const mar = data[2]
    expect(mar['2024']).toBe(1)
  })

  it('ohne laufendes Jahr gewählt: KEIN Prognose-Key', () => {
    const data = buildMonthlyComparison(records, 2024, years, 2026, '2026-07-16', 'seasonal', [
      ...ICU_FALLBACK_WEIGHTS,
    ])
    expect(data.every((p) => p['2024_Prognose'] === undefined)).toBe(true)
  })

  it('laufendes Jahr gewählt: Prognose nur für Zukunftsmonate, Ist-Zukunft = null', () => {
    const data = buildMonthlyComparison(records, 2026, years, 2026, '2026-07-16', 'seasonal', [
      ...ICU_FALLBACK_WEIGHTS,
    ])
    const jul = data[6] // aktueller Monat
    const aug = data[7] // Zukunft
    expect(jul['2026_Prognose']).toBeNull() // Vergangenheit/aktuell -> keine Prognose
    expect(aug['2026']).toBeNull() // noch keine Ist-Daten
    expect(typeof aug['2026_Prognose']).toBe('number') // Prognosewert vorhanden
  })
})

describe('buildYearProjection — laufendes Jahr', () => {
  const records = [rec('2026-01-10'), rec('2026-02-15')]

  it('berechnet eine Prognose und gestrichelte Zukunftswerte', () => {
    const result = buildYearProjection(records, 2026, true, '2026-02-28', 'seasonal', [
      ...ICU_FALLBACK_WEIGHTS,
    ])
    expect(result.isProjected).toBe(true)
    expect(result.ytd).toBe(2)
    // Prognose > Ist (Jahr geht weiter).
    expect(result.yearEnd).toBeGreaterThan(result.ytd)
    // Ist nur bis Februar, danach null; Prognose ab Februar gesetzt.
    expect(result.chart[0].ist).toBe(1) // Januar
    expect(result.chart[1].ist).toBe(2) // Februar
    expect(result.chart[2].ist).toBeNull() // März: kein Ist mehr
    expect(result.chart[11].prognose).not.toBeNull() // Dezember: Prognose
  })
})
