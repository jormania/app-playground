export interface EnvironmentFacts {
  userAgent: string
  /** From UA Client Hints where Chrome offers them — gives "SM-S921B" rather than the frozen "K". */
  model: string | null
  platformVersion: string | null
  browserVersions: string | null
  secureContext: boolean
  webMidi: boolean
  webUsb: boolean
  midiPermission: string | null
  displayMode: 'standalone' | 'browser'
  wakeLock: boolean
}

type UaData = {
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>
}

export async function readEnvironment(): Promise<EnvironmentFacts> {
  const nav = navigator as Navigator & { userAgentData?: UaData; usb?: unknown }
  let model: string | null = null
  let platformVersion: string | null = null
  let browserVersions: string | null = null
  try {
    const hi = await nav.userAgentData?.getHighEntropyValues?.(['model', 'platformVersion', 'fullVersionList'])
    if (hi) {
      model = typeof hi.model === 'string' && hi.model ? hi.model : null
      platformVersion = typeof hi.platformVersion === 'string' ? hi.platformVersion : null
      const list = hi.fullVersionList as { brand: string; version: string }[] | undefined
      browserVersions = list?.filter((b) => !/not.a.brand/i.test(b.brand)).map((b) => `${b.brand} ${b.version}`).join(', ') ?? null
    }
  } catch {}

  let midiPermission: string | null = null
  try {
    const status = await navigator.permissions.query({ name: 'midi' as PermissionName })
    midiPermission = status.state
  } catch {}

  let standalone = false
  try {
    standalone = window.matchMedia('(display-mode: standalone)').matches
  } catch {}

  return {
    userAgent: navigator.userAgent,
    model,
    platformVersion,
    browserVersions,
    secureContext: window.isSecureContext,
    webMidi: typeof navigator.requestMIDIAccess === 'function',
    webUsb: 'usb' in nav,
    midiPermission,
    displayMode: standalone ? 'standalone' : 'browser',
    wakeLock: 'wakeLock' in navigator,
  }
}
