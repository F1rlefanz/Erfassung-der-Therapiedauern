import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'
import SyncStatusBadge from './SyncStatusBadge'

/**
 * Hauptnavigation als Sidebar im Corporate Design. Auf schmalen Viewports
 * klappt sie zu einer horizontalen Leiste um (Labels bleiben sichtbar).
 */
function Sidebar() {
  return (
    <aside className="no-print flex shrink-0 flex-col border-line bg-surface sm:w-60 sm:border-r max-sm:border-b">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <span className="inline-block h-6 w-1.5 rounded-full bg-primary" aria-hidden="true" />
        <span className="font-heading text-sm font-semibold leading-tight text-ink">
          Erfassung der<br className="max-sm:hidden" /> Therapiedauern
        </span>
      </div>

      <nav className="flex gap-1 p-3 max-sm:overflow-x-auto sm:flex-col" aria-label="Hauptnavigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isActive
                  ? 'bg-brand-light text-brand-dark'
                  : 'text-ink-muted hover:bg-bg hover:text-ink',
              ].join(' ')
            }
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="whitespace-nowrap">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-line px-4 py-3 max-sm:hidden">
        <SyncStatusBadge />
      </div>
    </aside>
  )
}

export default Sidebar
