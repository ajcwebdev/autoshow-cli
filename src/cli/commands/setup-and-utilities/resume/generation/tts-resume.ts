import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildUpdatedGenerationCostTiming } from '../generation-resume'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { runTtsTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { buildTtsEstimates } from '~/utils/pricing/aggregate-pricing/tts-estimates'
import type { GenerationResumeConfig, RuntimeOptions, Step4Metadata, TtsTarget } from '~/types'

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

export const ttsResumeConfig = {
  kind: 'tts' as const,
  metadataKey: 'tts',
  stepLabel: 'TTS',
  providerFlags: TTS_PROVIDER_FLAGS,
  selectionMode: 'additive-stored' as const,
  modelFields: TTS_MODEL_FIELDS,
  getSuccessKey: (entry: Step4Metadata) =>
    getGenerationTargetKey(entry.ttsService, entry.ttsModel),
  collectTargets: (opts: RuntimeOptions) => collectTtsTargets(opts),
  runMissingTargets: async (
    targets: TtsTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => await runTtsTargets(targets, input, outputDir, opts),
  buildEstimates: async (opts: RuntimeOptions, input: string) =>
    await buildTtsEstimates(opts, input.length),
  priceAggregateOptions: (input: string) => ({
    ttsTimingCharacterCount: input.length,
    ttsInputText: input
  }),
  rebuildRunMetadata: (
    metadata: Step4Metadata[],
    currentManifestMetadata: Record<string, unknown>,
    input: string
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step4: metadata, ttsCharacterCount: input.length }),
    computeActualProcessingTimes({ step4: metadata, ttsCharacterCount: input.length })
  )
} satisfies GenerationResumeConfig<TtsTarget, Step4Metadata>
