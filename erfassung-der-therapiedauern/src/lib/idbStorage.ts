import { del, get, set } from 'idb-keyval'
import type { StateStorage } from 'zustand/middleware'

/**
 * Storage-Engine für Zustands `persist`-Middleware auf Basis von IndexedDB
 * (via idb-keyval). Gegenüber `localStorage` gibt es hier praktisch kein
 * 5-MB-Limit — wichtig, da mit vielen Patienten/Tagen einige Therapy-Records
 * anfallen. Dient als Offline-Cache/Brücke, bis serverseitige Persistenz
 * (BaaS) angebunden wird.
 */
export const idbStorage: StateStorage = {
  getItem: async (name) => (await get(name)) ?? null,
  setItem: async (name, value) => {
    await set(name, value)
  },
  removeItem: async (name) => {
    await del(name)
  },
}
