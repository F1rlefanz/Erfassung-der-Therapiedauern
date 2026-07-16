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
    description: 'Übersicht & Schnellzugriff',
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
    to: '/statistik',
    label: 'Statistik',
    description: 'Auswertungen & Graphen',
    icon: (
      <svg {...svg} aria-hidden="true">
        <path d="M3 3v18h18" />
        <path d="M7 15v3" />
        <path d="M12 10v8" />
        <path d="M17 6v12" />
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
