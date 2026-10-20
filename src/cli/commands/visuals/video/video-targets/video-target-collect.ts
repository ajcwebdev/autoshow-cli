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
  const restrictedControls = [
    [options.replicateVideoSeed !== undefined, '--seed'],
    [Boolean(options.replicateVideoNegativePrompt), '--negative-prompt'],
    [options.replicateVideoMultiClip !== undefined, '--multi-clip']
  ] as const
  const unsupportedFlags = restrictedControls.filter(([present]) => present).map(([, flag]) => flag)
  const unsupportedTargets = unsupportedFlags.length > 0 ? targets.filter(target => target.service !== 'replicate') : []
  if (unsupportedTargets.length > 0) {
    throw UsageError(`${unsupportedFlags.join(', ')} ${unsupportedFlags.length === 1 ? 'is' : 'are'} not supported by ${unsupportedTargets.map(target => `${target.service}/${target.model}`).join(', ')}. Select compatible Replicate targets explicitly.`)
  }
  for (const target of targets) {
    const nativeAudioControl = target.service === 'replicate'
      ? ['bytedance/seedance-2.5', 'pixverse/pixverse-v6'].includes(target.model)
      : target.service === 'fal' && target.model.startsWith('bytedance/seedance-2.5/')
    if (options.videoGenerateAudio !== undefined && !nativeAudioControl) {
      throw UsageError(`--generate-audio is not configurable for ${target.service}/${target.model}; omit the flag to use its fixed provider audio behavior.`)
    }
    if (target.service === 'grok') {
      const unsupportedReferences = [
        [(options.videoReferenceVideos?.length ?? 0) > 0, '--reference-video'],
        [(options.videoReferenceAudios?.length ?? 0) > 0, '--reference-audio']
      ] as const
      const references = unsupportedReferences.filter(([present]) => present).map(([, flag]) => flag)
      if (references.length > 0) throw UsageError(`${references.join(', ')} ${references.length === 1 ? 'is' : 'are'} not supported by grok/${target.model}.`)
    }
  }
  return targets
}
