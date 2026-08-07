import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildUpdatedGenerationCostTiming, hasResumableGenerationWork, priceGenerationTarget, resumeGenerationTarget } from '../generation-resume'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { runTtsTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { aggregateExplicitPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { buildTtsEstimates } from '~/utils/pricing/aggregate-pricing/tts-estimates'
import type { AggregatedPriceEstimate, ResumeDisplayOptions, ResumeResult, ResumeTarget, RuntimeOptions, Step4Metadata, TtsTarget } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

const RETIRED_TTS_MODEL_REPLACEMENTS: Readonly<Record<string, string>> = {
  'cartesia/sonic-3': 'cartesia=sonic-3.5-2026-05-04',
  'cartesia/sonic-3.5': 'cartesia=sonic-3.5-2026-05-04',
  'openai/gpt-4o-mini-tts': 'openai=gpt-4o-mini-tts-2025-12-15',
  'speechify/simba-english': 'speechify=simba-3.2'
}

const assertStoredMissingTtsProvidersAreActive = (
  providers: Array<{ service: string, model: string }>
): void => {
  for (const provider of providers) {
    const replacement = RETIRED_TTS_MODEL_REPLACEMENTS[`${provider.service}/${provider.model}`]
    if (!replacement) continue
    throw CLIUsageError(
      `Stored TTS target ${provider.service}/${provider.model} is incomplete, but that model is no longer in the active registry. AutoShow will not substitute a different model because that would change the stored target identity. Start a new target with --provider ${replacement}.`
    )
  }
}

const TTS_PROVIDER_FLAGS = [
  'all-tts',
  'all-local-tts',
  'kitten-tts',
  'elevenlabs-tts',
  'minimax-tts',
  'groq-tts',
  'grok-tts',
  'mistral-tts',
  'openai-tts',
  'gemini-tts',
  'deepgram-tts',
  'speechify-tts',
  'hume-tts',
  'cartesia-tts'
] as const

const TTS_MODEL_FIELDS = {
  kitten: ['kittenTtsModels', 'kittenTtsModel'],
  elevenlabs: ['elevenlabsTtsModels', 'elevenlabsTtsModel'],
  minimax: ['minimaxTtsModels', 'minimaxTtsModel'],
  groq: ['groqTtsModels', 'groqTtsModel'],
  grok: ['grokTtsModels', 'grokTtsModel'],
  mistral: ['mistralTtsModels', 'mistralTtsModel'],
  openai: ['openaiTtsModels', 'openaiTtsModel'],
  gemini: ['geminiTtsModels', 'geminiTtsModel'],
  deepgram: ['deepgramTtsModels', 'deepgramTtsModel'],
  speechify: ['speechifyTtsModels', 'speechifyTtsModel'],
  hume: ['humeTtsModels', 'humeTtsModel'],
  cartesia: ['cartesiaTtsModels', 'cartesiaTtsModel']
} as const

const clearTtsProviderModels = (opts: RuntimeOptions): RuntimeOptions => ({
  ...opts,
  kittenTtsModels: undefined,
  kittenTtsModel: undefined,
  elevenlabsTtsModels: undefined,
  elevenlabsTtsModel: undefined,
  minimaxTtsModels: undefined,
  minimaxTtsModel: undefined,
  groqTtsModels: undefined,
  groqTtsModel: undefined,
  grokTtsModels: undefined,
  grokTtsModel: undefined,
  mistralTtsModels: undefined,
  mistralTtsModel: undefined,
  openaiTtsModels: undefined,
  openaiTtsModel: undefined,
  geminiTtsModels: undefined,
  geminiTtsModel: undefined,
  deepgramTtsModels: undefined,
  deepgramTtsModel: undefined,
  speechifyTtsModels: undefined,
  speechifyTtsModel: undefined,
  humeTtsModels: undefined,
  humeTtsModel: undefined,
  cartesiaTtsModels: undefined,
  cartesiaTtsModel: undefined
})

const collectTtsTargetsForProviders = (
  providers: Array<{ service: string, model: string }>,
  opts: RuntimeOptions
): TtsTarget[] =>
  providers.flatMap((provider) => {
    const fields = TTS_MODEL_FIELDS[provider.service as keyof typeof TTS_MODEL_FIELDS]
    if (!fields) {
      return []
    }
    const [modelsField, modelField] = fields
    return collectTtsTargets({
      ...clearTtsProviderModels(opts),
      [modelsField]: [provider.model],
      [modelField]: provider.model
    } as RuntimeOptions).filter((target) =>
      target.service === provider.service && target.model === provider.model
    )
  })

const modelsForService = (
  targets: TtsTarget[],
  service: TtsTarget['service']
): string[] | undefined => {
  const models = targets
    .filter((target) => target.service === service)
    .map((target) => target.model)
  return models.length > 0 ? models : undefined
}

const buildTtsPriceOptions = (
  targets: TtsTarget[],
  opts: RuntimeOptions
): RuntimeOptions => ({
  ...clearTtsProviderModels(opts),
  kittenTtsModels: modelsForService(targets, 'kitten'),
  elevenlabsTtsModels: modelsForService(targets, 'elevenlabs'),
  minimaxTtsModels: modelsForService(targets, 'minimax'),
  groqTtsModels: modelsForService(targets, 'groq'),
  grokTtsModels: modelsForService(targets, 'grok'),
  mistralTtsModels: modelsForService(targets, 'mistral'),
  openaiTtsModels: modelsForService(targets, 'openai'),
  geminiTtsModels: modelsForService(targets, 'gemini'),
  deepgramTtsModels: modelsForService(targets, 'deepgram'),
  speechifyTtsModels: modelsForService(targets, 'speechify'),
  humeTtsModels: modelsForService(targets, 'hume'),
  cartesiaTtsModels: modelsForService(targets, 'cartesia')
})

const priceTtsTargets = async (
  targets: TtsTarget[],
  input: string,
  opts: RuntimeOptions
): Promise<AggregatedPriceEstimate> => {
  const priceOpts = buildTtsPriceOptions(targets, opts)
  const steps = await buildTtsEstimates(priceOpts, input.length)
  return aggregateExplicitPriceEstimate(steps, priceOpts, {
    ttsTimingCharacterCount: input.length,
    ttsInputText: input
  })
}

const ttsResumeConfig = {
  kind: 'tts' as const,
  metadataKey: 'tts',
  stepLabel: 'TTS',
  providerFlags: TTS_PROVIDER_FLAGS,
  getSuccessKey: (entry: Step4Metadata) =>
    getGenerationTargetKey(entry.ttsService, entry.ttsModel),
  collectTargets: (opts: RuntimeOptions) => collectTtsTargets(opts),
  collectTargetsForProviders: collectTtsTargetsForProviders,
  assertStoredMissingProvidersAreActive: assertStoredMissingTtsProvidersAreActive,
  runMissingTargets: async (
    targets: TtsTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => await runTtsTargets(targets, input, outputDir, opts),
  priceTargets: priceTtsTargets,
  rebuildRunMetadata: (
    metadata: Step4Metadata[],
    currentManifestMetadata: Record<string, unknown>,
    input: string
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step4: metadata, ttsCharacterCount: input.length }),
    computeActualProcessingTimes({ step4: metadata, ttsCharacterCount: input.length })
  )
}

export const hasResumableTtsWork = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<boolean> =>
  await hasResumableGenerationWork(target, ttsResumeConfig, opts, explicitFlags)

export const resumeTtsTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set(),
  displayOptions: ResumeDisplayOptions = {}
): Promise<ResumeResult> =>
  await resumeGenerationTarget(target, ttsResumeConfig, opts, explicitFlags, displayOptions)

export const priceTtsTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<AggregatedPriceEstimate> =>
  await priceGenerationTarget(target, ttsResumeConfig, opts, explicitFlags)
