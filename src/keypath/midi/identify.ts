// Yamaha Corporation's USB vendor id (usb.ids: "0499  Yamaha Corp.").
export const YAMAHA_USB_VENDOR_ID = 0x0499

/**
 * Does a MIDI port look like the Yamaha? Web MIDI exposes only a name and a
 * manufacturer string, both platform-supplied and neither standardised — on
 * Android they come from the USB descriptors via android.media.midi. So this
 * is a hint for the UI, never a gate: any port that sends notes is used.
 */
export function looksLikeYamaha(name: string, manufacturer: string): boolean {
  return /yamaha/i.test(manufacturer) || /yamaha|psr[- ]?e?\d|digital keyboard/i.test(name)
}
