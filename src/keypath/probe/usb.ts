import { YAMAHA_USB_VENDOR_ID } from '../midi/identify'

// WebUSB isn't in TypeScript's DOM lib. This is the sliver the probe touches.
interface UsbDeviceLike {
  vendorId: number
  productId: number
  productName?: string
  manufacturerName?: string
}
interface UsbLike {
  getDevices(): Promise<UsbDeviceLike[]>
  requestDevice(options: { filters: { vendorId?: number }[] }): Promise<UsbDeviceLike>
}

export interface UsbFinding {
  /** 'unavailable' = no WebUSB here, so USB presence can't be told apart from MIDI presence. */
  state: 'unavailable' | 'unknown' | 'found' | 'not-found' | 'error'
  device: { vendorId: string; productId: string; name: string; manufacturer: string } | null
  note: string
}

const usb = (): UsbLike | null => {
  const n = (typeof navigator === 'undefined' ? undefined : navigator) as (Navigator & { usb?: UsbLike }) | undefined
  return n?.usb ?? null
}

const hex = (n: number) => `0x${n.toString(16).padStart(4, '0')}`

const describe = (d: UsbDeviceLike): UsbFinding['device'] => ({
  vendorId: hex(d.vendorId),
  productId: hex(d.productId),
  name: d.productName ?? '',
  manufacturer: d.manufacturerName ?? '',
})

export function usbAvailable(): boolean {
  return usb() !== null
}

/**
 * A second, independent witness. Web MIDI only answers "is there a MIDI port";
 * WebUSB answers "is there a Yamaha on the bus at all". Together they split a
 * failure in two: seen on USB but not as MIDI → Android's MIDI layer or the
 * keyboard's Storage Mode; not even on USB → cable, OTG host mode, or power.
 *
 * `request` must run inside a tap — it opens Chrome's device chooser, filtered
 * to Yamaha's vendor id. We never open or claim the device: Android's MIDI
 * service owns its interfaces, and fighting it for them is exactly the wrong
 * experiment.
 */
export async function findYamahaOnUsb(request: boolean): Promise<UsbFinding> {
  const api = usb()
  if (!api) return { state: 'unavailable', device: null, note: 'WebUSB is not available in this browser.' }
  try {
    const known = (await api.getDevices()).find((d) => d.vendorId === YAMAHA_USB_VENDOR_ID)
    if (known) return { state: 'found', device: describe(known), note: 'Yamaha USB device present (previously authorised).' }
    if (!request) return { state: 'unknown', device: null, note: 'Tap “Look on USB” to ask Chrome to list Yamaha devices.' }
    const picked = await api.requestDevice({ filters: [{ vendorId: YAMAHA_USB_VENDOR_ID }] })
    return { state: 'found', device: describe(picked), note: 'Yamaha USB device present.' }
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    // NotFoundError is what the chooser throws both when nothing matched and
    // when the user dismissed it — the two can't be told apart from here.
    if (name === 'NotFoundError') return { state: 'not-found', device: null, note: 'No Yamaha device chosen — either none is connected or the chooser was dismissed.' }
    return { state: 'error', device: null, note: err instanceof Error ? `${err.name}: ${err.message}` : String(err) }
  }
}
