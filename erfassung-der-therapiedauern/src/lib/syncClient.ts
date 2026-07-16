import { io, type Socket } from 'socket.io-client'
import type { Patient, TherapyRecord } from '../types'
import type { MonthlyAggregate } from './projections/types'
import type { SeverityStat } from './severity/types'

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
}

export interface SyncHandlers {
  onInit: (snapshot: { patients: Patient[]; records: TherapyRecord[] }) => void
  onPatientUpsert: (patient: Patient) => void
  onRecordUpsert: (record: TherapyRecord) => void
  onMonthlyAggregates: (aggregates: MonthlyAggregate[]) => void
  onSeverityInit: (stats: SeverityStat[]) => void
  onSeverityUpsert: (stat: SeverityStat) => void
  onStatusChange: (status: SyncStatus) => void
  getLocalSnapshot: () => LocalSnapshot
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
    for (const patient of snapshot.patients) s.emit('patient:upsert', patient)
    for (const record of snapshot.records) s.emit('record:upsert', record)
    for (const stat of snapshot.severityStats) s.emit('severity_stat:upsert', stat)
  })
  s.on('disconnect', () => handlers.onStatusChange('offline'))
  s.on('connect_error', () => handlers.onStatusChange('offline'))

  s.on('sync:init', handlers.onInit)
  s.on('patient:upsert', handlers.onPatientUpsert)
  s.on('record:upsert', handlers.onRecordUpsert)
  s.on('aggregates:monthly-ventilation', handlers.onMonthlyAggregates)
  s.on('sync:severity_stats', handlers.onSeverityInit)
  s.on('severity_stat:upsert', handlers.onSeverityUpsert)

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
