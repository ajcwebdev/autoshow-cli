import type { MusicGenOptions, MusicTarget } from '~/types'
import { collectGenerationTargets } from '~/cli/commands/command-shared/generation-routing/collect-generation-targets'
import { MUSIC_PROVIDER_REGISTRY } from './music-provider-registry'
import { filterModelCostTargets } from '~/cli/commands/pricing-orchestration/model-cost-filter'

export const collectMusicTargets = (options: MusicGenOptions): MusicTarget[] => filterModelCostTargets(
  collectGenerationTargets(MUSIC_PROVIDER_REGISTRY, options, undefined),
  options,
  'music'
)
