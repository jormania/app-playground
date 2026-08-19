/**
 * OCR — turning a photographed page into text, without typing it in.
 *
 * Runs once, automatically, right after a page photo is taken and uploaded
 * (App.tsx's `handlePhoto`) — not a manual "extract text" step. Reuses the
 * same BYO Anthropic key already used for Tension (lib/tension.ts), through
 * the same `/api/anthropic-proxy` rewrite (no server, no serverless
 * function). Gated separately in Settings (`autoTranscribe`) from merely
 * having a key set — sending a photograph to a third party is a different
 * privacy trade than sending text, and gets its own explicit opt-in.
 *
 * The prompt is scoped to transcription, not description — SILVA.md's "What
 * the AI must never do" carve-out for this file: it must never say what a
 * photo shows, only ever copy out text that's actually on the page. The
 * NO_TEXT sentinel is what keeps a plain, non-text photograph (a scene, an
 * object) from getting the model's description of it stuffed into Body —
 * it has to come back empty instead.
 */

import { requestAnthropic, extractAnthropicText, MODEL_HAIKU } from '../../shared/anthropic'

const PROXY_ENDPOINT = '/api/anthropic-proxy/v1/messages'

const NO_TEXT = 'NONE'

const PROMPT = `Transcribe any legible body text visible in this photograph, exactly as written — no commentary, no description of the image, no formatting beyond what's on the page. If the photograph does not contain legible passage-like text (a scene, an object, a face — nothing meant to be read), reply with exactly: ${NO_TEXT}`

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/**
 * Extracts the text from a photographed page, or '' when there's nothing to
 * extract — no key, a non-text photo, a network failure, a bad reply. Never
 * throws: same posture as `confirmTension`, since a failed OCR should mean
 * exactly what it would have meant without this feature at all — a plain,
 * untranscribed Image thing, still fully editable by hand.
 */
export async function ocrPhoto(apiKey: string, blob: Blob, mediaType = 'image/jpeg'): Promise<string> {
  if (!apiKey) return ''
  try {
    const data = await blobToBase64(blob)
    const res = await requestAnthropic(
      apiKey,
      {
        model: MODEL_HAIKU,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      },
      { endpoint: PROXY_ENDPOINT },
    )
    if (!res.ok) return ''
    const payload = await res.json().catch(() => null)
    const text = extractAnthropicText(payload).trim()
    if (!text || text.toUpperCase() === NO_TEXT) return ''
    return text
  } catch {
    return ''
  }
}
