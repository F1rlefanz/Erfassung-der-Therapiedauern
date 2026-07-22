import { io, type Socket } from 'socket.io-client'
import type { Patient, TherapyRecord } from '../types'
import type { MonthlyAggregate } from './projections/types'
import type { SeverityStat } from './severity/types'
import type { OpenTherapy } from './episodes/types'

/**
 * Socket.io-Anbindung an den lokalen On-Premise-Server (Intranet).
 * Importiert bewusst NICHT den Store — eingehende Events werden über Handler
 * gemeldet (keine zirkuläre Abhängigkeit).
 *
 * Offline-Verhalten: Ist der Server nicht erreichbar, sind `pushX` No-ops; die
 * Änderungen bleiben lokal (IndexedDB). Beim (Re-)Connect wird der komplette
 * lokale Bestand nachgereicht (`getLocalSnapshot` → emit), sodass offline
 * entstandene Änderungen synchronisiert werden.
 */

const SERVER_URL =
  (import.meta.env.VITE_SYNC_SERVER_URL as string | undefined) ?? 'http://localhost:3001'

export type SyncStatus = 'connecting' | 'online' | 'offline'

export interface LocalSnapshot {
  patients: Patient[]
  records: TherapyRecord[]
  severityStats: SeverityStat[]
  openTherapies: OpenTherapy[]
  /**
   * Offline gelöschte IDs („Grabsteine"). Ohne sie käme ein offline gelöschter
   * Eintrag beim nächsten `sync:init` vom Server zurück, weil der Merge nur
   * Upserts kennt. Sie werden vor den Upserts gesendet.
   */
  deletedPatientIds: string[]
  deletedRecordIds: string[]
}

export interface SyncHandlers {
  onInit: (snapshot: { patients: Patient[]; records: TherapyRecord[] }) => void
  onPatientUpsert: (patient: Patient) => void
  onRecordUpsert: (record: TherapyRecord) => void
  onMonthlyAggregates: (aggregates: MonthlyAggregate[]) => void
  onSeverityInit: (stats: SeverityStat[]) => void
  onSeverityUpsert: (stat: SeverityStat) => void
  onPatientDelete: (id: string) => void
  onRecordDelete: (id: string) => void
  onOpenTherapyInit: (open: OpenTherapy[]) => void
  onOpenTherapyUpsert: (open: OpenTherapy) => void
  onOpenTherapyDelete: (id: string) => void
  onStatusChange: (status: SyncStatus) => void
  getLocalSnapshot: () => LocalSnapshot
  /** Wird nach erfolgreichem Reconnect-Push aufgerufen: Grabsteine sind zugestellt. */
  onTombstonesFlushed: () => void
}

let socket: Socket | null = null

export function initSync(handlers: SyncHandlers): () => void {
  handlers.onStatusChange('connecting')
  const s = io(SERVER_URL, { transports: ['websocket', 'polling'] })
  socket = s

  s.on('connect', () => {
    handlers.onStatusChange('online')
    // Offline entstandene lokale Änderungen nachreichen (Reconnect-Sync).
    const snapshot = handlers.getLocalSnapshot()
    // Löschungen ZUERST — sonst legt ein nachfolgender Upsert den gerade
    // gelöschten Eintrag serverseitig wieder an.
    for (const id of snapshot.deletedRecordIds) s.emit('record:delete', id)
    for (const id of snapshot.deletedPatientIds) s.emit('patient:delete', id)
    for (const patient of snapshot.patients) s.emit('patient:upsert', patient)
    for (const record of snapshot.records) s.emit('record:upsert', record)
    for (const stat of snapshot.severityStats) s.emit('severity_stat:upsert', stat)
    for (const open of snapshot.openTherapies) s.emit('open_therapy:upsert', open)
    handlers.onTombstonesFlushed()
  })
  s.on('disconnect', () => handlers.onStatusChange('offline'))
  s.on('connect_error', () => handlers.onStatusChange('offline'))

  s.on('sync:init', handlers.onInit)
  s.on('patient:upsert', handlers.onPatientUpsert)
  s.on('record:upsert', handlers.onRecordUpsert)
  s.on('aggregates:monthly-therapy', handlers.onMonthlyAggregates)
  s.on('sync:severity_stats', handlers.onSeverityInit)
  s.on('severity_stat:upsert', handlers.onSeverityUpsert)
  s.on('patient:delete', handlers.onPatientDelete)
  s.on('record:delete', handlers.onRecordDelete)
  s.on('sync:open_therapies', handlers.onOpenTherapyInit)
  s.on('open_therapy:upsert', handlers.onOpenTherapyUpsert)
  s.on('open_therapy:delete', handlers.onOpenTherapyDelete)

  return () => {
    s.disconnect()
    if (socket === s) socket = null
  }
}

/** Ob aktuell eine Verbindung zum lokalen Server besteht. */
export function isSyncConnected(): boolean {
  return socket?.connected ?? false
}

export function pushPatientUpsert(patient: Patient): void {
  if (socket?.connected) socket.emit('patient:upsert', patient)
}

export function pushRecordUpsert(record: TherapyRecord): void {
  if (socket?.connected) socket.emit('record:upsert', record)
}

export function pushSeverityUpsert(stat: SeverityStat): void {
  if (socket?.connected) socket.emit('severity_stat:upsert', stat)
}

/** Meldet eine Löschung. Offline No-op — der Grabstein holt es beim Reconnect nach. */
export function pushPatientDelete(id: string): void {
  if (socket?.connected) socket.emit('patient:delete', id)
}

export function pushRecordDelete(id: string): void {
  if (socket?.connected) socket.emit('record:delete', id)
}

export function pushOpenTherapyUpsert(open: OpenTherapy): void {
  if (socket?.connected) socket.emit('open_therapy:upsert', open)
}

export function pushOpenTherapyDelete(id: string): void {
  if (socket?.connected) socket.emit('open_therapy:delete', id)
}
