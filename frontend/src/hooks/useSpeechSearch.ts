import { useState, useRef } from 'react'
import { startSpeechRecognition } from '../lib/webapis'
import { triggerHaptic } from '../lib/webapis'

export function useSpeechSearch(): {
  listening: boolean
  transcript: string
  startListening: () => void
  stopListening: () => void
  supported: boolean
} {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const stopRef = useRef<(() => void) | null>(null)

  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  function startListening() {
    if (listening) return
    triggerHaptic([30])
    setListening(true)

    const stop = startSpeechRecognition(
      (text) => {
        setTranscript(text)
        setListening(false)
      },
      () => {
        setListening(false)
      },
    )

    stopRef.current = stop
  }

  function stopListening() {
    stopRef.current?.()
    stopRef.current = null
    setListening(false)
  }

  return { listening, transcript, startListening, stopListening, supported }
}
