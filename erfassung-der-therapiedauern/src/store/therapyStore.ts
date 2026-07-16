import { create } from 'zustand'
import type { Patient, TherapyRecord, TherapyType } from '../types'

/** Anzahl Stunden pro Tag (Index 0–23). */
export const HOURS_PER_DAY = 24

/** Leeres 24-Stunden-Array (alle Stunden inaktiv). */
function emptyHours(): boolean[] {
  return Array<boolean>(HOURS_PER_DAY).fill(false)
}

/** Aktuelles Datum als YYYY-MM-DD (lokale Zeitzone). */
function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function newId(): string {
  return crypto.randomUUID()
}

/**
 * Setzt eine einzelne Stunde eines (Patient, Datum, Therapieart)-Records auf
 * `value` und gibt die aktualisierte Record-Liste zurück. Existiert noch kein
 * passender Record, wird er lazy angelegt (Records entstehen erst beim ersten
 * Eintrag — leere Tage bleiben leer).
 */
function applyHour(
  records: TherapyRecord[],
  patientId: string,
  date: string,
  therapyType: TherapyType,
  hourIndex: number,
  value: boolean,
): TherapyRecord[] {
  const now = new Date().toISOString()
  const idx = records.findIndex(
    (r) => r.patientId === patientId && r.date === date && r.therapyType === therapyType,
  )

  if (idx === -1) {
    // Kein Record vorhanden. Nur anlegen, wenn tatsächlich aktiviert wird.
    if (!value) return records
    const hours = emptyHours()
    hours[hourIndex] = true
    return [
      ...records,
      { id: newId(), patientId, date, therapyType, hours, lastUpdatedAt: now },
    ]
  }

  const existing = records[idx]
  if (existing.hours[hourIndex] === value) return records // no-op, kein Re-Render

  const hours = existing.hours.slice()
  hours[hourIndex] = value
  const updated: TherapyRecord = { ...existing, hours, lastUpdatedAt: now }
  return records.map((r, i) => (i === idx ? updated : r))
}

/** Kennzeichnet die Zeile, in der gerade gemalt wird (Patient + Therapieart). */
interface PaintTarget {
  patientId: string
  therapyType: TherapyType
}

interface TherapyState {
  // ---- Persistenter Zustand ----
  selectedDate: string
  patients: Patient[]
  therapyRecords: TherapyRecord[]

  // ---- Ephemerer Paint-Zustand (Mouse-Down + Drag) ----
  isPainting: boolean
  paintValue: boolean
  paintTarget: PaintTarget | null

  // ---- Actions ----
  setSelectedDate: (date: string) => void
  addPatient: (name: string, caseNumber: string) => void
  toggleHour: (patientId: string, therapyType: TherapyType, hourIndex: number) => void
  startPaint: (patientId: string, therapyType: TherapyType, hourIndex: number) => void
  paintOver: (patientId: string, therapyType: TherapyType, hourIndex: number) => void
  endPaint: () => void
}

export const useTherapyStore = create<TherapyState>((set) => ({
  selectedDate: todayISO(),
  patients: [],
  therapyRecords: [],

  isPainting: false,
  paintValue: true,
  paintTarget: null,

  setSelectedDate: (date) => set({ selectedDate: date }),

  addPatient: (name, caseNumber) =>
    set((state) => ({
      patients: [
        ...state.patients,
        { id: newId(), name: name.trim(), caseNumber: caseNumber.trim() },
      ],
    })),

  toggleHour: (patientId, therapyType, hourIndex) =>
    set((state) => {
      const current = getHours(state, patientId, therapyType)[hourIndex]
      return {
        therapyRecords: applyHour(
          state.therapyRecords,
          patientId,
          state.selectedDate,
          therapyType,
          hourIndex,
          !current,
        ),
      }
    }),

  startPaint: (patientId, therapyType, hourIndex) =>
    set((state) => {
      const current = getHours(state, patientId, therapyType)[hourIndex]
      const paintValue = !current // Startzelle bestimmt: füllen oder löschen
      return {
        isPainting: true,
        paintValue,
        paintTarget: { patientId, therapyType },
        therapyRecords: applyHour(
          state.therapyRecords,
          patientId,
          state.selectedDate,
          therapyType,
          hourIndex,
          paintValue,
        ),
      }
    }),

  paintOver: (patientId, therapyType, hourIndex) =>
    set((state) => {
      // Nur malen, solange gedrückt wird UND in derselben Zeile begonnen wurde.
      if (
        !state.isPainting ||
        !state.paintTarget ||
        state.paintTarget.patientId !== patientId ||
        state.paintTarget.therapyType !== therapyType
      ) {
        return {}
      }
      return {
        therapyRecords: applyHour(
          state.therapyRecords,
          patientId,
          state.selectedDate,
          therapyType,
          hourIndex,
          state.paintValue,
        ),
      }
    }),

  endPaint: () => set({ isPainting: false, paintTarget: null }),
}))

/**
 * Liest das 24-Stunden-Array für (Patient, Therapieart) am aktuell gewählten
 * Datum. Fehlt der Record, wird ein leeres Array zurückgegeben. Als eigenständige
 * Funktion nutzbar in Zustand-Selektoren (Row-Ebene) ohne Extra-Renders.
 */
export function getHours(
  state: TherapyState,
  patientId: string,
  therapyType: TherapyType,
): boolean[] {
  const record = state.therapyRecords.find(
    (r) =>
      r.patientId === patientId &&
      r.date === state.selectedDate &&
      r.therapyType === therapyType,
  )
  return record ? record.hours : EMPTY_HOURS
}

/** Geteilte, unveränderliche Referenz für „keine Stunden aktiv" (stabile Identität). */
const EMPTY_HOURS: boolean[] = Object.freeze(emptyHours()) as boolean[]
