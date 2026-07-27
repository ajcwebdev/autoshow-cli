import type { ComputeEstimatedProcessingTimesInput, TimingStepEntry, TimingStepsResult } from '~/types'
import { getMusicEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { roundMs, withNormalizedTiming } from './timing-shared'

const GEMINI_CLIP_MUSIC_DURATION_SECONDS = 30
const GEMINI_PRO_DEFAULT_MUSIC_DURATION_SECONDS = 120
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
    if (target.model === 'lyria-3-clip-preview') {
      return GEMINI_CLIP_MUSIC_DURATION_SECONDS
    }
    if (target.model === 'lyria-3-pro-preview') {
      return target.durationSeconds ?? GEMINI_PRO_DEFAULT_MUSIC_DURATION_SECONDS
    }
  }

  return target.durationSeconds
}

export const buildMusicTimingSteps = (input: ComputeEstimatedProcessingTimesInput): TimingStepsResult => {
  const steps: TimingStepEntry[] = []

  const musicTargets = input.musicTargets && input.musicTargets.length > 0
    ? input.musicTargets
    : input.musicService && input.musicModel
      ? [{
          service: input.musicService,
          model: input.musicModel,
          ...(input.musicDurationSeconds !== undefined ? { durationSeconds: input.musicDurationSeconds } : {})
        }]
      : []

  for (const musicTarget of musicTargets) {
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
