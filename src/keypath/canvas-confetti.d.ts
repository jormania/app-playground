// The part of canvas-confetti (already a dependency, used by Lexi5) that
// KeyPath calls. The package ships no types and @types isn't installed, so
// this declares only what's used.
declare module 'canvas-confetti' {
  interface Options {
    particleCount?: number
    angle?: number
    spread?: number
    startVelocity?: number
    scalar?: number
    zIndex?: number
    colors?: string[]
    shapes?: ('square' | 'circle' | 'star')[]
    origin?: { x?: number; y?: number }
    disableForReducedMotion?: boolean
  }
  type Fire = (options?: Options) => Promise<null> | null
  const confetti: Fire & {
    /** A cannon that draws on the canvas given, instead of one of its own. */
    create: (canvas: HTMLCanvasElement, options?: { resize?: boolean; disableForReducedMotion?: boolean }) => Fire
  }
  export default confetti
}
