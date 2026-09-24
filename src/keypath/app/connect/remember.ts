import { K, type KeyValueStore } from '../store'

export interface RememberedKeyboard {
  name: string
  firstConnectedAt: string
  lastConnectedAt: string
}

/** Note that this phone has reached a keyboard, so Home stops showing the first-run card. */
export async function rememberKeyboard(store: KeyValueStore, name: string, now = new Date()): Promise<void> {
  const before = await store.get<RememberedKeyboard>(K.keyboard)
  const at = now.toISOString()
  await store.set(K.keyboard, { name, firstConnectedAt: before?.firstConnectedAt ?? at, lastConnectedAt: at })
}

export function rememberedKeyboard(store: KeyValueStore): Promise<RememberedKeyboard | null> {
  return store.get<RememberedKeyboard>(K.keyboard).then((k) => k ?? null)
}
