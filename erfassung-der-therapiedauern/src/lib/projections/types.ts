/** Verfügbare Prognose-Modelle. */
export type ProjectionModel = 'linear' | 'seasonal'

/**
 * Monatliches Aggregat (Beatmungstage) eines Jahres — vom On-Prem-Server als
 * kompakte Kennzahl geliefert, damit nicht der gesamte Rohdatensatz aller Jahre
 * in den Client-RAM geladen werden muss.
 */
export interface MonthlyAggregate {
  year: number
  /** Monat 1–12. */
  month: number
  ventilationDays: number
}

/** Herkunft der Saison-Gewichte: aus Vorjahren gelernt oder klinischer Fallback. */
export type WeightSource = 'historical' | 'fallback'

export interface SeasonalWeights {
  /** 12 Monatsgewichte (Anteil am Jahr), summieren sich zu 1. */
  weights: number[]
  source: WeightSource
  /** Anzahl der Vorjahre, aus denen gelernt wurde (0 beim Fallback). */
  yearsUsed: number
}
