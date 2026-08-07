// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDictation } from './useDictation.ts'

/** A minimal fake SpeechRecognition — happy-dom has no real one. Captures the
 *  instance so a test can drive its callbacks directly. */
function installFakeSpeechRecognition() {
  let instance: any = null
  function FakeSpeechRecognition() {
    instance = {
      continuous: false, interimResults: false, lang: '',
      start: vi.fn(), stop: vi.fn(),
      onresult: null, onend: null, onerror: null,
    }
    return instance
  }
  ;(window as any).SpeechRecognition = FakeSpeechRecognition
  ;(window as any).webkitSpeechRecognition = FakeSpeechRecognition
  return () => instance
}

describe('useDictation', () => {
  beforeEach(() => {
    delete (window as any).SpeechRecognition
    delete (window as any).webkitSpeechRecognition
  })

  it('is unsupported when the browser has no SpeechRecognition', () => {
    const { result } = renderHook(() => useDictation(() => {}))
    expect(result.current.supported).toBe(false)
  })

  it('reports supported once a recognizer is available', () => {
    installFakeSpeechRecognition()
    const { result } = renderHook(() => useDictation(() => {}))
    expect(result.current.supported).toBe(true)
  })

  it('sets the recognizer language from the browser locale', () => {
    const getInstance = installFakeSpeechRecognition()
    renderHook(() => useDictation(() => {}))
    expect(getInstance().lang).toBe(navigator.language || 'en-US')
  })

  it('starts and stops on toggle', () => {
    const getInstance = installFakeSpeechRecognition()
    const { result } = renderHook(() => useDictation(() => {}))

    act(() => result.current.toggle())
    expect(getInstance().start).toHaveBeenCalledTimes(1)
    expect(result.current.listening).toBe(true)

    act(() => result.current.toggle())
    expect(getInstance().stop).toHaveBeenCalledTimes(1)
    expect(result.current.listening).toBe(false)
  })

  it('does nothing when toggled without a recognizer', () => {
    const { result } = renderHook(() => useDictation(() => {}))
    expect(() => act(() => result.current.toggle())).not.toThrow()
    expect(result.current.listening).toBe(false)
  })

  it('passes the transcript to onResult', () => {
    const getInstance = installFakeSpeechRecognition()
    const onResult = vi.fn()
    renderHook(() => useDictation(onResult))

    act(() => { getInstance().onresult({ results: [[{ transcript: 'blue jacket' }]] }) })
    expect(onResult).toHaveBeenCalledWith('blue jacket')
  })

  it('calls the latest onResult even though the wiring effect only runs once', () => {
    // Guards the onResultRef pattern: onresult is wired on mount. A stale
    // closure there would keep calling whichever callback was passed first.
    const getInstance = installFakeSpeechRecognition()
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ cb }) => useDictation(cb), { initialProps: { cb: first } })
    rerender({ cb: second })

    act(() => { getInstance().onresult({ results: [[{ transcript: 'hi' }]] }) })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('hi')
  })

  it('clears listening when recognition ends on its own', () => {
    const getInstance = installFakeSpeechRecognition()
    const { result } = renderHook(() => useDictation(() => {}))
    act(() => result.current.toggle())
    act(() => { getInstance().onend() })
    expect(result.current.listening).toBe(false)
  })

  it('shows a clear message when the microphone permission is denied', () => {
    const getInstance = installFakeSpeechRecognition()
    const { result } = renderHook(() => useDictation(() => {}))
    act(() => { getInstance().onerror({ error: 'not-allowed' }) })
    expect(result.current.error).toMatch(/Microphone access was denied/)
    expect(result.current.listening).toBe(false)
  })

  it('stays quiet on a no-speech error rather than showing one', () => {
    const getInstance = installFakeSpeechRecognition()
    const { result } = renderHook(() => useDictation(() => {}))
    act(() => { getInstance().onerror({ error: 'no-speech' }) })
    expect(result.current.error).toBe('')
  })

  it('clears a previous error when listening starts again', () => {
    const getInstance = installFakeSpeechRecognition()
    const { result } = renderHook(() => useDictation(() => {}))
    act(() => { getInstance().onerror({ error: 'not-allowed' }) })
    expect(result.current.error).not.toBe('')
    act(() => result.current.toggle())
    expect(result.current.error).toBe('')
  })
})
