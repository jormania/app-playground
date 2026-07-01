import { clsx, type ClassValue } from 'clsx'

/** Join conditional class names. The design system styles with CSS Modules, so
 *  (unlike sol-odyssey's `cn`) there are no Tailwind classes to merge — a plain
 *  clsx join is all we need. */
export function cx(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
