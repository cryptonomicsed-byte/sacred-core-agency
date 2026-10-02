import { useEffect, useState } from 'react'
import { getAmbientLight } from '../lib/webapis'

export function useAmbientLight(): { lux: number | null; supported: boolean } {
  const [lux, setLux] = useState<number | null>(null)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    // Check support on first poll attempt
    let mounted = true

    async function poll() {
      const reading = await getAmbientLight()
      if (!mounted) return

      if (reading !== null) {
        setSupported(true)
        setLux(reading)

        // Adjust --glass-opacity based on lux
        let opacity: string
        if (reading > 1000) {
          opacity = '0.08'
        } else if (reading >= 200) {
          opacity = '0.05'
        } else {
          opacity = '0.03'
        }
        document.documentElement.style.setProperty('--glass-opacity', opacity)
      }
    }

    void poll()
    const id = setInterval(poll, 5000)

    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  return { lux, supported }
}
