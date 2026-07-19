import { useMemo } from 'react'
import type { TherapyRecord } from '../types'
import { overlayOpenTherapies } from '../lib/episodes/episodes'
import { useTherapyStore } from './therapyStore'

/**
 * Effektive Records für Anzeige und Statistik: konkrete Basis + laufende
 * Therapien (bis zur aktuellen Stunde). Memoisiert über
 * [therapyRecords, openTherapies, nowStamp]; ohne laufende Therapie ist das
 * Ergebnis referenzgleich mit der Basis (keine Extra-Renders).
 */
export function useEffectiveRecords(): TherapyRecord[] {
  const records = useTherapyStore((s) => s.therapyRecords)
  const open = useTherapyStore((s) => s.openTherapies)
  const now = useTherapyStore((s) => s.nowStamp)
  return useMemo(() => overlayOpenTherapies(records, open, now), [records, open, now])
}
