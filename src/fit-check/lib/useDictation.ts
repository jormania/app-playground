import { useEffect, useRef, useState } from 'react'

export interface Dictation {
  /** False on a browser with no SpeechRecognition — the caller hides the mic. */
  supported: boolean
  listening: boolean
  error: string
  toggle: () => void
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: { results: { [i: number]: { [i: number]: { transcript: string } } } }) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
}

/**
 * One-shot voice dictation into a single callback — no session, no context, no
 * follow-up turns. Fit Check's MVP deliberately stops here (see
 * FIT_CHECK_ROADMAP.md §2: conversational voice is out of scope); this is the
 * "mic button that dictates into the same field a keyboard would fill" the
 * roadmap describes, not a assistant you talk to.
 *
 * Mirrors WhereItWent's SmartTextEntry, the only other place in the repo doing
 * this — same event handling, same quiet treatment of "no-speech".
 */
export function useDictation(onResult: (text: string) => void): Dictation {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // The effect below wires `onresult` once, on mount. Without this ref it would
  // close over whatever `onResult` was at that moment — a stale callback if the
  // caller's identity ever changes across renders (e.g. from a dependency on
  // other state).
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    if (typeof window === 'undefined') return
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    // The device's own language setting is the one signal that's actually
    // meaningful here — not left to the engine's own default, which some
    // browsers resolve from the OS locale and others from <html lang>.
    recognition.lang = navigator.language || 'en-US'
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      onResultRef.current(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = (event) => {
      setListening(false)
      // "no-speech" is just silence — not worth interrupting with an error.
      if (event.error === 'no-speech' || event.error === 'aborted') return
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone access was denied. Enable it in your browser settings.')
      } else {
        setError('Dictation failed. Try again, or type instead.')
      }
    }

    recognitionRef.current = recognition
    setSupported(true)
    return () => { recognitionRef.current = null }
  }, [])

  function toggle() {
    const recognition = recognitionRef.current
    if (!recognition) return
    if (listening) {
      recognition.stop()
      setListening(false)
    } else {
      setError('')
      recognition.start()
      setListening(true)
    }
  }

  return { supported, listening, error, toggle }
}
