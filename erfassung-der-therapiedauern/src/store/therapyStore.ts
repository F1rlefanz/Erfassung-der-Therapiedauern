import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Patient, TherapyRecord, TherapyType } from '../types'
import { idbStorage } from '../lib/idbStorage'
import { previousDay, todayISO } from '../lib/date'
import {
  initSync,
  isSyncConnected,
  pushPatientDelete,
  pushPatientUpsert,
  pushRecordDelete,
  pushRecordUpsert,
  pushSeverityUpsert,
  type SyncHandlers,
  type SyncStatus,
} from '../lib/syncClient'
import type { MonthlyAggregate } from '../lib/projections/types'
import { severityId, type SeverityStat, type SeverityUnit } from '../lib/severity/types'

/** Anzahl Stunden pro Tag (Index 0–23). */
export const HOURS_PER_DAY = 24

/** Versionsstempel des Backup-/Persistenz-Formats. */
export const STORE_VERSION = 1

/** Leeres 24-Stunden-Array (alle Stunden inaktiv). */
function emptyHours(): boolean[] {
  return Array<boolean>(HOURS_PER_DAY).fill(false)
}

function newId(): string {
  return crypto.randomUUID()
}

/**
 * Deterministische Record-ID aus (Patient, Datum, Therapieart). Dadurch erzeugen
 * alle Clients dieselbe ID für denselben logischen Record — Sync und Merge über
 * den lokalen Server konvergieren konfliktfrei per ID (auch nach Offline-Phasen).
 */
function recordId(patientId: string, date: string, therapyType: TherapyType): string {
  return `${patientId}__${date}__${therapyType}`
}

/** Fügt ein Element per id in eine Liste ein oder ersetzt das vorhandene. */
function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id)
  if (idx === -1) return [...list, item]
  return list.map((x, i) => (i === idx ? item : x))
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
      {
        id: recordId(patientId, date, therapyType),
        patientId,
        date,
        therapyType,
        hours,
        lastUpdatedAt: now,
      },
    ]
  }

  const existing = records[idx]
  if (existing.hours[hourIndex] === value) return records // no-op, kein Re-Render

  const hours = existing.hours.slice()
  hours[hourIndex] = value
  const updated: TherapyRecord = { ...existing, hours, lastUpdatedAt: now }
  return records.map((r, i) => (i === idx ? updated : r))
}

/**
 * Normalisiert eine Fallnummer für den Eindeutigkeitsvergleich: getrimmt und
 * case-insensitiv (Fallnummern sind fachlich identisch, egal wie getippt).
 */
export function normalizeCaseNumber(caseNumber: string): string {
  return caseNumber.trim().toLowerCase()
}

/** Ergebnis einer Patienten-Mutation (Anlegen oder Bearbeiten). */
export type PatientMutationResult =
  | { ok: true; patient: Patient }
  | { ok: false; error: string }

/**
 * Prüft Pflichtfelder und die Eindeutigkeit der Fallnummer. `excludeId` klammert
 * beim Bearbeiten den Patienten selbst aus — sonst wäre seine eigene Nummer ein
 * Duplikat und er ließe sich nie speichern.
 */
function validatePatientInput(
  patients: Patient[],
  name: string,
  caseNumber: string,
  excludeId?: string,
): { ok: true; name: string; caseNumber: string } | { ok: false; error: string } {
  const trimmedName = name.trim()
  const trimmedCase = caseNumber.trim()
  if (!trimmedName || !trimmedCase) {
    return { ok: false, error: 'Fallnummer und Name sind Pflichtfelder.' }
  }

  // Regel: Eine Fallnummer identifiziert genau einen Patienten. Zwei Einträge
  // mit derselben Nummer würden in allen Statistiken als zwei Fälle zählen.
  const duplicate = findPatientByCaseNumber(patients, trimmedCase)
  if (duplicate && duplicate.id !== excludeId) {
    return { ok: false, error: `Fallnummer ${trimmedCase} ist bereits vergeben (${duplicate.name}).` }
  }

  return { ok: true, name: trimmedName, caseNumber: trimmedCase }
}

/**
 * Obergrenze der Grabstein-Listen. Sie werden nach jedem erfolgreichen Reconnect
 * geleert und wachsen daher nur, solange der Server unerreichbar ist. Die Grenze
 * verhindert, dass sie bei dauerhaft fehlender Verbindung unbegrenzt wachsen;
 * die ältesten Einträge fallen zuerst heraus.
 */
export const MAX_TOMBSTONES = 1000

/** Hängt IDs an eine Grabstein-Liste an und begrenzt sie auf {@link MAX_TOMBSTONES}. */
function appendTombstones(existing: string[], ids: string[]): string[] {
  const merged = [...existing, ...ids]
  return merged.length > MAX_TOMBSTONES ? merged.slice(merged.length - MAX_TOMBSTONES) : merged
}

/**
 * Entfernt Records lokal und merkt sie als Grabstein vor, damit eine offline
 * erfolgte Löschung beim Reconnect nicht vom Server überschrieben wird.
 */
function removeRecords(
  set: (fn: (state: TherapyState) => Partial<TherapyState>) => void,
  ids: string[],
): void {
  const idSet = new Set(ids)
  set((state) => ({
    therapyRecords: state.therapyRecords.filter((r) => !idSet.has(r.id)),
    deletedRecordIds: appendTombstones(state.deletedRecordIds, ids),
  }))
}

/** Kennzeichnet die Zeile, in der gerade gemalt wird (Patient + Therapieart). */
interface PaintTarget {
  patientId: string
  therapyType: TherapyType
}

/** Struktur einer Backup-Datei (Export/Import). */
export interface BackupSnapshot {
  version: number
  exportedAt: string
  patients: Patient[]
  therapyRecords: TherapyRecord[]
}

interface TherapyState {
  // ---- Persistenter Zustand (IndexedDB, offline-first) ----
  selectedDate: string
  patients: Patient[]
  therapyRecords: TherapyRecord[]

  // ---- Ephemerer Paint-Zustand (Mouse-Down + Drag) ----
  isPainting: boolean
  paintValue: boolean
  paintTarget: PaintTarget | null

  // ---- Sync-Status (Anzeige) ----
  syncStatus: SyncStatus

  // ---- Historische Monatsaggregate (für die Prognose-Engine) ----
  monthlyHistory: MonthlyAggregate[]

  // ---- Manuelle Schweregrad-Kennzahlen (Fälle / TISS-28) ----
  severityStats: SeverityStat[]

  // ---- Grabsteine offline gelöschter Einträge (siehe LocalSnapshot) ----
  deletedPatientIds: string[]
  deletedRecordIds: string[]

  // ---- Lokale Actions (Optimistic Updates) ----
  setSelectedDate: (date: string) => void
  /**
   * Legt einen Patienten an. Schlägt fehl, wenn Pflichtfelder leer sind oder die
   * Fallnummer bereits vergeben ist (siehe {@link findPatientByCaseNumber}).
   */
  addPatient: (name: string, caseNumber: string) => PatientMutationResult
  /**
   * Ändert Name/Fallnummer eines Patienten. Gleiche Regeln wie beim Anlegen, nur
   * dass die eigene Fallnummer nicht als Duplikat gilt. Die id bleibt stabil,
   * erfasste Therapiezeiten bleiben also erhalten.
   */
  updatePatient: (id: string, name: string, caseNumber: string) => PatientMutationResult
  toggleHour: (patientId: string, therapyType: TherapyType, hourIndex: number) => void
  startPaint: (patientId: string, therapyType: TherapyType, hourIndex: number) => void
  paintOver: (patientId: string, therapyType: TherapyType, hourIndex: number) => void
  endPaint: () => void
  /**
   * Übernimmt laufende Therapien vom Vortag: Therapien, die gestern um 23 Uhr
   * noch aktiv waren, werden heute ab Stunde 0 fortgesetzt. Gibt die Anzahl der
   * fortgeführten Therapien zurück.
   */
  carryOverFromPreviousDay: () => number

  // ---- Sync (lokaler Server via Socket.io) ----
  startSync: () => () => void
  mergeRemotePatient: (patient: Patient) => void
  mergeRemoteRecord: (record: TherapyRecord) => void
  applyRemoteSnapshot: (snapshot: { patients: Patient[]; records: TherapyRecord[] }) => void

  // ---- Schweregrad-Kennzahlen (manuelle Eingaben) ----
  setSeverityInput: (
    year: number,
    month: number,
    unit: SeverityUnit,
    field: 'cases' | 'tissPoints',
    value: number,
  ) => void
  mergeRemoteSeverity: (stat: SeverityStat) => void
  applyRemoteSeveritySnapshot: (stats: SeverityStat[]) => void

  // ---- Löschen ----
  /** Leert die Stunden einer Therapieart am gewählten Tag (löscht den Record). */
  clearTherapyDay: (patientId: string, therapyType: TherapyType) => void
  /** Löscht ALLE Records einer Therapieart eines Patienten (über alle Tage). */
  removeTherapyForPatient: (patientId: string, therapyType: TherapyType) => void
  /** Löscht den Patienten samt aller seiner Records. */
  deletePatient: (patientId: string) => void
  mergeRemotePatientDelete: (id: string) => void
  mergeRemoteRecordDelete: (id: string) => void
  /** Grabsteine nach erfolgreichem Reconnect-Push leeren. */
  clearTombstones: () => void

  // ---- Backup & Restore ----
  exportSnapshot: () => BackupSnapshot
  importSnapshot: (snapshot: BackupSnapshot, mode: 'replace' | 'merge') => void
}

export const useTherapyStore = create<TherapyState>()(
  persist(
    (set, get) => ({
      selectedDate: todayISO(),
      patients: [],
      therapyRecords: [],

      isPainting: false,
      paintValue: true,
      paintTarget: null,

      syncStatus: 'offline',
      monthlyHistory: [],
      severityStats: [],
      deletedPatientIds: [],
      deletedRecordIds: [],

      setSelectedDate: (date) => set({ selectedDate: date }),

      addPatient: (name, caseNumber) => {
        const valid = validatePatientInput(get().patients, name, caseNumber)
        if (!valid.ok) return valid

        const patient: Patient = { id: newId(), name: valid.name, caseNumber: valid.caseNumber }
        set((state) => ({ patients: [...state.patients, patient] }))
        pushPatientUpsert(patient) // No-op, wenn Server offline
        return { ok: true, patient }
      },

      updatePatient: (id, name, caseNumber) => {
        const existing = get().patients.find((p) => p.id === id)
        if (!existing) return { ok: false, error: 'Patient nicht gefunden.' }

        const valid = validatePatientInput(get().patients, name, caseNumber, id)
        if (!valid.ok) return valid

        // Die id bleibt stabil — alle TherapyRecords hängen daran und bleiben
        // dem Patienten dadurch erhalten.
        const patient: Patient = { ...existing, name: valid.name, caseNumber: valid.caseNumber }
        set((state) => ({ patients: upsertById(state.patients, patient) }))
        pushPatientUpsert(patient)
        return { ok: true, patient }
      },

      toggleHour: (patientId, therapyType, hourIndex) => {
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
        })
        scheduleRecordPush(patientId, get().selectedDate, therapyType)
      },

      startPaint: (patientId, therapyType, hourIndex) => {
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
        })
        scheduleRecordPush(patientId, get().selectedDate, therapyType)
      },

      paintOver: (patientId, therapyType, hourIndex) => {
        let mutated = false
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
          mutated = true
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
        })
        if (mutated) scheduleRecordPush(patientId, get().selectedDate, therapyType)
      },

      endPaint: () => set({ isPainting: false, paintTarget: null }),

      carryOverFromPreviousDay: () => {
        const { selectedDate, therapyRecords } = get()
        const fromDate = previousDay(selectedDate)
        // Therapien, die gestern um 23 Uhr noch liefen, gelten als durchgehend.
        const continuing = therapyRecords.filter(
          (r) => r.date === fromDate && r.hours[HOURS_PER_DAY - 1] === true,
        )

        let count = 0
        for (const r of continuing) {
          const alreadyRunning = get().therapyRecords.some(
            (t) =>
              t.patientId === r.patientId &&
              t.date === selectedDate &&
              t.therapyType === r.therapyType &&
              t.hours[0] === true,
          )
          if (alreadyRunning) continue
          set((state) => ({
            therapyRecords: applyHour(
              state.therapyRecords,
              r.patientId,
              selectedDate,
              r.therapyType,
              0,
              true,
            ),
          }))
          scheduleRecordPush(r.patientId, selectedDate, r.therapyType)
          count += 1
        }
        return count
      },

      // ---- Sync ----

      startSync: () => {
        const handlers: SyncHandlers = {
          onStatusChange: (status) => set({ syncStatus: status }),
          onInit: (snapshot) => get().applyRemoteSnapshot(snapshot),
          onPatientUpsert: (patient) => get().mergeRemotePatient(patient),
          onRecordUpsert: (record) => get().mergeRemoteRecord(record),
          onMonthlyAggregates: (aggregates) => set({ monthlyHistory: aggregates }),
          onSeverityInit: (stats) => get().applyRemoteSeveritySnapshot(stats),
          onSeverityUpsert: (stat) => get().mergeRemoteSeverity(stat),
          onPatientDelete: (id) => get().mergeRemotePatientDelete(id),
          onRecordDelete: (id) => get().mergeRemoteRecordDelete(id),
          onTombstonesFlushed: () => get().clearTombstones(),
          getLocalSnapshot: () => ({
            patients: get().patients,
            records: get().therapyRecords,
            severityStats: get().severityStats,
            deletedPatientIds: get().deletedPatientIds,
            deletedRecordIds: get().deletedRecordIds,
          }),
        }
        return initSync(handlers)
      },

      mergeRemotePatient: (patient) =>
        set((state) => ({ patients: upsertById(state.patients, patient) })),

      mergeRemoteRecord: (record) =>
        set((state) => {
          const existing = state.therapyRecords.find((r) => r.id === record.id)
          // Älteres Echo darf einen neueren lokalen Stand nicht überschreiben.
          if (existing && existing.lastUpdatedAt > record.lastUpdatedAt) return {}
          return { therapyRecords: upsertById(state.therapyRecords, record) }
        }),

      applyRemoteSnapshot: (snapshot) => {
        for (const patient of snapshot.patients) get().mergeRemotePatient(patient)
        for (const record of snapshot.records) get().mergeRemoteRecord(record)
      },

      // ---- Schweregrad-Kennzahlen ----

      setSeverityInput: (year, month, unit, field, value) => {
        const id = severityId(year, month, unit)
        let updated: SeverityStat | undefined
        set((state) => {
          const existing = state.severityStats.find((s) => s.id === id)
          const base: SeverityStat = existing ?? { id, year, month, unit, cases: 0, tissPoints: 0 }
          updated = { ...base, [field]: Number.isFinite(value) ? Math.max(0, value) : 0 }
          return { severityStats: upsertById(state.severityStats, updated) }
        })
        if (updated) scheduleSeverityPush(updated.id)
      },

      mergeRemoteSeverity: (stat) =>
        set((state) => ({ severityStats: upsertById(state.severityStats, stat) })),

      applyRemoteSeveritySnapshot: (stats) =>
        set((state) => {
          let merged = state.severityStats
          for (const stat of stats) merged = upsertById(merged, stat)
          return { severityStats: merged }
        }),

      // ---- Löschen ----

      clearTherapyDay: (patientId, therapyType) => {
        const date = get().selectedDate
        const record = get().therapyRecords.find(
          (r) => r.patientId === patientId && r.date === date && r.therapyType === therapyType,
        )
        if (!record) return
        removeRecords(set, [record.id])
        pushRecordDelete(record.id)
      },

      removeTherapyForPatient: (patientId, therapyType) => {
        const ids = get()
          .therapyRecords.filter(
            (r) => r.patientId === patientId && r.therapyType === therapyType,
          )
          .map((r) => r.id)
        if (ids.length === 0) return
        removeRecords(set, ids)
        for (const id of ids) pushRecordDelete(id)
      },

      deletePatient: (patientId) => {
        const ids = get()
          .therapyRecords.filter((r) => r.patientId === patientId)
          .map((r) => r.id)
        set((state) => ({
          patients: state.patients.filter((p) => p.id !== patientId),
          // Records mitlöschen — sonst zählten sie ohne Patient weiter mit.
          therapyRecords: state.therapyRecords.filter((r) => r.patientId !== patientId),
          deletedPatientIds: appendTombstones(state.deletedPatientIds, [patientId]),
          deletedRecordIds: appendTombstones(state.deletedRecordIds, ids),
        }))
        pushPatientDelete(patientId) // Server kaskadiert die Records selbst
      },

      mergeRemotePatientDelete: (id) =>
        set((state) => ({
          patients: state.patients.filter((p) => p.id !== id),
          therapyRecords: state.therapyRecords.filter((r) => r.patientId !== id),
        })),

      mergeRemoteRecordDelete: (id) =>
        set((state) => ({
          therapyRecords: state.therapyRecords.filter((r) => r.id !== id),
        })),

      clearTombstones: () => set({ deletedPatientIds: [], deletedRecordIds: [] }),

      // ---- Backup & Restore ----

      exportSnapshot: () => ({
        version: STORE_VERSION,
        exportedAt: new Date().toISOString(),
        patients: get().patients,
        therapyRecords: get().therapyRecords,
      }),

      importSnapshot: (snapshot, mode) => {
        if (mode === 'replace') {
          set({
            patients: snapshot.patients,
            therapyRecords: snapshot.therapyRecords,
          })
        } else {
          set((state) => {
            let patients = state.patients
            for (const p of snapshot.patients) patients = upsertById(patients, p)
            let records = state.therapyRecords
            for (const r of snapshot.therapyRecords) {
              const existing = records.find((x) => x.id === r.id)
              if (existing && existing.lastUpdatedAt > r.lastUpdatedAt) continue
              records = upsertById(records, r)
            }
            return { patients, therapyRecords: records }
          })
        }
        // Importierten Bestand an den Server nachreichen (falls online).
        for (const p of get().patients) pushPatientUpsert(p)
        for (const r of get().therapyRecords) pushRecordUpsert(r)
      },
    }),
    {
      name: 'therapy-store',
      version: STORE_VERSION,
      storage: createJSONStorage(() => idbStorage),
      // Nur den fachlichen Zustand persistieren — Paint-Zustand und Sync-Status
      // (isPainting/paintValue/paintTarget/syncStatus) gehören nicht in den Cache.
      partialize: (state) => ({
        selectedDate: state.selectedDate,
        patients: state.patients,
        therapyRecords: state.therapyRecords,
        // Aggregate mitpersistieren, damit Prognosen auch offline gelernte
        // Gewichte nutzen (nicht nur den ICU-Fallback).
        monthlyHistory: state.monthlyHistory,
        // Manuelle Schweregrad-Eingaben offline-first mitpersistieren.
        severityStats: state.severityStats,
        // Grabsteine müssen einen Neustart überleben — sonst kommt ein offline
        // gelöschter Eintrag beim nächsten Sync wieder zurück.
        deletedPatientIds: state.deletedPatientIds,
        deletedRecordIds: state.deletedRecordIds,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[store] Rehydration aus IndexedDB fehlgeschlagen:', error)
        }
      },
    },
  ),
)

// ---------------------------------------------------------------------------
// Remote-Push (debounced pro Record)
//
// Die Paint-UI aktualisiert den lokalen State sofort (Optimistic Update) und
// schreibt via persist in IndexedDB. Der Push an den lokalen Server wird pro
// Record gebündelt: Ein Drag über viele Stunden erzeugt so nur einen Push mit
// dem finalen Stunden-Array. Ist der Server offline, sind die Pushes No-ops und
// der Reconnect-Sync (getLocalSnapshot) holt es nach.
// ---------------------------------------------------------------------------
const RECORD_PUSH_DEBOUNCE_MS = 250
const recordPushTimers = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleRecordPush(
  patientId: string,
  date: string,
  therapyType: TherapyType,
): void {
  // Ohne Serververbindung nichts einplanen — der Reconnect-Sync reicht den
  // finalen lokalen Stand ohnehin nach (und Tests erzeugen keine Timer).
  if (!isSyncConnected()) return
  const id = recordId(patientId, date, therapyType)
  const existing = recordPushTimers.get(id)
  if (existing) clearTimeout(existing)
  recordPushTimers.set(
    id,
    setTimeout(() => {
      recordPushTimers.delete(id)
      const latest = useTherapyStore.getState().therapyRecords.find((r) => r.id === id)
      if (latest) pushRecordUpsert(latest)
    }, RECORD_PUSH_DEBOUNCE_MS),
  )
}

// Debounced Push der manuellen Schweregrad-Eingaben (Tippen erzeugt sonst viele
// Events). Offline No-op; der Reconnect-Sync reicht den Stand nach.
const severityPushTimers = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleSeverityPush(id: string): void {
  if (!isSyncConnected()) return
  const existing = severityPushTimers.get(id)
  if (existing) clearTimeout(existing)
  severityPushTimers.set(
    id,
    setTimeout(() => {
      severityPushTimers.delete(id)
      const latest = useTherapyStore.getState().severityStats.find((s) => s.id === id)
      if (latest) pushSeverityUpsert(latest)
    }, RECORD_PUSH_DEBOUNCE_MS),
  )
}

/**
 * Sucht einen Patienten anhand der Fallnummer (normalisiert). Grundlage der
 * Eindeutigkeitsregel: eine Fallnummer gehört zu genau einem Patienten.
 */
export function findPatientByCaseNumber(
  patients: Patient[],
  caseNumber: string,
): Patient | undefined {
  const needle = normalizeCaseNumber(caseNumber)
  return patients.find((p) => normalizeCaseNumber(p.caseNumber) === needle)
}

/**
 * Liest den Schweregrad-Eintrag für (Jahr, Monat, Station) oder liefert die
 * Nullwerte, falls (noch) nichts erfasst wurde. Für Selektoren nutzbar.
 */
export function getSeverityStat(
  state: TherapyState,
  year: number,
  month: number,
  unit: SeverityUnit,
): { cases: number; tissPoints: number } {
  const id = severityId(year, month, unit)
  const stat = state.severityStats.find((s) => s.id === id)
  return stat ? { cases: stat.cases, tissPoints: stat.tissPoints } : { cases: 0, tissPoints: 0 }
}

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
