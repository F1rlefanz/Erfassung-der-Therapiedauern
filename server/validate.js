'use strict'

// Eingangsvalidierung für die vom Client empfangenen Sync-Events. Schützt die
// Datenbank davor, durch fehlerhafte oder manipulierte Payloads verunreinigt zu
// werden (auch wenn im vertrauten Intranet das Risiko gering ist). Ungültige
// Payloads werden im Server verworfen und protokolliert, nicht persistiert.

const THERAPY_TYPES = new Set(['beatmung', 'crrt', 'ila_ecmo'])
const UNITS = new Set(['ICU', 'IMC'])

const isStr = (v) => typeof v === 'string'
const isNonEmptyStr = (v) => isStr(v) && v.length > 0
const isOptStr = (v) => v === undefined || isStr(v)
const isInt = (v) => Number.isInteger(v)
const isDate = (v) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v)

function isValidPatient(p) {
  return (
    !!p &&
    isNonEmptyStr(p.id) &&
    isStr(p.caseNumber) &&
    isStr(p.name) &&
    isOptStr(p.lastUpdatedAt)
  )
}

function isValidRecord(r) {
  return (
    !!r &&
    isNonEmptyStr(r.id) &&
    isNonEmptyStr(r.patientId) &&
    isDate(r.date) &&
    THERAPY_TYPES.has(r.therapyType) &&
    Array.isArray(r.hours) &&
    r.hours.length === 24 &&
    r.hours.every((h) => typeof h === 'boolean') &&
    isStr(r.lastUpdatedAt)
  )
}

function isValidSeverity(s) {
  return (
    !!s &&
    isNonEmptyStr(s.id) &&
    isInt(s.year) &&
    isInt(s.month) &&
    s.month >= 1 &&
    s.month <= 12 &&
    UNITS.has(s.unit) &&
    isInt(s.cases) &&
    s.cases >= 0 &&
    isInt(s.tissPoints) &&
    s.tissPoints >= 0 &&
    isOptStr(s.lastUpdatedAt)
  )
}

function isValidOpenTherapy(o) {
  return (
    !!o &&
    isNonEmptyStr(o.id) &&
    isNonEmptyStr(o.patientId) &&
    THERAPY_TYPES.has(o.therapyType) &&
    isNonEmptyStr(o.startAt) &&
    isStr(o.lastUpdatedAt)
  )
}

const isValidId = (id) => isNonEmptyStr(id)

module.exports = {
  isValidPatient,
  isValidRecord,
  isValidSeverity,
  isValidOpenTherapy,
  isValidId,
}
