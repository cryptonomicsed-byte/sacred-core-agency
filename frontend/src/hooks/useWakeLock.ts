import { useEffect, useRef } from 'react'
import { requestWakeLock, releaseWakeLock } from '../lib/webapis'

type WakeLockSentinel = { release: () => Promise<void> }

export function useWakeLock(active: boolean): { supported: boolean } {
  const lockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    let localLock: WakeLockSentinel | null = null

    async function acquire() {
      const lock = await requestWakeLock()
      localLock = lock
      lockRef.current = lock
    }

    async function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && active) {
        await acquire()
      }
    }

    if (active) {
      acquire()
    } else {
      if (lockRef.current) {
        releaseWakeLock(lockRef.current)
        lockRef.current = null
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (localLock) {
        releaseWakeLock(localLock)
        lockRef.current = null
      }
    }
  }, [active])

  return { supported: 'wakeLock' in navigator }
}
