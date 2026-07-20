import { describe, expect, it } from 'vitest'
import type { TherapyRecord, TherapyType } from '../../types'
import type { OpenTherapy, TherapyEpisode } from './types'
import {
  episodeDays,
  episodeHours,
  hourStamp,
  hoursForDay,
  isOpen,
  LONG_TERM_DAYS,
  openEpisodeLevel,
  overlayDayHours,
  overlayOpenTherapies,
  recordsToEpisodes,
  REVIEW_DAYS,
  slotIndex,
  stampFromSlot,
} from './episodes'

function ep(
  startAt: string,
  endAt: string | null,
  therapyType: TherapyType = 'beatmung',
  patientId = 'p1',
): TherapyEpisode {
  return {
    id: `${patientId}__${therapyType}__${startAt}`,
    patientId,
    therapyType,
    startAt,
    endAt,
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function rec(
  patientId: string,
  date: string,
  therapyType: TherapyType,
  activeHours: number[],
): TherapyRecord {
  const hours = Array<boolean>(24).fill(false)
  for (const h of activeHours) hours[h] = true
  return {
    id: `${patientId}__${date}__${therapyType}`,
    patientId,
    date,
    therapyType,
    hours,
    lastUpdatedAt: `${date}T12:00:00.000Z`,
  }
}

describe('Stundenstempel', () => {
  it('ist über slotIndex/stampFromSlot verlustfrei', () => {
    const s = hourStamp('2026-07-16', 9)
    expect(s).toBe('2026-07-16T09')
    expect(stampFromSlot(slotIndex(s))).toBe(s)
  })

  it('zählt über die Tagesgrenze korrekt weiter', () => {
    expect(slotIndex('2026-07-17T00') - slotIndex('2026-07-16T23')).toBe(1)
  })

  it('zählt über die Jahresgrenze korrekt weiter', () => {
    expect(slotIndex('2026-01-01T00') - slotIndex('2025-12-31T23')).toBe(1)
  })
})

describe('Dauer', () => {
  const now = '2026-07-16T12'

  it('rechnet endAt exklusiv', () => {
    // 08,09,10,11 = 4 Stunden
    expect(episodeHours(ep('2026-07-16T08', '2026-07-16T12'), now)).toBe(4)
  })

  it('rechnet eine offene Episode bis einschließlich der aktuellen Stunde', () => {
    expect(isOpen(ep('2026-07-16T08', null))).toBe(true)
    expect(episodeHours(ep('2026-07-16T08', null), now)).toBe(5) // 08..12
  })

  it('rechnet eine offene Episode nie in die Zukunft', () => {
    expect(episodeHours(ep('2026-07-16T14', null), now)).toBe(0)
  })

  it('zählt volle Tage ab', () => {
    expect(episodeDays(ep('2026-07-01T00', '2026-07-03T12'), now)).toBe(2)
  })
})

describe('Warnstufen offener Episoden', () => {
  const start = '2026-06-01T00'

  it('meldet unauffällig unterhalb der Langzeit-Schwelle', () => {
    const now = hourStamp('2026-06-10', 0) // 9 Tage
    expect(openEpisodeLevel(ep(start, null), now)).toBe('none')
  })

  it('meldet Langzeitbeatmung ab 14 Tagen', () => {
    const now = hourStamp('2026-06-15', 0) // 14 Tage
    expect(episodeDays(ep(start, null), now)).toBe(LONG_TERM_DAYS)
    expect(openEpisodeLevel(ep(start, null), now)).toBe('info')
  })

  it('fordert ab 28 Tagen zur Prüfung auf', () => {
    const now = hourStamp('2026-06-29', 0) // 28 Tage
    expect(episodeDays(ep(start, null), now)).toBe(REVIEW_DAYS)
    expect(openEpisodeLevel(ep(start, null), now)).toBe('review')
  })

  it('warnt bei abgeschlossenen Episoden nie', () => {
    const now = hourStamp('2026-12-31', 0)
    expect(openEpisodeLevel(ep(start, '2026-11-01T00'), now)).toBe('none')
  })
})

describe('Ableitung des Tagesrasters', () => {
  const now = '2026-07-20T12'

  it('markiert genau die abgedeckten Stunden', () => {
    const hours = hoursForDay([ep('2026-07-16T08', '2026-07-16T12')], 'p1', 'beatmung', '2026-07-16', now)
    expect(hours.filter(Boolean)).toHaveLength(4)
    expect(hours[7]).toBe(false)
    expect(hours[8]).toBe(true)
    expect(hours[11]).toBe(true)
    expect(hours[12]).toBe(false)
  })

  it('deckt eine Episode über Mitternacht an beiden Tagen korrekt ab', () => {
    const episodes = [ep('2026-07-16T22', '2026-07-17T03')]
    const d1 = hoursForDay(episodes, 'p1', 'beatmung', '2026-07-16', now)
    const d2 = hoursForDay(episodes, 'p1', 'beatmung', '2026-07-17', now)

    expect(d1[21]).toBe(false)
    expect(d1[22]).toBe(true)
    expect(d1[23]).toBe(true)
    expect(d2[0]).toBe(true)
    expect(d2[2]).toBe(true)
    expect(d2[3]).toBe(false)
  })

  it('füllt bei einer offenen Episode einen dazwischenliegenden Tag vollständig', () => {
    const episodes = [ep('2026-07-16T10', null)]
    const middle = hoursForDay(episodes, 'p1', 'beatmung', '2026-07-18', now)
    expect(middle.every(Boolean)).toBe(true)
  })

  it('endet bei einer offenen Episode am aktuellen Tag mit der aktuellen Stunde', () => {
    const today = hoursForDay([ep('2026-07-16T10', null)], 'p1', 'beatmung', '2026-07-20', now)
    expect(today[12]).toBe(true)
    expect(today[13]).toBe(false)
  })

  it('trennt Patienten und Therapiearten', () => {
    const episodes = [
      ep('2026-07-16T08', '2026-07-16T12', 'beatmung', 'p1'),
      ep('2026-07-16T08', '2026-07-16T12', 'crrt', 'p1'),
      ep('2026-07-16T08', '2026-07-16T12', 'beatmung', 'p2'),
    ]
    expect(hoursForDay(episodes, 'p1', 'beatmung', '2026-07-16', now).filter(Boolean)).toHaveLength(4)
    expect(hoursForDay(episodes, 'p3', 'beatmung', '2026-07-16', now).filter(Boolean)).toHaveLength(0)
  })
})

describe('Migration: Records → Episoden', () => {
  it('fasst zusammenhängende Stunden zu einer Episode zusammen', () => {
    const eps = recordsToEpisodes([rec('p1', '2026-07-16', 'beatmung', [8, 9, 10, 11])])
    expect(eps).toHaveLength(1)
    expect(eps[0].startAt).toBe('2026-07-16T08')
    expect(eps[0].endAt).toBe('2026-07-16T12') // exklusiv
  })

  it('trennt bei Lücken in mehrere Episoden', () => {
    const eps = recordsToEpisodes([rec('p1', '2026-07-16', 'beatmung', [1, 2, 10, 11])])
    expect(eps).toHaveLength(2)
    expect(eps[0].startAt).toBe('2026-07-16T01')
    expect(eps[0].endAt).toBe('2026-07-16T03')
    expect(eps[1].startAt).toBe('2026-07-16T10')
  })

  it('verschmilzt über Mitternacht zu EINER Episode', () => {
    const eps = recordsToEpisodes([
      rec('p1', '2026-07-16', 'beatmung', [22, 23]),
      rec('p1', '2026-07-17', 'beatmung', [0, 1]),
    ])
    expect(eps).toHaveLength(1)
    expect(eps[0].startAt).toBe('2026-07-16T22')
    expect(eps[0].endAt).toBe('2026-07-17T02')
  })

  it('trennt Patienten und Therapiearten', () => {
    const eps = recordsToEpisodes([
      rec('p1', '2026-07-16', 'beatmung', [8]),
      rec('p1', '2026-07-16', 'crrt', [8]),
      rec('p2', '2026-07-16', 'beatmung', [8]),
    ])
    expect(eps).toHaveLength(3)
  })

  it('ignoriert Records ohne aktive Stunden', () => {
    expect(recordsToEpisodes([rec('p1', '2026-07-16', 'beatmung', [])])).toHaveLength(0)
  })

  it('ist verlustfrei: abgeleitetes Raster entspricht dem Original', () => {
    const original = rec('p1', '2026-07-16', 'beatmung', [0, 1, 5, 6, 7, 23])
    const eps = recordsToEpisodes([original])
    const derived = hoursForDay(eps, 'p1', 'beatmung', '2026-07-16', '2026-07-16T23')
    expect(derived).toEqual(original.hours)
  })
})

describe('Overlay laufender Therapien', () => {
  const ot = (startAt: string, patientId = 'p1', therapyType: TherapyType = 'beatmung'): OpenTherapy => ({
    id: `${patientId}__${therapyType}`,
    patientId,
    therapyType,
    startAt,
    lastUpdatedAt: '2026-07-16T00:00:00.000Z',
  })

  const hoursOf = (records: ReturnType<typeof rec>[], patientId: string, date: string, tt: TherapyType) =>
    records.find((r) => r.patientId === patientId && r.date === date && r.therapyType === tt)?.hours

  it('gibt die Basis unverändert zurück, wenn nichts läuft', () => {
    const base = [rec('p1', '2026-07-16', 'beatmung', [8])]
    expect(overlayOpenTherapies(base, [], '2026-07-16T12')).toBe(base)
  })

  it('füllt eine offene Therapie bis einschließlich der aktuellen Stunde', () => {
    const result = overlayOpenTherapies([], [ot('2026-07-16T08')], '2026-07-16T12')
    const hours = hoursOf(result, 'p1', '2026-07-16', 'beatmung')!
    expect(hours.slice(8, 13).every(Boolean)).toBe(true) // 08..12
    expect(hours[7]).toBe(false)
    expect(hours[13]).toBe(false)
  })

  it('überspannt mehrere Tage und füllt Zwischentage vollständig', () => {
    const result = overlayOpenTherapies([], [ot('2026-07-16T20')], '2026-07-18T05')
    expect(hoursOf(result, 'p1', '2026-07-16', 'beatmung')!.slice(20).every(Boolean)).toBe(true)
    expect(hoursOf(result, 'p1', '2026-07-17', 'beatmung')!.every(Boolean)).toBe(true) // ganzer Tag
    expect(hoursOf(result, 'p1', '2026-07-18', 'beatmung')!.slice(0, 6).every(Boolean)).toBe(true)
    expect(hoursOf(result, 'p1', '2026-07-18', 'beatmung')![6]).toBe(false)
  })

  it('verknüpft ODER mit vorhandenen Basis-Stunden (nichts wird gelöscht)', () => {
    const base = [rec('p1', '2026-07-16', 'beatmung', [0, 1, 2])]
    const result = overlayOpenTherapies(base, [ot('2026-07-16T10')], '2026-07-16T11')
    const hours = hoursOf(result, 'p1', '2026-07-16', 'beatmung')!
    expect(hours[0]).toBe(true) // Basis erhalten
    expect(hours[10]).toBe(true) // Overlay ergänzt
    expect(hours[11]).toBe(true)
  })

  it('lässt die Basis-Records unangetastet (kein Mutieren)', () => {
    const base = [rec('p1', '2026-07-16', 'beatmung', [0])]
    overlayOpenTherapies(base, [ot('2026-07-16T10')], '2026-07-16T11')
    expect(base[0].hours[10]).toBe(false) // Original unverändert
  })

  it('ignoriert eine Therapie, deren Start in der Zukunft liegt', () => {
    const result = overlayOpenTherapies([], [ot('2026-07-16T14')], '2026-07-16T12')
    expect(hoursOf(result, 'p1', '2026-07-16', 'beatmung')).toBeUndefined()
  })
})

describe('overlayDayHours (referenzstabil für reaktive Selektoren)', () => {
  const base = Array<boolean>(24).fill(false)

  it('gibt ohne laufende Therapie GENAU dieselbe Referenz zurück', () => {
    // Referenzgleichheit verhindert die Endlosschleife in useSyncExternalStore.
    expect(overlayDayHours(base, undefined, '2026-07-16', '2026-07-16T12')).toBe(base)
  })

  it('gibt an einem Tag außerhalb des Laufs dieselbe Referenz zurück', () => {
    const ot: OpenTherapy = {
      id: 'p1__beatmung',
      patientId: 'p1',
      therapyType: 'beatmung',
      startAt: '2026-07-16T08',
      lastUpdatedAt: '2026-07-16T08:00:00.000Z',
    }
    // Tag VOR dem Start → Basis unverändert (gleiche Referenz).
    expect(overlayDayHours(base, ot, '2026-07-15', '2026-07-16T12')).toBe(base)
  })

  it('ergänzt am Lauf-Tag die Overlay-Stunden (neues Array, Basis erhalten)', () => {
    const ot: OpenTherapy = {
      id: 'p1__beatmung',
      patientId: 'p1',
      therapyType: 'beatmung',
      startAt: '2026-07-16T08',
      lastUpdatedAt: '2026-07-16T08:00:00.000Z',
    }
    const result = overlayDayHours(base, ot, '2026-07-16', '2026-07-16T10')
    expect(result).not.toBe(base)
    expect(result.slice(8, 11).every(Boolean)).toBe(true) // 08..10
    expect(result[11]).toBe(false)
  })
})
