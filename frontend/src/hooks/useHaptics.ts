import { triggerHaptic } from '../lib/webapis'

export function useHaptics() {
  return {
    tap: () => triggerHaptic([40]),
    confirm: () => triggerHaptic([50, 30, 50]),
    error: () => triggerHaptic([100, 50, 100]),
    deduct: () => triggerHaptic([30]),
  }
}
