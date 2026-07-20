'use strict'

// Entfernt den Windows-Dienst wieder (Administratorrechte erforderlich):
//   npm run service:uninstall

const path = require('path')
const { Service } = require('node-windows')

const svc = new Service({
  name: 'Erfassung der Therapiedauern',
  script: path.join(__dirname, '..', 'index.js'),
})

svc.on('uninstall', () => console.log('[service] Dienst entfernt.'))
svc.on('error', (err) => console.error('[service] Fehler:', err))

svc.uninstall()
