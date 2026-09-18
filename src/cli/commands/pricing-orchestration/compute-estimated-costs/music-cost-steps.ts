import { getMusicEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { estimateMusicCosts, MUSIC_PRICING_PROVIDERS } from '~/cli/commands/audio/music/music-utils/music-pricing'
import type { ComputeEstimatedCostsInput, CostStepsResult } from '~/types'
import { optionsForService } from '~/utils/pricing/model-selection'
import { pushGenerationEstimates } from './cost-steps-shared'

export const buildMusicCostSteps = (input: ComputeEstimatedCostsInput): CostStepsResult => {
  if (!input.musicTargets?.length) {
    return { steps: [], cost: 0 }
  }

  const sharedOptions = {
    musicLyricsFile: input.musicLyricsFile,
    musicInstrumental: input.musicInstrumental
  }
  const musicEstimates = MUSIC_PRICING_PROVIDERS.flatMap((provider) =>
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
