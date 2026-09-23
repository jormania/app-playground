let ctx: AudioContext | null = null

/**
 * One AudioContext for the whole page, created lazily and resumed on demand.
 * Chrome only lets a context start after a user gesture, so call this from a
 * tap or key press, never at load.
 */
export async function audioContext(): Promise<AudioContext> {
  ctx ??= new AudioContext({ latencyHint: 'interactive' })
  if (ctx.state === 'suspended') await ctx.resume()
  return ctx
}
