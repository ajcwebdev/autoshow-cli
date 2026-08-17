import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import type { BuildOptsDefaults, CliFlagOccurrence, ResolvedFlagContext, TtsOptionResolutionAuthority } from '~/types'
import {
  parseHostedConcurrencyMode,
  readBooleanFlag,
  readOptionalStringFlag
} from './flag-readers'
import { parseReasoningEffort } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { collectRepeatableModelFlagOccurrences, readAllShortcutFlags, resolveStep2SelectionOrigins } from './model-flag-selection'
import { readRuntimeModelOptions } from './download-model-options'
import { readInjectedConfigFlags } from './build-options-config-flags'
import { resolveLocalConcurrency, resolveProviderConcurrency, resolveTtsChunkConcurrency } from './concurrency'
import { readPromptFlags } from './prompt-options'
import { buildTtsOptions } from './tts-options'
import { resolveUrlOptions } from './url-options'
import { buildSttOptions } from './stt-options'
import { buildOcrOptions } from './ocr-options'
import { buildImageOptions } from './image-options'
import { buildMusicOptions } from './music-options'
import { buildVideoOptions } from './video-options'
import { buildBatchOptions } from './batch-options'
import { createHostedConcurrencyCoordinator } from '~/cli/commands/process-steps/hosted-concurrency-coordinator'

export { collectRepeatableModelFlagOccurrences, REPEATABLE_MODEL_FLAGS, normalizeModelFlagOccurrences } from './model-flag-selection'

const emptyYtDlpPassthroughArgs = (): string[] | undefined => undefined

type BuildOptsResolutionContext = Readonly<{
  flagOccurrences?: readonly CliFlagOccurrence[] | undefined
  ttsOptionResolutionAuthority?: TtsOptionResolutionAuthority | undefined
}>

const isBuildOptsResolutionContext = (
  value: readonly CliFlagOccurrence[] | BuildOptsResolutionContext
): value is BuildOptsResolutionContext => !Array.isArray(value)

export const buildOptsFromFlags = (
  skipLLM: boolean,
  flags: Record<string, unknown>,
  defaults: BuildOptsDefaults = {},
  explicitFlags: Set<string> = new Set(),
  occurrencesOrContext: readonly CliFlagOccurrence[] | BuildOptsResolutionContext = []
) => {
  const flagOccurrences = isBuildOptsResolutionContext(occurrencesOrContext)
    ? occurrencesOrContext.flagOccurrences ?? []
    : occurrencesOrContext
  const ttsOptionResolutionAuthority = isBuildOptsResolutionContext(occurrencesOrContext)
    ? occurrencesOrContext.ttsOptionResolutionAuthority ?? {}
    : {}
  const rawModelOccurrences = collectRepeatableModelFlagOccurrences(flagOccurrences)

  const mergedFlags: Record<string, unknown> = { ...flags }
  const allShortcutFlags = readAllShortcutFlags(mergedFlags)
  const configuredFlags = readInjectedConfigFlags(mergedFlags)

  const modelOptions = readRuntimeModelOptions(mergedFlags, rawModelOccurrences, allShortcutFlags, defaults)
  const {
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
  const step2SelectionOrigins = resolveStep2SelectionOrigins(mergedFlags, explicitFlags, rawModelOccurrences, allShortcutFlags, configuredFlags)
  const whisperExplicit = step2SelectionOrigins['whisper-stt'] === 'explicit' || step2SelectionOrigins['whisper-stt'] === 'all-shortcut'

  const ctx: ResolvedFlagContext = {
    mergedFlags,
    explicitFlags,
    configuredFlags,
    flagOccurrences,
    defaults,
    allShortcutFlags,
    modelOptions
  }

  const concurrencyMode = parseHostedConcurrencyMode(readOptionalStringFlag(mergedFlags, 'concurrency-mode'))
  return {
    concurrencyMode,
    hostedConcurrencyCoordinator: createHostedConcurrencyCoordinator({ mode: concurrencyMode }),
    outputRootDir: getOutputRoot(),
    configPath: readOptionalStringFlag(mergedFlags, 'config-path'),
    youtubeCaptions: readBooleanFlag(mergedFlags, 'youtube-captions'),
    whisperExplicit,
    step2SelectionOrigins,
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
    llmProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'llm-provider-concurrency', allShortcutFlags['all-llm'], explicitFlags, configuredFlags),
    llmLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'llm-local-concurrency', explicitFlags, configuredFlags),
    ttsProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'tts-provider-concurrency', allShortcutFlags['all-tts'], explicitFlags, configuredFlags),
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
      explicitFlags,
      configuredFlags
    ),
    ...buildBatchOptions(mergedFlags),
    ytDlpPassthroughArgs: emptyYtDlpPassthroughArgs(),
    prompts: readPromptFlags(mergedFlags),
    promptFile: readOptionalStringFlag(mergedFlags, 'prompt-file'),
    textInput: readBooleanFlag(mergedFlags, 'text-input'),
    renderedText: readBooleanFlag(mergedFlags, 'rendered-text'),
    renderedOutDir: readOptionalStringFlag(mergedFlags, 'rendered-out-dir'),
    trackList: readOptionalStringFlag(mergedFlags, 'track-list'),
    promptMd: readBooleanFlag(mergedFlags, 'prompt-md'),
    ...buildTtsOptions(mergedFlags, flagOccurrences, modelOptions, {
      explicitFlags,
      configuredFlags,
      ...ttsOptionResolutionAuthority
    }),
    markdown: readBooleanFlag(mergedFlags, 'markdown'),
    save: readBooleanFlag(mergedFlags, 'save'),
    reasoningEffort: parseReasoningEffort(readOptionalStringFlag(mergedFlags, 'reasoning-effort'))
  }
}
