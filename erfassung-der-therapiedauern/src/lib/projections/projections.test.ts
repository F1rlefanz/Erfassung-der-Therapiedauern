import { describe, expect, it } from 'vitest'
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
      { year: 2025, month: 1, ventilationDays: 20 }, // Winter stark
      { year: 2025, month: 7, ventilationDays: 5 }, // Sommer schwach
      { year: 2024, month: 1, ventilationDays: 20 },
      { year: 2024, month: 7, ventilationDays: 5 },
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
      { year: 2026, month: 1, ventilationDays: 999 }, // laufendes Jahr -> ignoriert
    ]
    const result = computeSeasonalWeights(history, 2026)
    expect(result.source).toBe('fallback')
  })
})
