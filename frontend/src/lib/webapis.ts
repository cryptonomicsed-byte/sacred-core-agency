type WakeLockSentinel = { release: () => Promise<void> }

// Session 3 — Navigator.vibrate()
export function triggerHaptic(pattern: number[]): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
  // silent fail on unsupported browsers
}

// Session 3 — Wake Lock API
export async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  if ('wakeLock' in navigator) {
    try {
      const lock = await (
        navigator as Navigator & {
          wakeLock: { request: (type: string) => Promise<WakeLockSentinel> }
        }
      ).wakeLock.request('screen')
      return lock
    } catch {
      return null
    }
  }
  return null
}

// Session 3 — Wake Lock API
export async function releaseWakeLock(lock: WakeLockSentinel | null): Promise<void> {
  if (lock) await lock.release()
}

// Session 5 — AmbientLightSensor
export async function getAmbientLight(): Promise<number | null> {
  try {
    type AmbientLightSensorConstructor = new () => {
      start: () => void
      stop: () => void
      illuminance: number | null
      addEventListener: (event: string, handler: () => void) => void
    }

    const ALS = (
      window as Window & { AmbientLightSensor?: AmbientLightSensorConstructor }
    ).AmbientLightSensor

    if (!ALS) return null

    return await new Promise<number | null>((resolve) => {
      const sensor = new ALS()
      sensor.addEventListener('reading', () => {
        const lux = sensor.illuminance
        sensor.stop()
        resolve(lux)
      })
      sensor.start()
      // Timeout in case no reading arrives
      setTimeout(() => {
        sensor.stop()
        resolve(null)
      }, 2000)
    })
  } catch {
    return null
  }
}

// Session 5 — Web Speech API
export function startSpeechRecognition(
  onResult: (text: string) => void,
  onEnd?: () => void,
): () => void {
  type SpeechRecognitionConstructor = new () => {
    continuous: boolean
    interimResults: boolean
    lang: string
    start: () => void
    stop: () => void
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onend: (() => void) | null
  }

  type SpeechRecognitionEvent = {
    results: {
      [index: number]: { [index: number]: { transcript: string } }
    }
  }

  const SpeechRecognition = (
    window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
  ).SpeechRecognition ?? (window as Window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition

  if (!SpeechRecognition) {
    console.warn('SpeechRecognition not supported in this browser')
    return () => {}
  }

  const recognition = new SpeechRecognition()
  recognition.continuous = false
  recognition.interimResults = false
  recognition.lang = 'en-US'

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript
    onResult(transcript)
  }

  recognition.onend = () => {
    onEnd?.()
  }

  recognition.start()

  return () => recognition.stop()
}

// Session 7 — Web Share API
export async function shareContent(params: {
  title: string
  text?: string
  url?: string
  file?: File
}): Promise<boolean> {
  const { title, text, url, file } = params

  if (!('share' in navigator) || !navigator.canShare) return false

  try {
    if (file && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title, text })
    } else {
      await navigator.share({ title, text, url })
    }
    return true
  } catch {
    return false
  }
}

// Session 7 — WebAuthn API
export async function registerWebAuthn(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false

  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Sacred Core Agency' },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'user@sacredcore.ai',
          displayName: 'Sacred Core User',
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    })
    return credential !== null
  } catch {
    return false
  }
}

// Session 7 — Badging API
export function updateAppBadge(count: number): void {
  if (!('setAppBadge' in navigator)) return
  const nav = navigator as Navigator & {
    setAppBadge: (count?: number) => Promise<void>
    clearAppBadge: () => Promise<void>
  }
  if (count === 0) {
    nav.clearAppBadge().catch(() => {})
  } else {
    nav.setAppBadge(count).catch(() => {})
  }
}
