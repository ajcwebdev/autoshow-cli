import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildUpdatedGenerationCostTiming, hasResumableGenerationWork, priceGenerationTarget, resumeGenerationTarget } from '../generation-resume'
import { collectMusicTargets } from '~/cli/commands/process-steps/step-7-music/music-targets'
import { runMusicTargets } from '~/cli/commands/process-steps/step-7-music/run-music-gen'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { aggregateExplicitPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { buildMusicEstimates } from '~/utils/pricing/aggregate-pricing/generation-estimates'
import type { AggregatedPriceEstimate, MusicTarget, ResumeDisplayOptions, ResumeResult, ResumeTarget, RuntimeOptions, Step7MusicMetadata } from '~/types'

const MUSIC_PROVIDER_FLAGS = [
  'all-music',
  'elevenlabs-music',
  'minimax-music',
  'gemini-music'
] as const

const MUSIC_MODEL_FIELDS = {
  elevenlabs: ['elevenlabsMusicModels', 'elevenlabsMusicModel'],
  minimax: ['minimaxMusicModels', 'minimaxMusicModel'],
  gemini: ['geminiMusicModels', 'geminiMusicModel']
} as const

const clearMusicProviderModels = (opts: RuntimeOptions): RuntimeOptions => ({
  ...opts,
  elevenlabsMusicModels: undefined,
  elevenlabsMusicModel: undefined,
  minimaxMusicModels: undefined,
  minimaxMusicModel: undefined,
  geminiMusicModels: undefined,
  geminiMusicModel: undefined
})

const collectMusicTargetsForProviders = (
  providers: Array<{ service: string, model: string }>,
  opts: RuntimeOptions
): MusicTarget[] =>
  providers.flatMap((provider) => {
    const fields = MUSIC_MODEL_FIELDS[provider.service as keyof typeof MUSIC_MODEL_FIELDS]
    if (!fields) {
      return []
    }
    const [modelsField, modelField] = fields
    return collectMusicTargets({
      ...clearMusicProviderModels(opts),
      [modelsField]: [provider.model],
      [modelField]: provider.model
    } as RuntimeOptions).filter((target) =>
      target.service === provider.service && target.model === provider.model
    )
  })

const musicModelsForService = (
  targets: MusicTarget[],
  service: MusicTarget['service']
): string[] | undefined => {
  const models = targets
    .filter((target) => target.service === service)
    .map((target) => target.model)
  return models.length > 0 ? models : undefined
}

const buildMusicPriceOptions = (
  targets: MusicTarget[],
  opts: RuntimeOptions
): RuntimeOptions => ({
  ...clearMusicProviderModels(opts),
  elevenlabsMusicModels: musicModelsForService(targets, 'elevenlabs'),
  minimaxMusicModels: musicModelsForService(targets, 'minimax'),
  geminiMusicModels: musicModelsForService(targets, 'gemini')
})

const priceMusicTargets = async (
  targets: MusicTarget[],
  _input: string,
  opts: RuntimeOptions
): Promise<AggregatedPriceEstimate> => {
  const priceOpts = buildMusicPriceOptions(targets, opts)
  return aggregateExplicitPriceEstimate(await buildMusicEstimates(priceOpts), priceOpts)
}

const musicResumeConfig = {
  kind: 'music' as const,
  metadataKey: 'music',
  stepLabel: 'Music',
  providerFlags: MUSIC_PROVIDER_FLAGS,
  getSuccessKey: (entry: Step7MusicMetadata) =>
    getGenerationTargetKey(entry.musicService, entry.musicModel),
  collectTargets: (opts: RuntimeOptions) => collectMusicTargets(opts),
  collectTargetsForProviders: collectMusicTargetsForProviders,
  runMissingTargets: async (
    targets: MusicTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => {
    const { metadata } = await runMusicTargets(targets, input, outputDir, opts)
    return metadata
  },
  priceTargets: priceMusicTargets,
  rebuildRunMetadata: (
    metadata: Step7MusicMetadata[],
    currentManifestMetadata: Record<string, unknown>
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step7: metadata }),
    computeActualProcessingTimes({ step7: metadata })
  )
}

export const hasResumableMusicWork = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<boolean> =>
  await hasResumableGenerationWork(target, musicResumeConfig, opts, explicitFlags)

export const resumeMusicTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set(),
  displayOptions: ResumeDisplayOptions = {}
): Promise<ResumeResult> =>
  await resumeGenerationTarget(target, musicResumeConfig, opts, explicitFlags, displayOptions)

export const priceMusicTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<AggregatedPriceEstimate> =>
  await priceGenerationTarget(target, musicResumeConfig, opts, explicitFlags)
