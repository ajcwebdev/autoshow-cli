import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildGenerationPriceOptions, buildUpdatedGenerationCostTiming, collectGenerationTargetsForProviders, hasResumableGenerationWork, priceGenerationTarget, resumeGenerationTarget } from '../generation-resume'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { runTtsTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { aggregateExplicitPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { buildTtsEstimates } from '~/utils/pricing/aggregate-pricing/tts-estimates'
import type { AggregatedPriceEstimate, ResumeDisplayOptions, ResumeResult, ResumeTarget, RuntimeOptions, Step4Metadata, TtsTarget } from '~/types'

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

const collectTtsTargetsForProviders = (
  providers: Array<{ service: string, model: string }>,
  opts: RuntimeOptions
): TtsTarget[] =>
  collectGenerationTargetsForProviders(providers, opts, TTS_MODEL_FIELDS, collectTtsTargets)

const priceTtsTargets = async (
  targets: TtsTarget[],
  input: string,
  opts: RuntimeOptions
): Promise<AggregatedPriceEstimate> => {
  const priceOpts = buildGenerationPriceOptions(targets, opts, TTS_MODEL_FIELDS)
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
