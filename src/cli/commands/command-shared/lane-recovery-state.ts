import type { RecoveryState } from '~/types'

/** Recovery evidence belongs to one lane; unrelated accounts cannot affect it. */
export class LaneRecoveryState {
  readonly byWork = new Map<string, RecoveryState>()
  recovering = false
  probeActive = false
  rampingAfterRecovery = false

  begin(key: string, now: number): RecoveryState {
    const state = this.byWork.get(key) ?? { firstPressureAtMs: now, pressureAttempt: 0 }
    state.pressureAttempt += 1
    this.byWork.set(key, state)
    this.recovering = true
    this.rampingAfterRecovery = false
    return state
  }

  finishIfDrained(currentLimit: number, configuredLimit: number): boolean {
    if (this.byWork.size > 0) return false
    this.recovering = false
    this.rampingAfterRecovery = currentLimit < configuredLimit
    return true
  }

  clear(): void { this.byWork.clear() }
}
