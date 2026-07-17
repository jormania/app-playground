import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { LEXICON_KEY, loadVoice, pickLexicon, saveVoice } from './lexicon.js'

const LexiconContext = createContext(null)

export function LexiconProvider({ children }) {
  const [voice, setVoiceState] = useState(() => loadVoice())

  useEffect(() => { saveVoice(voice) }, [voice])

  // Keep the app and the standalone guide (and other tabs) in step.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === LEXICON_KEY) setVoiceState(loadVoice()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(() => {
    const terms = pickLexicon(voice)
    return {
      voice,
      setVoice: setVoiceState,
      // t(key) → the term for the active voice, or the key itself if unmapped.
      t: (key) => (key in terms ? terms[key] : key),
    }
  }, [voice])

  return <LexiconContext.Provider value={value}>{children}</LexiconContext.Provider>
}

export function useLexicon() {
  const ctx = useContext(LexiconContext)
  if (!ctx) throw new Error('useLexicon must be used within a LexiconProvider')
  return ctx
}
