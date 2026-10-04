import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import con from './console.module.css'

/** The console's styles, for the parts a screen lays out itself (KEYPATH_TUTOR.md §9, "A shorter song setup"). */
export { con }

/**
 * One row of the setup console: an icon where a heading used to be, then the control.
 * The control names itself for a screen reader (a segmented control's `label`, a chip
 * row's aria-label), so the icon is only for the eye. `wide` keeps it a full row where
 * the console puts two settings side by side; `chips` for a row of 32 px chips, which
 * sit lower than a 40 px track, so the icon lines up with them.
 */
export function Setting({ icon: Icon, wide, chips, children }: { icon: LucideIcon; wide?: boolean; chips?: boolean; children: ReactNode }) {
  return (
    <div className={con.setting} data-wide={wide || undefined} data-chips={chips || undefined}>
      <Icon className={con.icon} size={22} aria-hidden />
      <div className={con.control}>{children}</div>
    </div>
  )
}
