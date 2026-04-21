// Web Speech API wrapper. Works on mobile Safari (iOS 14.5+) and Chrome.
// Returns a controlled surface: { supported, listening, start, stop, transcript, error }.
//
// Design note: we do NOT auto-send. The transcript fills a text field so the
// user can review/edit before tapping send. See CheckinScreen + VoiceInput.

import { useCallback, useEffect, useRef, useState } from 'react'

function getRecognitionCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export function useVoiceInput({ lang = 'en-US', interim = true } = {}) {
  const Ctor = getRecognitionCtor()
  const supported = !!Ctor
  const recRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)

  // Build the recognition instance lazily and only once.
  useEffect(() => {
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = interim
    rec.maxAlternatives = 1

    rec.onresult = (event) => {
      // Concatenate interim + final results into a single running transcript.
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      setTranscript(text.trim())
    }
    rec.onerror = (event) => {
      // event.error: 'no-speech' | 'aborted' | 'audio-capture' | 'not-allowed' | 'network' | ...
      setError(event.error || 'speech-error')
      setListening(false)
    }
    rec.onend = () => setListening(false)

    recRef.current = rec
    return () => {
      try { rec.abort() } catch {}
      recRef.current = null
    }
  }, [Ctor, lang, interim])

  const start = useCallback(() => {
    if (!recRef.current) return
    setError(null)
    setTranscript('')
    try {
      recRef.current.start()
      setListening(true)
    } catch (e) {
      // Some browsers throw if start() is called while already listening.
      setError(e?.message || 'start-failed')
    }
  }, [])

  const stop = useCallback(() => {
    if (!recRef.current) return
    try { recRef.current.stop() } catch {}
    setListening(false)
  }, [])

  const reset = useCallback(() => {
    setTranscript('')
    setError(null)
  }, [])

  return { supported, listening, start, stop, reset, transcript, error }
}
