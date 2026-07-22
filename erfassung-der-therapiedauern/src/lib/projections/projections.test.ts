import { describe, expect, it } from 'vitest'
import {
  hasEnoughDataForProjection,
  MIN_MONTHS_FOR_PROJECTION,
  projectionConfidence,
} from './projections'

describe('Datenbasis-Guard & Konfidenz', () => {
  it('rechnet erst ab 3 verstrichenen Monaten hoch', () => {
    expect(MIN_MONTHS_FOR_PROJECTION).toBe(3)
    expect(hasEnoughDataForProjection('2026-01-31')).toBe(false)
    expect(hasEnoughDataForProjection('2026-02-28')).toBe(false)
    expect(hasEnoughDataForProjection('2026-03-01')).toBe(true)
    expect(hasEnoughDataForProjection('2026-12-31')).toBe(true)
  })

  it('Konfidenz steigt mit den Monaten und ist bei 0.8 gedeckelt', () => {
    // Monatsanteil min(m/12, 0.8) × Modellfaktor (seasonal 0.8, linear 0.7)
    expect(projectionConfidence('2026-03-15', 'seasonal')).toBeCloseTo((3 / 12) * 0.8, 10)
    expect(projectionConfidence('2026-06-15', 'seasonal')).toBeCloseTo((6 / 12) * 0.8, 10)
    // Ab Monat 10 greift der Deckel 0.8.
    expect(projectionConfidence('2026-12-15', 'seasonal')).toBeCloseTo(0.8 * 0.8, 10)
  })

  it('gewichtet das saisonale Modell höher als die lineare Hochrechnung', () => {
    expect(projectionConfidence('2026-06-15', 'seasonal')).toBeGreaterThan(
      projectionConfidence('2026-06-15', 'linear'),
    )
  })
})
import { linearProjection, projectYearEnd, seasonalProjection } from './projections'
import { computeSeasonalWeights, ICU_FALLBACK_WEIGHTS } from './seasonalWeights'
import type { MonthlyAggregate } from './types'

describe('Lineare Hochrechnung', () => {
  it('verdoppelt den YTD-Wert etwa zur Jahresmitte', () => {
    // 2. Juli 2026 = Tag 183 von 365 (~ halbes Jahr).
    const projected = linearProjection(100, '2026-07-02')
    // 100 / 183 * 365 ≈ 199.5
    expect(projected).toBeGreaterThan(190)
    expect(projected).toBeLessThan(210)
  })

  it('gibt 0 zurück, wenn noch keine Zeit verstrichen wäre', () => {
    expect(linearProjection(0, '2026-01-01')).toBe(0)
  })
})

describe('Saisonale Hochrechnung (starkes Winter-Gewicht)', () => {
  it('liefert im Februar eine MODERATERE Jahresendprognose als linear', () => {
    // Ende Februar: Winter (Jan+Feb) ist im Fallback überrepräsentiert (0.21),
    // während linear nur 59/365 (~0.16) des Jahres als verstrichen ansieht.
    // Da im Winter überdurchschnittlich viele Beatmungstage anfallen, muss die
    // saisonale Prognose niedriger (moderater) sein als die lineare.
    const ref = '2026-02-28'
    const ytd = 50

    const linear = linearProjection(ytd, ref)
    const seasonal = seasonalProjection(ytd, ref, [...ICU_FALLBACK_WEIGHTS])

    expect(seasonal).toBeLessThan(linear)
    // Konkrete Erwartung: 50 / (0.11 + 0.10) ≈ 238
    expect(seasonal).toBeGreaterThan(220)
    expect(seasonal).toBeLessThan(250)
  })

  it('projectYearEnd wählt das passende Modell', () => {
    const ref = '2026-02-28'
    expect(projectYearEnd(50, ref, 'linear', [...ICU_FALLBACK_WEIGHTS])).toBe(
      linearProjection(50, ref),
    )
    expect(projectYearEnd(50, ref, 'seasonal', [...ICU_FALLBACK_WEIGHTS])).toBe(
      seasonalProjection(50, ref, [...ICU_FALLBACK_WEIGHTS]),
    )
  })
})

describe('Saison-Gewichte', () => {
  it('nutzt den ICU-Fallback, wenn keine Historie existiert', () => {
    const result = computeSeasonalWeights([], 2026)
    expect(result.source).toBe('fallback')
    expect(result.yearsUsed).toBe(0)
    expect(result.weights).toEqual([...ICU_FALLBACK_WEIGHTS])
  })

  it('lernt die Verteilung aus Vorjahren (Summe der Gewichte = 1)', () => {
    const history: MonthlyAggregate[] = [
      { year: 2025, month: 1, therapyType: 'beatmung', days: 20 }, // Winter stark
      { year: 2025, month: 7, therapyType: 'beatmung', days: 5 }, // Sommer schwach
      { year: 2024, month: 1, therapyType: 'beatmung', days: 20 },
      { year: 2024, month: 7, therapyType: 'beatmung', days: 5 },
    ]
    const result = computeSeasonalWeights(history, 2026)
    expect(result.source).toBe('historical')
    expect(result.yearsUsed).toBe(2)
    const sum = result.weights.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 10)
    // Januar (40 von 50) ist deutlich stärker gewichtet als Juli (10 von 50).
    expect(result.weights[0]).toBeCloseTo(0.8, 10)
    expect(result.weights[6]).toBeCloseTo(0.2, 10)
  })

  it('ignoriert das laufende Jahr beim Lernen', () => {
    const history: MonthlyAggregate[] = [
      { year: 2026, month: 1, therapyType: 'beatmung', days: 999 }, // laufendes Jahr -> ignoriert
    ]
    const result = computeSeasonalWeights(history, 2026)
    expect(result.source).toBe('fallback')
  })

  it('filtert nach Therapieart und nutzt bei CRRT/ILA-ECMO den neutralen Fallback', () => {
    const history: MonthlyAggregate[] = [
      { year: 2025, month: 1, therapyType: 'beatmung', days: 20 }, // andere Art -> ignoriert für CRRT
    ]
    const result = computeSeasonalWeights(history, 2026, 'crrt')
    expect(result.source).toBe('fallback')
    expect(result.weights.every((w) => Math.abs(w - 1 / 12) < 1e-9)).toBe(true)
  })
})
