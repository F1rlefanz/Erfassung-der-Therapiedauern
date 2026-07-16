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
})
