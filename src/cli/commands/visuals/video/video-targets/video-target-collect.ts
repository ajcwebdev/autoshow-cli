import type { VideoGenOptions, VideoTarget } from '~/types'
import { resolveVideoMode, validateModeInputs } from '../video-utils/video-mode-validation'
import { collectGenerationTargets } from '~/cli/commands/command-shared/generation-routing/collect-generation-targets'
import { VIDEO_PROVIDER_REGISTRY } from './video-provider-registry'
import { filterModelCostTargets } from '~/cli/commands/pricing-orchestration/model-cost-filter'
import { UsageError } from '~/utils/error-handler'

export const collectVideoTargets = (options: VideoGenOptions): VideoTarget[] => {
  const mode = resolveVideoMode(options.videoMode)
  validateModeInputs(options, mode)

  const targets = filterModelCostTargets(
    collectGenerationTargets(VIDEO_PROVIDER_REGISTRY, options, mode),
    options,
    'video'
  )
  for (const target of targets) {
    if (target.service === 'grok') {
      if ((options.videoReferenceVideos?.length ?? 0) > 0) throw UsageError(`--reference-video is not supported by grok/${target.model}.`)
    }
  }
  return targets
}
