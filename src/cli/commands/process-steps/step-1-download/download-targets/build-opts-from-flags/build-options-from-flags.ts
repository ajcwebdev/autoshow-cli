import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import { isStep2BooleanProviderSelected } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import type { BuildDomainOptionsContext, BuildOptsDefaults, CliFlagOccurrence, RuntimeOptions } from '~/types'
import {
  readBooleanFlag,
  readOptionalStringFlag
} from '../options/flag-readers'
import { collectRepeatableModelFlagOccurrences, readAllShortcutFlags, resolveStep2SelectionOrigins } from '../options/model-flag-selection'
import { readRuntimeModelOptions } from '../options/download-model-options'
import { readInjectedConfigFlags } from './build-options-config-flags'
import { resolveLocalConcurrency, resolveProviderConcurrency, resolveTtsChunkConcurrency } from './concurrency'
import { readPromptFlags } from './prompt-options'
import { resolveTargetCounts } from './target-counts'
import { buildTtsOptions } from './tts-options'
import { HOSTED_URL_ARTICLE_BACKEND_CONCURRENCY_TARGET, resolveUrlOptions } from './url-options'
import { buildSttOptions } from './stt-options'
import { buildOcrOptions } from './ocr-options'
import { buildImageOptions } from './image-options'
import { buildMusicOptions } from './music-options'
import { buildVideoOptions } from './video-options'
import { buildBatchOptions } from './batch-options'

export { collectRepeatableModelFlagOccurrences, REPEATABLE_MODEL_FLAGS, normalizeModelFlagOccurrences } from '../options/model-flag-selection'

export const buildOptsFromFlags = (
  skipLLM: boolean,
  flags: Record<string, unknown>,
  _doubleDashArgs: string[] = [],
  defaults: BuildOptsDefaults = {},
  explicitFlags: Set<string> = new Set(),
  flagOccurrences: readonly CliFlagOccurrence[] = []
): RuntimeOptions => {
  void _doubleDashArgs
  const rawModelOccurrences = collectRepeatableModelFlagOccurrences(flagOccurrences)

  const mergedFlags: Record<string, unknown> = { ...flags }
  const allShortcutFlags = readAllShortcutFlags(mergedFlags)
  const configuredFlags = readInjectedConfigFlags(mergedFlags)

  const modelOptions = readRuntimeModelOptions(mergedFlags, rawModelOccurrences, allShortcutFlags, defaults)
  const {
    llamaModels,
    llamaModel,
    llamafileModels,
    llamafileModel,
    openaiModels,
    openaiModel,
    groqModels,
    groqModel,
    geminiModels,
    geminiModel,
    anthropicModels,
    anthropicModel,
    minimaxModels,
    minimaxModel,
    grokModels,
    grokModel,
    glmModels,
    glmModel,
    kimiModels,
    kimiModel,
    togetherModels,
    togetherModel,
    cerebrasModels,
    cerebrasModel,
  } = modelOptions
  const allUrlSelected = allShortcutFlags['all-url']
  const allLocalUrlSelected = allShortcutFlags['all-local-url']
  const urlOptions = resolveUrlOptions(mergedFlags, allUrlSelected, allLocalUrlSelected, {
    explicitFlags,
    configuredFlags,
    flagOccurrences
  })
  const useReverb = isStep2BooleanProviderSelected('reverb-stt', mergedFlags, allShortcutFlags)
  const step2SelectionOrigins = resolveStep2SelectionOrigins(mergedFlags, explicitFlags, rawModelOccurrences, allShortcutFlags, configuredFlags)
  const whisperExplicit = step2SelectionOrigins['whisper-stt'] === 'explicit' || step2SelectionOrigins['whisper-stt'] === 'all-shortcut'
  const targetCounts = resolveTargetCounts(modelOptions)
  const { hostedLlmTargetCount, hostedTtsTargetCount } = targetCounts

  const ctx: BuildDomainOptionsContext = {
    mergedFlags,
    explicitFlags,
    configuredFlags,
    allShortcutFlags,
    modelOptions,
    targetCounts
  }

  return {
    outputRootDir: getOutputRoot(),
    configPath: readOptionalStringFlag(mergedFlags, 'config-path'),
    useReverb,
    youtubeCaptions: readBooleanFlag(mergedFlags, 'youtube-captions'),
    whisperExplicit,
    step2SelectionOrigins,
    llamaModels,
    llamaModel,
    llamafileModels,
    llamafileModel,
    openaiModels,
    openaiModel,
    groqModels,
    groqModel,
    geminiModels,
    geminiModel,
    anthropicModels,
    anthropicModel,
    minimaxModels,
    minimaxModel,
    grokModels,
    grokModel,
    glmModels,
    glmModel,
    kimiModels,
    kimiModel,
    togetherModels,
    togetherModel,
    cerebrasModels,
    cerebrasModel,
    ...buildSttOptions(ctx),
    ...buildOcrOptions(ctx),
    llmProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'llm-provider-concurrency', allShortcutFlags['all-llm'], hostedLlmTargetCount, explicitFlags, configuredFlags),
    llmLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'llm-local-concurrency', explicitFlags, configuredFlags),
    ttsProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'tts-provider-concurrency', allShortcutFlags['all-tts'], hostedTtsTargetCount, explicitFlags, configuredFlags),
    ttsLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'tts-local-concurrency', explicitFlags, configuredFlags),
    ttsChunkConcurrency: resolveTtsChunkConcurrency(mergedFlags, modelOptions, explicitFlags, configuredFlags),
    ...buildImageOptions(ctx),
    ...buildVideoOptions(ctx),
    ...buildMusicOptions(ctx),
    price: readBooleanFlag(mergedFlags, 'price'),
    allowOverBudget: readBooleanFlag(mergedFlags, 'allow-over-budget'),
    skipLLM,
    ...urlOptions,
    urlProviderConcurrency: resolveProviderConcurrency(
      mergedFlags,
      'url-provider-concurrency',
      allUrlSelected,
      HOSTED_URL_ARTICLE_BACKEND_CONCURRENCY_TARGET,
      explicitFlags,
      configuredFlags
    ),
    ...buildBatchOptions(mergedFlags),
    ytDlpPassthroughArgs: undefined,
    prompts: readPromptFlags(mergedFlags),
    promptFile: readOptionalStringFlag(mergedFlags, 'prompt-file'),
    textInput: readBooleanFlag(mergedFlags, 'text-input'),
    renderedText: readBooleanFlag(mergedFlags, 'rendered-text'),
    renderedOutDir: readOptionalStringFlag(mergedFlags, 'rendered-out-dir'),
    trackList: readOptionalStringFlag(mergedFlags, 'track-list'),
    promptMd: readBooleanFlag(mergedFlags, 'prompt-md'),
    ...buildTtsOptions(mergedFlags, flagOccurrences, modelOptions),
    markdown: readBooleanFlag(mergedFlags, 'markdown'),
    save: readBooleanFlag(mergedFlags, 'save'),
  }
}
