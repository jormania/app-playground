import { useState } from 'react'

export interface ExpandableTextProps {
  text: string
  max: number
  textClassName?: string
  toggleClassName?: string
}

/** A body of text previewed to `max` characters with a "Show more" / "Show
 *  less" toggle — shared by any view that lists full passage bodies (a
 *  path's From/To, a clearing's members) so none of them dump pages of
 *  text into the list by default. */
export function ExpandableText({ text, max, textClassName, toggleClassName }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > max
  const shown = expanded || !isLong ? text : `${text.slice(0, max)}…`

  return (
    <>
      <p className={textClassName}>{shown}</p>
      {isLong && (
        <button type="button" className={toggleClassName} onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </>
  )
}
