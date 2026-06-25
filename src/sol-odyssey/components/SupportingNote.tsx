import { ChevronRight } from 'lucide-react'
import { GUIDANCE, type GuidanceKey } from '../content/guidance'
import { useShowGuidance } from '../lib/guidanceContext'

/** An optional, unintrusive twisty carrying a background note. Renders nothing when the
 *  user has switched companion guidance off — so screens stay calm for experienced users. */
export function SupportingNote({ note }: { note: GuidanceKey }) {
  const show = useShowGuidance()
  if (!show) return null
  const entry = GUIDANCE[note]
  return (
    <details className="group rounded-md border border-tertiary bg-background-secondary/60 px-3 py-2 [&_svg]:open:rotate-90">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-sans text-sm text-text-secondary marker:hidden">
        <ChevronRight size={14} className="shrink-0 transition-transform duration-fast" aria-hidden />
        {entry.summary}
      </summary>
      <p className="mt-2 pl-[22px] font-sans text-sm leading-relaxed text-text-secondary">
        {entry.body}
      </p>
    </details>
  )
}
