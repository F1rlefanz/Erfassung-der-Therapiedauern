import { beforeEach, describe, expect, it } from 'vitest'
import { clear } from 'idb-keyval'
import { idbStorage } from './idbStorage'

beforeEach(async () => {
  await clear()
})

describe('idbStorage (IndexedDB-Brücke)', () => {
  it('gibt null zurück, wenn kein Wert existiert', async () => {
    expect(await idbStorage.getItem('fehlt')).toBeNull()
  })

  it('schreibt, liest und entfernt einen Wert (Round-Trip)', async () => {
    await idbStorage.setItem('therapy-store', '{"a":1}')
    expect(await idbStorage.getItem('therapy-store')).toBe('{"a":1}')

    await idbStorage.removeItem('therapy-store')
    expect(await idbStorage.getItem('therapy-store')).toBeNull()
  })
})
