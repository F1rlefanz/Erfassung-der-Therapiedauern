'use strict'

// Einfacher Logger für den On-Premise-Server: schreibt gleichzeitig auf die
// Konsole UND in eine Tages-Logdatei (server/logs/server-YYYY-MM-DD.log), damit
// ein nächtlicher Absturz eine dauerhafte Spur hinterlässt. Die Datumsbenennung
// sorgt für eine natürliche tägliche Rotation.

const fs = require('fs')
const path = require('path')

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, 'logs')
try {
  fs.mkdirSync(LOG_DIR, { recursive: true })
} catch {
  /* Verzeichnis existiert bereits */
}

function currentLogFile() {
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
  return path.join(LOG_DIR, `server-${stamp}.log`)
}

function format(arg) {
  if (typeof arg === 'string') return arg
  if (arg instanceof Error) return arg.stack || arg.message
  try {
    return JSON.stringify(arg)
  } catch {
    return String(arg)
  }
}

function write(level, args) {
  const line = `${new Date().toISOString()} [${level}] ${args.map(format).join(' ')}\n`
  try {
    fs.appendFileSync(currentLogFile(), line)
  } catch {
    /* Logging darf den Server niemals zum Absturz bringen */
  }
}

// Alte Tages-Logdateien über der Aufbewahrungsgrenze entfernen, damit sie sich
// nicht unbegrenzt ansammeln. Bei Serverstart und periodisch aufgerufen.
const LOG_KEEP = Number(process.env.LOG_KEEP || 30)
function pruneLogs() {
  try {
    const files = fs
      .readdirSync(LOG_DIR)
      .filter((f) => /^server-\d{4}-\d{2}-\d{2}\.log$/.test(f))
      .sort()
    while (files.length > LOG_KEEP) {
      fs.unlinkSync(path.join(LOG_DIR, files.shift()))
    }
  } catch {
    /* Aufräumen darf den Server nie stören */
  }
}
pruneLogs()

module.exports = {
  info: (...args) => {
    console.log(...args)
    write('INFO', args)
  },
  error: (...args) => {
    console.error(...args)
    write('ERROR', args)
  },
  pruneLogs,
  LOG_DIR,
}
