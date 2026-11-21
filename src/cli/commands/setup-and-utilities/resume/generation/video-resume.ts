import { getGenerationTargetKey } from '~/cli/commands/command-shared/generation-command-utils'
import { buildUpdatedGenerationCostTiming } from '../generation-resume'
import { clearProviderModelFields, collectGenerationTargetsForProviders } from '../generation-resume-preparation'
import { providerSettingsSchema } from '~/cli/commands/command-shared/pipeline-manifest/provider-settings-record'
import { collectVideoTargets } from '~/cli/commands/visuals/video/video-targets'
import { runVideoTargets } from '~/cli/commands/visuals/video/run-video-gen'
import { deriveGenerationResumeModelFields, deriveGenerationResumeProviderFlags, VIDEO_GENERATION_SELECTION } from '~/cli/flags/service-selector-normalization/provider-targets'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeActualProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { buildVideoEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/generation-estimates'
import type { GenerationResumeConfig, GenerationResumeRunContext, Step6VideoMetadata, VideoGenOptions, VideoTarget } from '~/types'
import { isRecord } from '~/utils/value-helpers'

const VIDEO_MODEL_FIELDS = deriveGenerationResumeModelFields(VIDEO_GENERATION_SELECTION)

const requestResolution = (request: Record<string, unknown>): string | undefined => {
  if (typeof request['resolution'] === 'string') return request['resolution']
  const effective = request['effective']
  return isRecord(effective) && typeof effective['resolution'] === 'string' ? effective['resolution'] : undefined
}

export const videoResumeConfig = {
  kind: 'video' as const,
  metadataKey: 'video',
  stepLabel: 'Video',
  providerFlags: deriveGenerationResumeProviderFlags(VIDEO_GENERATION_SELECTION, 'all-video'),
  selectionMode: 'additive-stored' as const,
  modelFields: VIDEO_MODEL_FIELDS,
  getSuccessKey: (entry: Step6VideoMetadata) =>
    getGenerationTargetKey(entry.videoGenService, entry.videoGenModel),
  collectTargets: (opts: VideoGenOptions) => collectVideoTargets(opts),
  requiresStoredSettings: () => true,
  resolveStoredTargets: (providers, opts, _target, item, explicitFlags) => providers.flatMap(provider => {
    const settings = item.providers.find(state => state.service === provider.service && state.model === provider.model)?.settings
    const storedResolution = settings?.settingsSchema === providerSettingsSchema(provider.service, 'video')
      ? requestResolution(settings.request)
      : undefined
    const providerOptions = storedResolution !== undefined && !explicitFlags?.has('resolution')
      ? { ...opts, videoResolution: storedResolution }
      : opts
    return collectGenerationTargetsForProviders([provider], providerOptions, VIDEO_MODEL_FIELDS, collectVideoTargets)
  }),
  runMissingTargets: async (
    targets: VideoTarget[],
    input: string,
    outputDir: string,
    opts: VideoGenOptions,
    context: GenerationResumeRunContext<VideoTarget, Step6VideoMetadata, VideoGenOptions>
  ) => {
    const { metadata } = await runVideoTargets(targets, input, outputDir, {
      ...opts,
      mediaResume: {
        recordedFileNames: context.existingEntries.map(entry => entry.videoFileName),
        useProviderNames: context.existingEntries.length > 0
      }
    })
    return metadata
  },
  buildEstimates: async (opts, _input, { targets }) => {
    const baseOptions = clearProviderModelFields(opts, VIDEO_MODEL_FIELDS)
    const estimates = await Promise.all(targets.map(target => buildVideoEstimates({
      ...baseOptions,
      [VIDEO_GENERATION_SELECTION.selections[target.service].modelsKey]: [target.model],
      videoResolution: requestResolution(target.requestSettings)
    })))
    return estimates.flat()
  },
  rebuildRunMetadata: (
    metadata: Step6VideoMetadata[],
    currentManifestMetadata: Record<string, unknown>
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step6: metadata }),
    computeActualProcessingTimes({ step6: metadata })
  )
} satisfies GenerationResumeConfig<VideoTarget, Step6VideoMetadata, VideoGenOptions>
