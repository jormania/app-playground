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
  const confetti: (options?: Options) => Promise<null> | null
  export default confetti
}
