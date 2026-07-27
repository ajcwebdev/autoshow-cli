import { getMusicEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { estimateMusicCosts } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import type { ComputeEstimatedCostsInput, CostStepsResult } from '~/types'
import { pushGenerationEstimates } from './cost-steps-shared'

export const buildMusicCostSteps = (input: ComputeEstimatedCostsInput): CostStepsResult => {
  const hasMusic = input.musicTargets?.length
    || input.elevenlabsMusicModel
    || input.minimaxMusicModel
    || input.geminiMusicModel
  if (!hasMusic) {
    return { steps: [], cost: 0 }
  }

  const musicEstimates = estimateMusicCosts({
    elevenlabsMusicModels: input.musicTargets?.filter((target) => target.service === 'elevenlabs').map((target) => target.model),
    elevenlabsMusicModel: input.elevenlabsMusicModel,
    minimaxMusicModels: input.musicTargets?.filter((target) => target.service === 'minimax').map((target) => target.model),
    minimaxMusicModel: input.minimaxMusicModel,
    geminiMusicModels: input.musicTargets?.filter((target) => target.service === 'gemini').map((target) => target.model),
    geminiMusicModel: input.geminiMusicModel,
    musicDuration: input.musicTargets?.find((target) => typeof target.durationSeconds === 'number')?.durationSeconds ?? input.musicDuration,
    musicLyricsFile: input.musicLyricsFile,
    musicInstrumental: input.musicInstrumental
  })

  return pushGenerationEstimates(
    musicEstimates,
    input,
    (estimate) => getMusicEstimation(estimate.provider, estimate.model).costMultiplier,
    'music',
    (estimate) => ({ durationSeconds: estimate.durationSeconds })
  )
}
