import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Patient, TherapyRecord, TherapyType } from '../types'
import { idbStorage } from '../lib/idbStorage'
import { todayISO } from '../lib/date'
import {
  initSync,
  isSyncConnected,
  pushOpenTherapyDelete,
  pushOpenTherapyUpsert,
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
import {
  hourStamp,
  overlayDayHours,
  overlayOpenTherapies,
  parseHourStamp,
  slotIndex,
  stampFromSlot,
} from '../lib/episodes/episodes'
import { openTherapyId, type HourStamp, type OpenTherapy } from '../lib/episodes/types'

/**
 * Aktuelle Stunde als lokaler Stundenstempel (`YYYY-MM-DDTHH`). Grundlage dafür,
 * dass laufende Therapien „bis jetzt" abgeleitet werden. Wird zur Laufzeit per
 * Timer aktualisiert (siehe {@link TherapyState.setNow}); in Tests explizit
 * gesetzt.
 */
export function nowHourStamp(): HourStamp {
  const d = new Date()
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
  return hourStamp(date, d.getHours())
}

/** Anzahl Stunden pro Tag (Index 0–23). */
export const HOURS_PER_DAY = 24

/** Versionsstempel des Backup-/Persistenz-Formats. */
export const STORE_VERSION = 2

/**
 * Fallback-Zeitstempel für Einträge ohne `lastUpdatedAt` (aus einem alten Cache
 * oder Backup vor v0.15). Bewusst „ganz alt", damit echte, zeitgestempelte
 * Serverdaten beim Merge gewinnen — der lokale Alt-Eintrag überschreibt sie nicht.
 */
const EPOCH = '1970-01-01T00:00:00.000Z'

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
  /**
   * Manuell erfasste Schweregrad-Kennzahlen (Fälle / TISS-28). Optional, da
   * Backups vor v0.14 dieses Feld nicht enthalten — dann als leer behandeln.
   */
  severityStats?: SeverityStat[]
  /** Laufende Therapien. Optional (ältere Backups haben das Feld nicht). */
  openTherapies?: OpenTherapy[]
}

interface TherapyState {
  // ---- Persistenter Zustand (IndexedDB, offline-first) ----
  selectedDate: string
  patients: Patient[]
  /**
   * Konkret erfasste Stunden (abgeschlossene/historische Wahrheit). Laufende
   * Therapien liegen separat in {@link openTherapies} und werden erst beim
   * Beenden hier materialisiert. Alle Verbraucher lesen die *effektiven* Records
   * (Basis + Overlay) über {@link selectEffectiveRecords}.
   */
  therapyRecords: TherapyRecord[]
  /** Aktuell laufende Therapien (gemerkter Start ohne Ende). */
  openTherapies: OpenTherapy[]

  // ---- Ephemerer „jetzt"-Stempel (Timer-getickt) für offene Therapien ----
  nowStamp: HourStamp

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

  // ---- Laufende Therapien (Start merken, bis „jetzt" ableiten) ----
  /** Aktualisiert den „jetzt"-Stempel (Timer). Lässt offene Therapien mitwachsen. */
  setNow: (stamp: HourStamp) => void
  /**
   * Startet eine laufende Therapie ab der aktuellen Stunde. Existiert bereits
   * eine offene Therapie für (Patient, Art), bleibt deren Start erhalten.
   */
  startTherapyNow: (patientId: string, therapyType: TherapyType) => void
  /**
   * Beendet eine laufende Therapie: die bis zum Ende belegten Stunden werden in
   * {@link therapyRecords} materialisiert (konkrete Historie), der offene
   * Eintrag entfernt. `endStamp` (letzte aktive Stunde, inklusiv) erlaubt es,
   * ein verpasstes Ende nachzutragen; ohne Angabe gilt die aktuelle Stunde.
   */
  endTherapy: (patientId: string, therapyType: TherapyType, endStamp?: HourStamp) => void
  /**
   * Verwirft eine laufende Therapie OHNE Materialisierung (für einen
   * versehentlichen „Läuft"-Klick): der offene Eintrag wird entfernt, es werden
   * keine Stunden in die Historie geschrieben.
   */
  discardTherapy: (patientId: string, therapyType: TherapyType) => void
  mergeRemoteOpenTherapy: (open: OpenTherapy) => void
  applyRemoteOpenSnapshot: (open: OpenTherapy[]) => void

  // ---- Sync (lokaler Server via Socket.io) ----
  startSync: () => () => void
  mergeRemotePatient: (patient: Patient) => void
  mergeRemoteRecord: (record: TherapyRecord) => void
  mergeRemoteOpenTherapyDelete: (id: string) => void
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
      openTherapies: [],
      nowStamp: nowHourStamp(),

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

        const patient: Patient = {
          id: newId(),
          name: valid.name,
          caseNumber: valid.caseNumber,
          lastUpdatedAt: new Date().toISOString(),
        }
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
        const patient: Patient = {
          ...existing,
          name: valid.name,
          caseNumber: valid.caseNumber,
          lastUpdatedAt: new Date().toISOString(),
        }
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

      // ---- Laufende Therapien ----

      setNow: (stamp) => set({ nowStamp: stamp }),

      startTherapyNow: (patientId, therapyType) => {
        const id = openTherapyId(patientId, therapyType)
        // Läuft schon → Start unangetastet lassen (kein „Neustart").
        if (get().openTherapies.some((o) => o.id === id)) return

        const open: OpenTherapy = {
          id,
          patientId,
          therapyType,
          startAt: get().nowStamp,
          lastUpdatedAt: new Date().toISOString(),
        }
        set((state) => ({ openTherapies: upsertById(state.openTherapies, open) }))
        pushOpenTherapyUpsert(open)
      },

      endTherapy: (patientId, therapyType, endStamp) => {
        const id = openTherapyId(patientId, therapyType)
        const open = get().openTherapies.find((o) => o.id === id)
        if (!open) return

        const end = endStamp ?? get().nowStamp
        const startSlot = slotIndex(open.startAt)
        const endSlot = slotIndex(end) // letzte aktive Stunde, inklusiv

        // Belegte Stunden in die konkrete Historie schreiben und pushen.
        let records = get().therapyRecords
        const touchedDays = new Set<string>()
        for (let slot = startSlot; slot <= endSlot; slot++) {
          const { date, hour } = parseHourStamp(stampFromSlot(slot))
          records = applyHour(records, patientId, date, therapyType, hour, true)
          touchedDays.add(date)
        }

        set((state) => ({
          therapyRecords: records,
          openTherapies: state.openTherapies.filter((o) => o.id !== id),
        }))
        for (const date of touchedDays) scheduleRecordPush(patientId, date, therapyType)
        pushOpenTherapyDelete(id)
      },

      discardTherapy: (patientId, therapyType) => {
        const id = openTherapyId(patientId, therapyType)
        if (!get().openTherapies.some((o) => o.id === id)) return
        set((state) => ({ openTherapies: state.openTherapies.filter((o) => o.id !== id) }))
        pushOpenTherapyDelete(id)
      },

      mergeRemoteOpenTherapy: (open) =>
        set((state) => {
          const existing = state.openTherapies.find((o) => o.id === open.id)
          if (existing && existing.lastUpdatedAt > open.lastUpdatedAt) return {}
          return { openTherapies: upsertById(state.openTherapies, open) }
        }),

      applyRemoteOpenSnapshot: (open) =>
        set((state) => {
          let merged = state.openTherapies
          for (const o of open) merged = upsertById(merged, o)
          return { openTherapies: merged }
        }),

      mergeRemoteOpenTherapyDelete: (id) =>
        set((state) => ({ openTherapies: state.openTherapies.filter((o) => o.id !== id) })),

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
          onOpenTherapyInit: (open) => get().applyRemoteOpenSnapshot(open),
          onOpenTherapyUpsert: (open) => get().mergeRemoteOpenTherapy(open),
          onOpenTherapyDelete: (id) => get().mergeRemoteOpenTherapyDelete(id),
          onTombstonesFlushed: () => get().clearTombstones(),
          getLocalSnapshot: () => ({
            patients: get().patients,
            records: get().therapyRecords,
            severityStats: get().severityStats,
            openTherapies: get().openTherapies,
            deletedPatientIds: get().deletedPatientIds,
            deletedRecordIds: get().deletedRecordIds,
          }),
        }
        return initSync(handlers)
      },

      mergeRemotePatient: (patient) =>
        set((state) => {
          const existing = state.patients.find((p) => p.id === patient.id)
          // Älteres Echo darf einen neueren lokalen Stand nicht überschreiben.
          if (existing && (existing.lastUpdatedAt ?? '') > (patient.lastUpdatedAt ?? '')) return {}
          return { patients: upsertById(state.patients, patient) }
        }),

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
          const base: SeverityStat = existing ?? { id, year, month, unit, cases: 0, tissPoints: 0, lastUpdatedAt: '' }
          updated = {
            ...base,
            [field]: Number.isFinite(value) ? Math.max(0, value) : 0,
            lastUpdatedAt: new Date().toISOString(),
          }
          return { severityStats: upsertById(state.severityStats, updated) }
        })
        if (updated) scheduleSeverityPush(updated.id)
      },

      mergeRemoteSeverity: (stat) =>
        set((state) => {
          const existing = state.severityStats.find((s) => s.id === stat.id)
          // Älteres Echo darf einen neueren lokalen Stand nicht überschreiben.
          if (existing && (existing.lastUpdatedAt ?? '') > (stat.lastUpdatedAt ?? '')) return {}
          return { severityStats: upsertById(state.severityStats, stat) }
        }),

      applyRemoteSeveritySnapshot: (stats) =>
        set((state) => {
          let merged = state.severityStats
          for (const stat of stats) {
            const existing = merged.find((s) => s.id === stat.id)
            if (existing && (existing.lastUpdatedAt ?? '') > (stat.lastUpdatedAt ?? '')) continue
            merged = upsertById(merged, stat)
          }
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
        // Ggf. laufende Therapie derselben Art mit entfernen.
        const openId = openTherapyId(patientId, therapyType)
        const hadOpen = get().openTherapies.some((o) => o.id === openId)
        if (ids.length === 0 && !hadOpen) return
        if (ids.length > 0) {
          removeRecords(set, ids)
          for (const id of ids) pushRecordDelete(id)
        }
        if (hadOpen) {
          set((state) => ({ openTherapies: state.openTherapies.filter((o) => o.id !== openId) }))
          pushOpenTherapyDelete(openId)
        }
      },

      deletePatient: (patientId) => {
        const ids = get()
          .therapyRecords.filter((r) => r.patientId === patientId)
          .map((r) => r.id)
        const openIds = get()
          .openTherapies.filter((o) => o.patientId === patientId)
          .map((o) => o.id)
        set((state) => ({
          patients: state.patients.filter((p) => p.id !== patientId),
          // Records + laufende Therapien mitlöschen — sonst zählten sie ohne
          // Patient weiter mit.
          therapyRecords: state.therapyRecords.filter((r) => r.patientId !== patientId),
          openTherapies: state.openTherapies.filter((o) => o.patientId !== patientId),
          deletedPatientIds: appendTombstones(state.deletedPatientIds, [patientId]),
          deletedRecordIds: appendTombstones(state.deletedRecordIds, ids),
        }))
        pushPatientDelete(patientId) // Server kaskadiert Records + offene Therapien
        for (const id of openIds) pushOpenTherapyDelete(id)
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
        severityStats: get().severityStats,
        openTherapies: get().openTherapies,
      }),

      importSnapshot: (snapshot, mode) => {
        // Ältere Backups (vor v0.14) haben diese Felder nicht → als leer behandeln;
        // Einträge ohne `lastUpdatedAt` (vor v0.15) auf EPOCH backfüllen, damit sie
        // beim Merge neuere Serverdaten nicht überschreiben.
        const snapPatients = snapshot.patients.map((p) => ({ ...p, lastUpdatedAt: p.lastUpdatedAt ?? EPOCH }))
        const snapSeverity = (snapshot.severityStats ?? []).map((s) => ({ ...s, lastUpdatedAt: s.lastUpdatedAt ?? EPOCH }))
        const snapOpen = snapshot.openTherapies ?? []

        if (mode === 'replace') {
          set({
            patients: snapPatients,
            therapyRecords: snapshot.therapyRecords,
            severityStats: snapSeverity,
            openTherapies: snapOpen,
          })
        } else {
          set((state) => {
            let patients = state.patients
            for (const p of snapPatients) {
              const existing = patients.find((x) => x.id === p.id)
              if (existing && (existing.lastUpdatedAt ?? '') > (p.lastUpdatedAt ?? '')) continue
              patients = upsertById(patients, p)
            }
            let records = state.therapyRecords
            for (const r of snapshot.therapyRecords) {
              const existing = records.find((x) => x.id === r.id)
              if (existing && existing.lastUpdatedAt > r.lastUpdatedAt) continue
              records = upsertById(records, r)
            }
            let severityStats = state.severityStats
            for (const s of snapSeverity) {
              const existing = severityStats.find((x) => x.id === s.id)
              if (existing && (existing.lastUpdatedAt ?? '') > (s.lastUpdatedAt ?? '')) continue
              severityStats = upsertById(severityStats, s)
            }
            let openTherapies = state.openTherapies
            for (const o of snapOpen) {
              const existing = openTherapies.find((x) => x.id === o.id)
              if (existing && existing.lastUpdatedAt > o.lastUpdatedAt) continue
              openTherapies = upsertById(openTherapies, o)
            }
            return { patients, therapyRecords: records, severityStats, openTherapies }
          })
        }
        // Importierten Bestand an den Server nachreichen (falls online).
        for (const p of get().patients) pushPatientUpsert(p)
        for (const r of get().therapyRecords) pushRecordUpsert(r)
        for (const s of get().severityStats) pushSeverityUpsert(s)
        for (const o of get().openTherapies) pushOpenTherapyUpsert(o)
      },
    }),
    {
      name: 'therapy-store',
      version: STORE_VERSION,
      storage: createJSONStorage(() => idbStorage),
      // Nur den fachlichen Zustand persistieren — Paint-Zustand und Sync-Status
      // (isPainting/paintValue/paintTarget/syncStatus) gehören nicht in den Cache.
      partialize: (state) => ({
        // selectedDate wird bewusst NICHT persistiert: Die App soll bei jedem
        // Öffnen auf „heute" starten (Tageswerkzeug), nicht auf dem zuletzt
        // gewählten Tag hängen bleiben.
        patients: state.patients,
        therapyRecords: state.therapyRecords,
        // Aggregate mitpersistieren, damit Prognosen auch offline gelernte
        // Gewichte nutzen (nicht nur den ICU-Fallback).
        monthlyHistory: state.monthlyHistory,
        // Manuelle Schweregrad-Eingaben offline-first mitpersistieren.
        severityStats: state.severityStats,
        // Laufende Therapien MÜSSEN persistiert werden — der gemerkte Start ist
        // die Grundlage dafür, nach einem Absturz/Neustart bis „jetzt"
        // nachzurechnen (nowStamp selbst ist flüchtig und wird neu gesetzt).
        openTherapies: state.openTherapies,
        // Grabsteine müssen einen Neustart überleben — sonst kommt ein offline
        // gelöschter Eintrag beim nächsten Sync wieder zurück.
        deletedPatientIds: state.deletedPatientIds,
        deletedRecordIds: state.deletedRecordIds,
      }),
      // v1 → v2: Patienten und Schweregrad-Kennzahlen bekamen ein `lastUpdatedAt`.
      // Alte Einträge ohne das Feld werden auf EPOCH gesetzt (siehe dort).
      migrate: (persisted, fromVersion) => {
        const state = persisted as Partial<TherapyState>
        if (fromVersion < 2) {
          state.patients = (state.patients ?? []).map((p) => ({
            ...p,
            lastUpdatedAt: p.lastUpdatedAt ?? EPOCH,
          }))
          state.severityStats = (state.severityStats ?? []).map((s) => ({
            ...s,
            lastUpdatedAt: s.lastUpdatedAt ?? EPOCH,
          }))
        }
        return state
      },
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
 * Effektive Records = konkrete Basis + laufende Therapien (bis „jetzt"). Diese
 * Liste lesen ALLE Verbraucher (Statistik, Export, Raster). Reine Ableitung; der
 * Aufrufer memoisiert über [therapyRecords, openTherapies, nowStamp].
 */
export function selectEffectiveRecords(state: TherapyState): TherapyRecord[] {
  return overlayOpenTherapies(state.therapyRecords, state.openTherapies, state.nowStamp)
}

/** Offene Therapie für (Patient, Art) oder undefined. */
export function getOpenTherapy(
  state: TherapyState,
  patientId: string,
  therapyType: TherapyType,
): OpenTherapy | undefined {
  const id = openTherapyId(patientId, therapyType)
  return state.openTherapies.find((o) => o.id === id)
}

/**
 * Reine Basis-Stunden (ohne laufende Therapie) für (Patient, Art) am gewählten
 * Tag. Referenzstabil (Record-Array bzw. die geteilte EMPTY_HOURS-Referenz) —
 * darum als reaktiver Store-Selektor geeignet. Das Overlay einer laufenden
 * Therapie wird im Aufrufer per {@link overlayDayHours}/useMemo ergänzt.
 */
export function getBaseHours(
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

/**
 * Liest das 24-Stunden-Array für (Patient, Therapieart) am aktuell gewählten
 * Datum — inklusive einer eventuell laufenden Therapie (bis „jetzt"). Fehlt jede
 * Belegung, wird ein leeres Array zurückgegeben. NICHT als reaktiver Selektor
 * verwenden (erzeugt bei laufender Therapie ein neues Array) — dort
 * {@link getBaseHours} + {@link overlayDayHours} nutzen.
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
  const base = record ? record.hours : EMPTY_HOURS
  const open = getOpenTherapy(state, patientId, therapyType)
  return overlayDayHours(base, open, state.selectedDate, state.nowStamp)
}

/** Geteilte, unveränderliche Referenz für „keine Stunden aktiv" (stabile Identität). */
const EMPTY_HOURS: boolean[] = Object.freeze(emptyHours()) as boolean[]
