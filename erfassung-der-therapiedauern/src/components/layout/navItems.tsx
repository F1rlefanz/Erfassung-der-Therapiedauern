import type { ReactNode } from 'react'

/** Ein Eintrag der Hauptnavigation, geteilt von Sidebar und Dashboard. */
export interface NavItem {
  to: string
  label: string
  description: string
  /** true = nur bei exakter Pfad-Übereinstimmung aktiv (für die Index-Route). */
  end?: boolean
  icon: ReactNode
}

const svg = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Dashboard',
    description: 'Tagesübersicht auf einen Blick',
    end: true,
    icon: (
      <svg {...svg} aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    to: '/erfassung',
    label: 'Erfassung',
    description: 'Therapiestunden pro Patient erfassen',
    icon: (
      <svg {...svg} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    to: '/reporting',
    label: 'Reporting & Controlling',
    description: 'Schweregradstatistik & MDK-Export',
    icon: (
      // lucide: table
      <svg {...svg} aria-hidden="true">
        <path d="M12 3v18" />
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18" />
        <path d="M3 15h18" />
      </svg>
    ),
  },
  {
    to: '/analysen',
    label: 'Analysen & Graphen',
    description: 'Monatswerte, Jahresvergleich & Prognosen',
    icon: (
      // lucide: bar-chart-3
      <svg {...svg} aria-hidden="true">
        <path d="M3 3v18h18" />
        <path d="M18 17V9" />
        <path d="M13 17V5" />
        <path d="M8 17v-3" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Einstellungen',
    description: 'App-Konfiguration',
    icon: (
      <svg {...svg} aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="9" cy="6" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="8" cy="18" r="2" />
      </svg>
    ),
  },
]
