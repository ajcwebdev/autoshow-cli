import { getMusicEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { estimateMusicCosts, MUSIC_PRICING_PROVIDERS } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import type { ComputeEstimatedCostsInput, CostStepsResult } from '~/types'
import { optionsForService } from '~/utils/pricing/model-selection'
import { pushGenerationEstimates } from './cost-steps-shared'

export const buildMusicCostSteps = (input: ComputeEstimatedCostsInput): CostStepsResult => {
  const hasMusic = input.musicTargets?.length
    || MUSIC_PRICING_PROVIDERS.some((provider) => (input[provider.modelsKey]?.length ?? 0) > 0)
  if (!hasMusic) {
    return { steps: [], cost: 0 }
  }

  const sharedOptions = {
    musicLyricsFile: input.musicLyricsFile,
    musicInstrumental: input.musicInstrumental
  }
  const selectionOptions = Object.assign({}, ...MUSIC_PRICING_PROVIDERS.map((provider) => {
    const models = input[provider.modelsKey]
    return models?.length ? optionsForService(MUSIC_PRICING_PROVIDERS, provider.service, models) : {}
  }))
  const musicEstimates = input.musicTargets === undefined
    ? estimateMusicCosts({ ...selectionOptions, ...sharedOptions, musicDuration: input.musicDuration })
    : MUSIC_PRICING_PROVIDERS.flatMap((provider) =>
        input.musicTargets!
          .filter((target) => target.service === provider.service)
          .flatMap((target) => estimateMusicCosts({
            ...optionsForService(MUSIC_PRICING_PROVIDERS, provider.service, target.model),
            ...sharedOptions,
            musicDuration: target.durationSeconds ?? input.musicDuration
          }))
      )

  return pushGenerationEstimates(
    musicEstimates,
    input,
    (estimate) => getMusicEstimation(estimate.provider, estimate.model).costMultiplier,
    'music',
    (estimate) => ({ durationSeconds: estimate.durationSeconds })
  )
}
