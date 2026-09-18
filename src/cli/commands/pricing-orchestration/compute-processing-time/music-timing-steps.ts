import type { ComputeEstimatedProcessingTimesInput, TimingStepEntry, TimingStepsResult } from '~/types'
import { getMusicEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { roundMs, withNormalizedTiming } from './timing-shared'

const GEMINI_DEFAULT_MUSIC_DURATION_SECONDS = 120
const ELEVENLABS_DEFAULT_MUSIC_DURATION_SECONDS = 180
const MINIMAX_DEFAULT_MUSIC_DURATION_SECONDS = 120

const resolveMusicTimingDurationSeconds = (
  target: { service: string, model: string, durationSeconds?: number | undefined }
): number | undefined => {
  if (target.service === 'elevenlabs') {
    return target.durationSeconds ?? ELEVENLABS_DEFAULT_MUSIC_DURATION_SECONDS
  }

  if (target.service === 'minimax') {
    return MINIMAX_DEFAULT_MUSIC_DURATION_SECONDS
  }

  if (target.service === 'gemini') {
    return target.durationSeconds ?? GEMINI_DEFAULT_MUSIC_DURATION_SECONDS
  }

  return target.durationSeconds
}

export const buildMusicTimingSteps = (input: ComputeEstimatedProcessingTimesInput): TimingStepsResult => {
  const steps: TimingStepEntry[] = []

  for (const musicTarget of input.musicTargets ?? []) {
    const durationSeconds = resolveMusicTimingDurationSeconds(musicTarget)
    if (typeof durationSeconds === 'number') {
      const estimation = getMusicEstimation(musicTarget.service, musicTarget.model)
      steps.push(withNormalizedTiming({
        step: 'music',
        provider: musicTarget.service,
        model: musicTarget.model,
        processingTimeMs: roundMs(durationSeconds * estimation.msPerSecond),
        inputMetric: 'durationSeconds',
        inputValue: durationSeconds,
      }, 'estimated'))
    }
  }

  return { steps }
}
