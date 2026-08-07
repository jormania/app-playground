import { Shirt, Sparkles, History, Settings as SettingsIcon } from 'lucide-react'

export type Tab = 'today' | 'wardrobe' | 'history' | 'settings'

const TABS: { id: Tab; label: string; Icon: typeof Shirt }[] = [
  { id: 'today', label: 'Today', Icon: Sparkles },
  { id: 'wardrobe', label: 'Wardrobe', Icon: Shirt },
  { id: 'history', label: 'History', Icon: History },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
]

/** Fixed bottom tab bar. App-specific by design — it knows Fit Check's tabs, so
 *  it is a screen-level component, not a design-system one. */
export default function Navigation({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fc-nav" aria-label="Main">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className="fc-nav-item"
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => {
            // Tapping the tab you're already on scrolls back to the top —
            // App.tsx separately scrolls to top on an actual tab CHANGE, so
            // this only fires for the "I'm already here" case: the standard
            // mobile-tab-bar convention for getting back out of a long grid
            // without a manual swipe-scroll.
            if (id === tab) window.scrollTo({ top: 0, behavior: 'smooth' })
            else onChange(id)
          }}
        >
          <Icon size={20} aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  )
}
