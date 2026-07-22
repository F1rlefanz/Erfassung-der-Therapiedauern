import { describe, expect, it } from 'vitest'
import type { TherapyRecord, TherapyType } from '../types'
import {
  hasDataForType,
  isVentilationDay,
  therapyHours,
  therapyTypeDistribution,
  totalVentilationDays,
  ventilationDaysInMonth,
} from './therapyCalculator'

/** Baut einen Record; `activeHours` = Indizes der markierten Stunden. */
function rec(
  therapyType: TherapyType,
  activeHours: number[],
  date = '2026-07-16',
): TherapyRecord {
  const hours = Array<boolean>(24).fill(false)
  for (const h of activeHours) hours[h] = true
  return {
    id: `${date}__${therapyType}`,
    patientId: 'p1',
    date,
    therapyType,
    hours,
    lastUpdatedAt: `${date}T12:00:00.000Z`,
  }
}

describe('therapyHours', () => {
  it('zählt die markierten Stunden', () => {
    expect(therapyHours(rec('beatmung', [6, 7, 8]))).toBe(3)
    expect(therapyHours(rec('beatmung', []))).toBe(0)
  })
})

describe('isVentilationDay (Regel 2)', () => {
  it('ist true bei Beatmung mit mindestens einer Stunde', () => {
    expect(isVentilationDay(rec('beatmung', [3]))).toBe(true)
  })

  it('ist false bei Beatmung ohne markierte Stunde', () => {
    expect(isVentilationDay(rec('beatmung', []))).toBe(false)
  })

  it('ist false bei anderer Therapieart, auch mit Stunden', () => {
    expect(isVentilationDay(rec('crrt', [0, 1, 2]))).toBe(false)
    expect(isVentilationDay(rec('ila_ecmo', [5]))).toBe(false)
  })

  it('zählt einen vollen 24h-Tag als genau einen Beatmungstag', () => {
    const fullDay = rec(
      'beatmung',
      Array.from({ length: 24 }, (_, i) => i),
    )
    expect(isVentilationDay(fullDay)).toBe(true)
    expect(totalVentilationDays([fullDay])).toBe(1)
  })
})

describe('Aggregationen', () => {
  const records = [
    rec('beatmung', [0, 1], '2026-07-16'),
    rec('beatmung', [10], '2026-07-17'),
    rec('beatmung', [], '2026-07-18'), // 0h -> kein Beatmungstag
    rec('crrt', [1, 2, 3], '2026-07-16'),
    rec('beatmung', [4], '2026-06-30'), // anderer Monat
  ]

  it('totalVentilationDays zählt nur Beatmung mit ≥1 Stunde', () => {
    expect(totalVentilationDays(records)).toBe(3) // 07-16, 07-17, 06-30
  })

  it('ventilationDaysInMonth filtert nach Monat', () => {
    expect(ventilationDaysInMonth(records, 2026, 7)).toBe(2) // 07-16, 07-17
    expect(ventilationDaysInMonth(records, 2026, 6)).toBe(1) // 06-30
  })

  it('therapyTypeDistribution liefert Tage und Stunden je Art', () => {
    const dist = therapyTypeDistribution(records)
    const beatmung = dist.find((d) => d.type === 'beatmung')!
    const crrt = dist.find((d) => d.type === 'crrt')!
    expect(beatmung.days).toBe(3) // drei Tage mit ≥1 Stunde
    expect(beatmung.hours).toBe(2 + 1 + 1) // 07-16:2, 07-17:1, 06-30:1
    expect(crrt.days).toBe(1)
    expect(crrt.hours).toBe(3)
  })

  it('hasDataForType erkennt vorhandene bzw. fehlende Daten je Art', () => {
    expect(hasDataForType(records, 'beatmung')).toBe(true)
    expect(hasDataForType(records, 'crrt')).toBe(true)
    expect(hasDataForType(records, 'ila_ecmo')).toBe(false) // keine Records dieser Art
  })

  it('hasDataForType ignoriert Records ohne markierte Stunde', () => {
    expect(hasDataForType([rec('beatmung', [], '2026-07-18')], 'beatmung')).toBe(false)
  })
})
