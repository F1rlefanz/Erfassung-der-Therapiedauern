import { beforeEach, describe, expect, it } from 'vitest'
import { getHours, useTherapyStore } from './therapyStore'

/** Bequemer Zugriff auf den aktuellen Store-Zustand in Tests. */
const s = () => useTherapyStore.getState()

/** Setzt den Store vor jedem Test auf einen deterministischen Ausgangszustand. */
beforeEach(() => {
  useTherapyStore.setState({
    selectedDate: '2026-07-16',
    patients: [],
    therapyRecords: [],
    isPainting: false,
    paintValue: true,
    paintTarget: null,
    deletedPatientIds: [],
    deletedRecordIds: [],
  })
})

/** Legt einen Patienten an und gibt dessen id zurück. */
function addPatient(): string {
  s().addPatient('Mustermann, Max', '100234')
  return s().patients.at(-1)!.id
}

describe('Patienten & Records', () => {
  it('legt einen Patienten mit getrimmten Feldern an', () => {
    s().addPatient('  Mustermann, Max  ', '  100234 ')
    expect(s().patients).toHaveLength(1)
    expect(s().patients[0]).toMatchObject({ name: 'Mustermann, Max', caseNumber: '100234' })
  })

  it('lehnt eine bereits vergebene Fallnummer ab (auch anders geschrieben/gepolstert)', () => {
    expect(s().addPatient('Mustermann, Max', '100234').ok).toBe(true)

    const duplicate = s().addPatient('Musterfrau, Erika', ' 100234 ')
    expect(duplicate.ok).toBe(false)
    expect(duplicate.ok === false && duplicate.error).toContain('100234')
    // Kein zweiter Patient und kein Überschreiben des ersten.
    expect(s().patients).toHaveLength(1)
    expect(s().patients[0].name).toBe('Mustermann, Max')
  })

  it('lehnt leere Pflichtfelder ab', () => {
    expect(s().addPatient('   ', '100234').ok).toBe(false)
    expect(s().addPatient('Mustermann, Max', '  ').ok).toBe(false)
    expect(s().patients).toHaveLength(0)
  })

  it('erlaubt verschiedene Fallnummern', () => {
    expect(s().addPatient('Mustermann, Max', '100234').ok).toBe(true)
    expect(s().addPatient('Musterfrau, Erika', '100235').ok).toBe(true)
    expect(s().patients).toHaveLength(2)
  })

  it('bearbeitet einen Patienten und behält die eigene Fallnummer als gültig', () => {
    const pid = addPatient()
    s().toggleHour(pid, 'beatmung', 8)

    // Nur der Name ändert sich — die eigene Nummer darf kein Duplikat sein.
    const result = s().updatePatient(pid, 'Mustermann, Moritz', '100234')
    expect(result.ok).toBe(true)
    expect(s().patients[0]).toMatchObject({
      id: pid,
      name: 'Mustermann, Moritz',
      caseNumber: '100234',
    })
    // id stabil → erfasste Zeiten bleiben dem Patienten erhalten.
    expect(getHours(s(), pid, 'beatmung')[8]).toBe(true)
  })

  it('lehnt beim Bearbeiten eine fremde, bereits vergebene Fallnummer ab', () => {
    const first = addPatient()
    s().addPatient('Musterfrau, Erika', '100235')

    const result = s().updatePatient(first, 'Mustermann, Max', '100235')
    expect(result.ok).toBe(false)
    // Unverändert geblieben.
    expect(s().patients[0].caseNumber).toBe('100234')
  })

  it('löscht nur den gewählten Tag einer Therapie', () => {
    const pid = addPatient()
    s().toggleHour(pid, 'beatmung', 8)
    s().setSelectedDate('2026-07-17')
    s().toggleHour(pid, 'beatmung', 9)

    s().clearTherapyDay(pid, 'beatmung') // aktuell 17.07.
    expect(getHours(s(), pid, 'beatmung').some(Boolean)).toBe(false)

    s().setSelectedDate('2026-07-16')
    expect(getHours(s(), pid, 'beatmung')[8]).toBe(true)
  })

  it('entfernt eine Therapieart über alle Tage, lässt andere Arten unberührt', () => {
    const pid = addPatient()
    s().toggleHour(pid, 'beatmung', 8)
    s().toggleHour(pid, 'crrt', 8)
    s().setSelectedDate('2026-07-17')
    s().toggleHour(pid, 'beatmung', 9)

    s().removeTherapyForPatient(pid, 'beatmung')

    expect(s().therapyRecords.filter((r) => r.therapyType === 'beatmung')).toHaveLength(0)
    expect(s().therapyRecords.filter((r) => r.therapyType === 'crrt')).toHaveLength(1)
    // Grabsteine für beide gelöschten Beatmungs-Records vorgemerkt.
    expect(s().deletedRecordIds).toHaveLength(2)
  })

  it('löscht einen Patienten samt aller Records und merkt Grabsteine vor', () => {
    const pid = addPatient()
    s().addPatient('Musterfrau, Erika', '100235')
    s().toggleHour(pid, 'beatmung', 8)
    s().toggleHour(pid, 'crrt', 8)

    s().deletePatient(pid)

    expect(s().patients).toHaveLength(1)
    expect(s().patients[0].caseNumber).toBe('100235')
    expect(s().therapyRecords.filter((r) => r.patientId === pid)).toHaveLength(0)
    expect(s().deletedPatientIds).toContain(pid)
    expect(s().deletedRecordIds).toHaveLength(2)
  })

  it('gibt eine gelöschte Fallnummer wieder frei', () => {
    const pid = addPatient()
    s().deletePatient(pid)
    expect(s().addPatient('Neuer Patient', '100234').ok).toBe(true)
  })

  it('gibt für einen fehlenden Record ein leeres 24-Stunden-Array zurück', () => {
    const pid = addPatient()
    const hours = getHours(s(), pid, 'beatmung')
    expect(hours).toHaveLength(24)
    expect(hours.some(Boolean)).toBe(false)
  })

  it('legt einen Record erst beim ersten aktivierten Eintrag lazy an', () => {
    const pid = addPatient()
    expect(s().therapyRecords).toHaveLength(0)
    s().toggleHour(pid, 'beatmung', 8)
    expect(s().therapyRecords).toHaveLength(1)
    expect(getHours(s(), pid, 'beatmung')[8]).toBe(true)
  })

  it('toggelt dieselbe Stunde wieder aus', () => {
    const pid = addPatient()
    s().toggleHour(pid, 'beatmung', 8)
    s().toggleHour(pid, 'beatmung', 8)
    expect(getHours(s(), pid, 'beatmung')[8]).toBe(false)
  })

  it('hält Records pro Datum getrennt', () => {
    const pid = addPatient()
    s().toggleHour(pid, 'beatmung', 8)
    s().setSelectedDate('2026-07-17')
    expect(getHours(s(), pid, 'beatmung')[8]).toBe(false) // anderer Tag, leer
    s().setSelectedDate('2026-07-16')
    expect(getHours(s(), pid, 'beatmung')[8]).toBe(true) // ursprünglicher Tag wieder da
  })
})

describe('Malen (Drag-to-Paint)', () => {
  it('füllt zusammenhängende Stunden beim Wischen (Start auf leerer Zelle)', () => {
    const pid = addPatient()
    s().startPaint(pid, 'beatmung', 8)
    s().paintOver(pid, 'beatmung', 9)
    s().paintOver(pid, 'beatmung', 10)
    const hours = getHours(s(), pid, 'beatmung')
    expect(hours[8]).toBe(true)
    expect(hours[9]).toBe(true)
    expect(hours[10]).toBe(true)
    expect(s().isPainting).toBe(true)
    expect(s().paintValue).toBe(true)
  })

  it('löscht beim Wischen, wenn der Zug auf einer aktiven Zelle beginnt', () => {
    const pid = addPatient()
    // Vorbelegung 8,9,10
    s().startPaint(pid, 'beatmung', 8)
    s().paintOver(pid, 'beatmung', 9)
    s().paintOver(pid, 'beatmung', 10)
    s().endPaint()
    // Neuer Zug beginnt auf aktiver Zelle 9 -> paintValue = false (löschen)
    s().startPaint(pid, 'beatmung', 9)
    s().paintOver(pid, 'beatmung', 8)
    const hours = getHours(s(), pid, 'beatmung')
    expect(s().paintValue).toBe(false)
    expect(hours[8]).toBe(false)
    expect(hours[9]).toBe(false)
    expect(hours[10]).toBe(true) // nicht überstrichen -> bleibt aktiv
  })

  it('malt nicht in eine andere Zeile (Same-Row-Schutz beim Diagonal-Wischen)', () => {
    const pid = addPatient()
    s().startPaint(pid, 'beatmung', 5)
    s().paintOver(pid, 'crrt', 5) // andere Therapieart -> ignoriert
    expect(getHours(s(), pid, 'beatmung')[5]).toBe(true)
    expect(getHours(s(), pid, 'crrt')[5]).toBe(false)
  })

  it('ignoriert paintOver, wenn gar nicht gemalt wird', () => {
    const pid = addPatient()
    s().paintOver(pid, 'beatmung', 5)
    expect(getHours(s(), pid, 'beatmung')[5]).toBe(false)
  })

  it('beendet das Malen mit endPaint', () => {
    const pid = addPatient()
    s().startPaint(pid, 'beatmung', 5)
    expect(s().isPainting).toBe(true)
    s().endPaint()
    expect(s().isPainting).toBe(false)
    expect(s().paintTarget).toBeNull()
    // Nach endPaint darf paintOver nichts mehr verändern
    s().paintOver(pid, 'beatmung', 6)
    expect(getHours(s(), pid, 'beatmung')[6]).toBe(false)
  })

  it('vergibt deterministische, über Clients konvergierende Record-IDs', () => {
    const pid = addPatient()
    s().toggleHour(pid, 'beatmung', 8)
    const record = s().therapyRecords[0]
    expect(record.id).toBe(`${pid}__2026-07-16__beatmung`)
  })
})

describe('Sync-Merge (Remote-Events)', () => {
  it('mergt eingehende Records idempotent per id', () => {
    const pid = addPatient()
    const hours = Array<boolean>(24).fill(false)
    hours[10] = true
    const incoming = {
      id: `${pid}__2026-07-16__crrt`,
      patientId: pid,
      date: '2026-07-16',
      therapyType: 'crrt' as const,
      hours,
      lastUpdatedAt: '2026-07-16T12:00:00.000Z',
    }
    s().mergeRemoteRecord(incoming)
    s().mergeRemoteRecord(incoming) // erneut -> kein Duplikat
    const crrt = s().therapyRecords.filter((r) => r.therapyType === 'crrt')
    expect(crrt).toHaveLength(1)
    expect(getHours(s(), pid, 'crrt')[10]).toBe(true)
  })

  it('lässt ein älteres Echo einen neueren lokalen Stand nicht überschreiben', () => {
    const pid = addPatient()
    const id = `${pid}__2026-07-16__beatmung`
    const base = {
      id,
      patientId: pid,
      date: '2026-07-16',
      therapyType: 'beatmung' as const,
      hours: Array<boolean>(24).fill(true),
      lastUpdatedAt: '2026-07-16T12:00:00.000Z',
    }
    s().mergeRemoteRecord(base)
    // Älteres Event mit leeren Stunden darf den neueren Stand nicht platt machen.
    s().mergeRemoteRecord({
      ...base,
      hours: Array<boolean>(24).fill(false),
      lastUpdatedAt: '2026-07-16T11:00:00.000Z',
    })
    expect(getHours(s(), pid, 'beatmung').every(Boolean)).toBe(true)
  })
})

describe('Continuation (Vortag fortführen)', () => {
  it('setzt eine gestern um 23 Uhr laufende Therapie heute ab Stunde 0 fort', () => {
    const pid = addPatient()
    // Vortag (2026-07-16): Beatmung läuft um 23 Uhr noch.
    s().toggleHour(pid, 'beatmung', 23)
    s().setSelectedDate('2026-07-17')

    const carried = s().carryOverFromPreviousDay()
    expect(carried).toBe(1)
    expect(getHours(s(), pid, 'beatmung')[0]).toBe(true)
  })

  it('führt Therapien nicht fort, die um 23 Uhr nicht mehr liefen', () => {
    const pid = addPatient()
    s().toggleHour(pid, 'beatmung', 5) // endet vor Mitternacht
    s().setSelectedDate('2026-07-17')

    expect(s().carryOverFromPreviousDay()).toBe(0)
    expect(getHours(s(), pid, 'beatmung').some(Boolean)).toBe(false)
  })
})

describe('Backup & Restore', () => {
  it('exportiert und re-importiert den Bestand (Round-Trip, replace)', () => {
    const pid = addPatient()
    s().toggleHour(pid, 'beatmung', 8)
    const snapshot = s().exportSnapshot()
    expect(snapshot.patients).toHaveLength(1)
    expect(snapshot.therapyRecords).toHaveLength(1)

    // Bestand leeren, dann aus dem Snapshot wiederherstellen.
    useTherapyStore.setState({ patients: [], therapyRecords: [] })
    s().importSnapshot(snapshot, 'replace')
    expect(s().patients).toHaveLength(1)
    expect(getHours(s(), pid, 'beatmung')[8]).toBe(true)
  })

  it('führt beim Import mit mode=merge zusammen, statt zu ersetzen', () => {
    const pid = addPatient()
    const snapshot = s().exportSnapshot() // enthält nur diesen Patienten

    s().addPatient('Zweite, Person', '200500')
    expect(s().patients).toHaveLength(2)

    s().importSnapshot(snapshot, 'merge')
    // Der zweite Patient bleibt erhalten, der importierte wird gemerged.
    expect(s().patients).toHaveLength(2)
    expect(s().patients.some((p) => p.id === pid)).toBe(true)
  })
})
