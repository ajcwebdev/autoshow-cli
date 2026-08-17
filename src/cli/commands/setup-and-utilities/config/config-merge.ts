import type { AutoshowConfig, CliFlagOccurrence, RepeatableModelFlag } from '~/types/index'
import * as l from '~/utils/app-logger/app-logger'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import {
  REPEATABLE_MODEL_FLAGS,
  collectRepeatableModelFlagOccurrences,
  normalizeModelFlagOccurrences,
} from '~/cli/options/option-resolution/build-options-from-flags'
import {
  getStep2ProviderConfigPathEntries,
  getStep2ProviderSelectionFlagNames
} from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import {
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  STANDALONE_TTS_PROVIDER_TARGETS,
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  WRITE_LLM_PROVIDER_TARGETS
} from '~/cli/flags/service-selector-normalization/provider-targets'

const STT_PROVIDER_FLAGS = getStep2ProviderSelectionFlagNames('stt')
const OCR_PROVIDER_FLAGS = getStep2ProviderSelectionFlagNames('ocr')
const URL_PROVIDER_FLAGS = getStep2ProviderSelectionFlagNames('url')
const URL_PROVIDER_DEFAULT_GROUP_FLAGS = [...URL_PROVIDER_FLAGS, 'all-url', 'all-local-url', 'all-providers', 'all-local'] as const
const LLM_PROVIDER_FLAGS = Object.values(WRITE_LLM_PROVIDER_TARGETS)
const TTS_PROVIDER_FLAGS = Object.values(STANDALONE_TTS_PROVIDER_TARGETS)
const IMAGE_PROVIDER_FLAGS = Object.values(STANDALONE_IMAGE_PROVIDER_TARGETS)
const VIDEO_PROVIDER_FLAGS = Object.values(STANDALONE_VIDEO_PROVIDER_TARGETS)
const MUSIC_PROVIDER_FLAGS = Object.values(STANDALONE_MUSIC_PROVIDER_TARGETS)
const REPEATABLE_CONFIG_MODEL_FLAG_SET = new Set<string>(REPEATABLE_MODEL_FLAGS)
const CONFIG_INJECTED_FLAGS_KEY = '__autoshowConfigInjectedFlags'
// Written by the passes after the main loop rather than through
// FLAG_TO_CONFIG_PATH, because each fans out to several config keys.
const MULTI_DESTINATION_FLAGS = new Set(['provider-concurrency', 'local-concurrency', 'prompt'])
const STEP2_PROVIDER_CONFIG_PATHS = Object.fromEntries(
  getStep2ProviderConfigPathEntries().map(({ flagName, configPath }) => [flagName, [...configPath]])
) as Record<string, string[]>

// Provider-selection defaults are injected as whole groups: naming any provider
// in a group on the command line drops the configured defaults for every provider
// in it, so an explicit `--openai` is not joined by a configured `--groq`.
// `gate` is the explicit-flag guard, `flags` is what actually gets injected — the
// two differ only for URL, whose guard also covers the `all-*` bundles that
// select providers indirectly and have no config destination of their own.
const PROVIDER_SELECTION_GROUPS: readonly { gate: readonly string[], flags: readonly string[] }[] = [
  { gate: STT_PROVIDER_FLAGS, flags: STT_PROVIDER_FLAGS },
  { gate: LLM_PROVIDER_FLAGS, flags: LLM_PROVIDER_FLAGS },
  { gate: TTS_PROVIDER_FLAGS, flags: TTS_PROVIDER_FLAGS },
  { gate: IMAGE_PROVIDER_FLAGS, flags: IMAGE_PROVIDER_FLAGS },
  { gate: VIDEO_PROVIDER_FLAGS, flags: VIDEO_PROVIDER_FLAGS },
  { gate: MUSIC_PROVIDER_FLAGS, flags: MUSIC_PROVIDER_FLAGS },
  { gate: OCR_PROVIDER_FLAGS, flags: OCR_PROVIDER_FLAGS },
  { gate: URL_PROVIDER_DEFAULT_GROUP_FLAGS, flags: URL_PROVIDER_FLAGS }
]

// Flags the group pass owns, which the flag-by-flag pass must therefore skip.
// Step-2 registry flags are excluded wholesale rather than by group membership:
// an entry that is not `resumeSelectable` is absent from the groups but still
// lands in FLAG_TO_CONFIG_PATH through the spread, and such a flag has never
// been injected as a default.
const GROUP_INJECTED_FLAGS = new Set<string>([
  ...PROVIDER_SELECTION_GROUPS.flatMap(({ flags }) => [...flags]),
  ...Object.keys(STEP2_PROVIDER_CONFIG_PATHS)
])

const readNestedValue = (
  source: Record<string, unknown>,
  path: readonly string[]
): unknown => {
  let current: unknown = source
  for (const segment of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current) || !(segment in current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

export const mergeConfigIntoRawFlags = (
  rawFlags: Record<string, unknown>,
  config: AutoshowConfig,
  explicitFlags: Set<string>
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...rawFlags }
  const injectedFlags = new Set<string>()
  const d = config.defaults
  if (!d) return merged

  const configRecord = config as unknown as Record<string, unknown>

  const inject = (flagName: string, path: readonly string[]): void => {
    const value = readNestedValue(configRecord, path)
    if (value === undefined || explicitFlags.has(flagName)) return
    merged[flagName] = typeof value === 'number' ? String(value) : value
    injectedFlags.add(flagName)
  }

  for (const { gate, flags } of PROVIDER_SELECTION_GROUPS) {
    if (gate.some(flag => explicitFlags.has(flag))) continue
    for (const flagName of flags) {
      const path = FLAG_TO_CONFIG_PATH[flagName]
      if (path) inject(flagName, path)
    }
  }

  // Everything else is a one-flag-one-destination default, so the table is the
  // whole mapping. Section gating is implicit: a missing config section makes
  // readNestedValue return undefined and inject skip the flag. Paths outside
  // `defaults` (`max-cents`, cookie auth) are not CLI defaults and stay excluded,
  // as does `prompt`, which has no table entry and is handled below.
  for (const [flagName, path] of Object.entries(FLAG_TO_CONFIG_PATH)) {
    if (GROUP_INJECTED_FLAGS.has(flagName) || path[0] !== 'defaults') continue
    inject(flagName, path)
  }

  if (d.prompts && d.prompts.length > 0 && !explicitFlags.has('prompt')) {
    merged['prompt'] = d.prompts
    injectedFlags.add('prompt')
  }

  if (injectedFlags.size > 0) {
    merged[CONFIG_INJECTED_FLAGS_KEY] = [...injectedFlags]
  }

  return merged
}

export const FLAG_TO_CONFIG_PATH: Record<string, string[]> = {
  'concurrency-mode': ['defaults', 'concurrency', 'mode'],
  ...STEP2_PROVIDER_CONFIG_PATHS,
  'youtube-captions':  ['defaults', 'extract', 'stt', 'youtubeCaptions'],
  'stt-happyscribe-organization-id': ['defaults', 'extract', 'stt', 'happyscribeOrganizationId'],
  'stt-supadata-lang':     ['defaults', 'extract', 'stt', 'supadataLang'],
  'stt-scrapecreators-lang': ['defaults', 'extract', 'stt', 'scrapecreatorsLang'],
  'speaker-count':     ['defaults', 'extract', 'stt', 'speakerCount'],
  'split':             ['defaults', 'extract', 'stt', 'split'],
  'stt-provider-concurrency': ['defaults', 'extract', 'stt', 'providerConcurrency'],
  'stt-local-concurrency': ['defaults', 'extract', 'stt', 'localConcurrency'],
  'stt-segment-concurrency': ['defaults', 'extract', 'stt', 'segmentConcurrency'],
  'stt-preflight-concurrency': ['defaults', 'extract', 'stt', 'preflightConcurrency'],
  'openai':            ['defaults', 'llm', 'openai'],
  'groq':              ['defaults', 'llm', 'groq'],
  'gemini':            ['defaults', 'llm', 'gemini'],
  'anthropic':         ['defaults', 'llm', 'anthropic'],
  'minimax':           ['defaults', 'llm', 'minimax'],
  'grok':              ['defaults', 'llm', 'grok'],
  'glm':               ['defaults', 'llm', 'glm'],
  'kimi':              ['defaults', 'llm', 'kimi'],
  'together':          ['defaults', 'llm', 'together'],
  'cerebras':          ['defaults', 'llm', 'cerebras'],
  'llm-provider-concurrency': ['defaults', 'llm', 'providerConcurrency'],
  'llm-local-concurrency': ['defaults', 'llm', 'localConcurrency'],
  'elevenlabs-tts':    ['defaults', 'post', 'tts', 'elevenlabsTts'],
  'minimax-tts':       ['defaults', 'post', 'tts', 'minimaxTts'],
  'groq-tts':          ['defaults', 'post', 'tts', 'groqTts'],
  'grok-tts':          ['defaults', 'post', 'tts', 'grokTts'],
  'mistral-tts':       ['defaults', 'post', 'tts', 'mistralTts'],
  'openai-tts':        ['defaults', 'post', 'tts', 'openaiTts'],
  'gemini-tts':        ['defaults', 'post', 'tts', 'geminiTts'],
  'deepgram-tts':      ['defaults', 'post', 'tts', 'deepgramTts'],
  'speechify-tts':     ['defaults', 'post', 'tts', 'speechifyTts'],
  'hume-tts':          ['defaults', 'post', 'tts', 'humeTts'],
  'cartesia-tts':      ['defaults', 'post', 'tts', 'cartesiaTts'],
  'fish-tts':          ['defaults', 'post', 'tts', 'fishTts'],
  'inworld-tts':       ['defaults', 'post', 'tts', 'inworldTts'],
  'deepinfra-tts':     ['defaults', 'post', 'tts', 'deepinfraTts'],
  'replicate-tts':     ['defaults', 'post', 'tts', 'replicateTts'],
  'fal-tts':           ['defaults', 'post', 'tts', 'falTts'],
  'groq-voice':        ['defaults', 'post', 'tts', 'groqVoice'],
  'grok-tts-voice':    ['defaults', 'post', 'tts', 'grokTtsVoice'],
  'grok-tts-language': ['defaults', 'post', 'tts', 'grokTtsLanguage'],
  'grok-tts-text-normalization': ['defaults', 'post', 'tts', 'grokTtsTextNormalization'],
  'mistral-tts-voice': ['defaults', 'post', 'tts', 'mistralTtsVoice'],
  'tts-dialogue-format': ['defaults', 'post', 'tts', 'ttsDialogueFormat'],
  'tts-speaker': ['defaults', 'post', 'tts', 'ttsSpeakers'],
  'openai-voice':      ['defaults', 'post', 'tts', 'openaiVoice'],
  'openai-tts-instructions': ['defaults', 'post', 'tts', 'openaiTtsInstructions'],
  'openai-tts-speed': ['defaults', 'post', 'tts', 'openaiTtsSpeed'],
  'gemini-voice':      ['defaults', 'post', 'tts', 'geminiVoice'],
  'deepgram-tts-speed': ['defaults', 'post', 'tts', 'deepgramTtsSpeed'],
  'elevenlabs-voice':  ['defaults', 'post', 'tts', 'elevenlabsVoice'],
  'elevenlabs-tts-language-code': ['defaults', 'post', 'tts', 'elevenlabsTtsLanguageCode'],
  'elevenlabs-tts-stability': ['defaults', 'post', 'tts', 'elevenlabsTtsStability'],
  'elevenlabs-tts-similarity-boost': ['defaults', 'post', 'tts', 'elevenlabsTtsSimilarityBoost'],
  'elevenlabs-tts-style': ['defaults', 'post', 'tts', 'elevenlabsTtsStyle'],
  'elevenlabs-tts-use-speaker-boost': ['defaults', 'post', 'tts', 'elevenlabsTtsUseSpeakerBoost'],
  'elevenlabs-tts-speed': ['defaults', 'post', 'tts', 'elevenlabsTtsSpeed'],
  'elevenlabs-tts-seed': ['defaults', 'post', 'tts', 'elevenlabsTtsSeed'],
  'elevenlabs-tts-text-normalization': ['defaults', 'post', 'tts', 'elevenlabsTtsTextNormalization'],
  'elevenlabs-tts-pronunciation-dictionary-locator': ['defaults', 'post', 'tts', 'elevenlabsTtsPronunciationDictionaryLocators'],
  'minimax-tts-voice': ['defaults', 'post', 'tts', 'minimaxTtsVoice'],
  'minimax-tts-language-boost': ['defaults', 'post', 'tts', 'minimaxTtsLanguageBoost'],
  'minimax-tts-speed': ['defaults', 'post', 'tts', 'minimaxTtsSpeed'],
  'minimax-tts-volume': ['defaults', 'post', 'tts', 'minimaxTtsVolume'],
  'minimax-tts-pitch': ['defaults', 'post', 'tts', 'minimaxTtsPitch'],
  'minimax-tts-emotion': ['defaults', 'post', 'tts', 'minimaxTtsEmotion'],
  'minimax-tts-english-normalization': ['defaults', 'post', 'tts', 'minimaxTtsEnglishNormalization'],
  'minimax-tts-pronunciation': ['defaults', 'post', 'tts', 'minimaxTtsPronunciations'],
  'deepgram-voice':    ['defaults', 'post', 'tts', 'deepgramVoice'],
  'speechify-voice':   ['defaults', 'post', 'tts', 'speechifyVoice'],
  'speechify-tts-language': ['defaults', 'post', 'tts', 'speechifyTtsLanguage'],
  'hume-tts-voice':    ['defaults', 'post', 'tts', 'humeTtsVoice'],
  'cartesia-tts-voice': ['defaults', 'post', 'tts', 'cartesiaTtsVoice'],
  'cartesia-tts-language': ['defaults', 'post', 'tts', 'cartesiaTtsLanguage'],
  'tts-provider-concurrency': ['defaults', 'post', 'tts', 'providerConcurrency'],
  'tts-local-concurrency': ['defaults', 'post', 'tts', 'localConcurrency'],
  'tts-chunk-concurrency': ['defaults', 'post', 'tts', 'chunkConcurrency'],
  'gemini-image':      ['defaults', 'post', 'image', 'geminiImage'],
  'openai-image':      ['defaults', 'post', 'image', 'openaiImage'],
  'grok-image':        ['defaults', 'post', 'image', 'grokImage'],
  'bfl-image':         ['defaults', 'post', 'image', 'bflImage'],
  'replicate-image':   ['defaults', 'post', 'image', 'replicateImage'],
  'lumalabs-image':    ['defaults', 'post', 'image', 'lumalabsImage'],
  'fal-image':         ['defaults', 'post', 'image', 'falImage'],
  'image-aspect-ratio': ['defaults', 'post', 'image', 'imageAspectRatio'],
  'image-size':        ['defaults', 'post', 'image', 'imageSize'],
  'image-quality':     ['defaults', 'post', 'image', 'imageQuality'],
  'image-format':      ['defaults', 'post', 'image', 'imageFormat'],
  'image-background':  ['defaults', 'post', 'image', 'imageBackground'],
  'image-count':       ['defaults', 'post', 'image', 'imageCount'],
  'image-provider-concurrency': ['defaults', 'post', 'image', 'providerConcurrency'],
  'image-local-concurrency': ['defaults', 'post', 'image', 'localConcurrency'],
  'gemini-video':      ['defaults', 'post', 'video', 'geminiVideo'],
  'grok-video':        ['defaults', 'post', 'video', 'grokVideo'],
  'ltx-video':         ['defaults', 'post', 'video', 'ltxVideo'],
  'replicate-video':   ['defaults', 'post', 'video', 'replicateVideo'],
  'lumalabs-video':    ['defaults', 'post', 'video', 'lumalabsVideo'],
  'fal-video':         ['defaults', 'post', 'video', 'falVideo'],
  'video-duration':    ['defaults', 'post', 'video', 'videoDuration'],
  'video-aspect-ratio': ['defaults', 'post', 'video', 'videoAspectRatio'],
  'video-resolution':  ['defaults', 'post', 'video', 'videoResolution'],
  'video-mode':        ['defaults', 'post', 'video', 'videoMode'],
  'video-input-image': ['defaults', 'post', 'video', 'videoInputImage'],
  'video-last-frame':  ['defaults', 'post', 'video', 'videoLastFrame'],
  'video-reference-image': ['defaults', 'post', 'video', 'videoReferenceImages'],
  'video-input-video': ['defaults', 'post', 'video', 'videoInputVideo'],
  'replicate-video-seed': ['defaults', 'post', 'video', 'replicateVideoSeed'],
  'video-generate-audio': ['defaults', 'post', 'video', 'videoGenerateAudio'],
  'video-reference-video': ['defaults', 'post', 'video', 'videoReferenceVideos'],
  'video-reference-audio': ['defaults', 'post', 'video', 'videoReferenceAudios'],
  'replicate-video-negative-prompt': ['defaults', 'post', 'video', 'replicateVideoNegativePrompt'],
  'video-provider-concurrency': ['defaults', 'post', 'video', 'providerConcurrency'],
  'video-local-concurrency': ['defaults', 'post', 'video', 'localConcurrency'],
  'elevenlabs-music':  ['defaults', 'post', 'music', 'elevenlabsMusic'],
  'minimax-music':     ['defaults', 'post', 'music', 'minimaxMusic'],
  'gemini-music':      ['defaults', 'post', 'music', 'geminiMusic'],
  'music-duration':    ['defaults', 'post', 'music', 'musicDuration'],
  'music-instrumental': ['defaults', 'post', 'music', 'musicInstrumental'],
  'music-provider-concurrency': ['defaults', 'post', 'music', 'providerConcurrency'],
  'music-local-concurrency': ['defaults', 'post', 'music', 'localConcurrency'],
  'ocr-language':       ['defaults', 'extract', 'ocr', 'lang'],
  'format':             ['defaults', 'extract', 'ocr', 'out'],
  'ocr-dpi':            ['defaults', 'extract', 'ocr', 'dpi'],
  'ocr-concurrency':   ['defaults', 'extract', 'ocr', 'pageConcurrency'],
  'ocr-provider-concurrency': ['defaults', 'extract', 'ocr', 'providerConcurrency'],
  'ocr-local-concurrency': ['defaults', 'extract', 'ocr', 'localConcurrency'],
  'ocr-provider-mode':  ['defaults', 'extract', 'ocr', 'providerMode'],
  'chapters':          ['defaults', 'extract', 'ocr', 'chapters'],
  'length':            ['defaults', 'extract', 'ocr', 'length'],
  'pdf-chapter-mode':  ['defaults', 'extract', 'ocr', 'pdfChapterMode'],
  'batch-limit':       ['defaults', 'batch', 'limit'],
  'batch-order':       ['defaults', 'batch', 'order'],
  'batch-concurrency': ['defaults', 'batch', 'concurrency'],
  'max-cents':         ['pricing', 'maxCents'],
  cookies:             ['auth', 'cookies'],
  'cookies-from-browser': ['auth', 'cookiesFromBrowser'],
}

// Per-run inputs that are never persisted. `buildConfigPatchFromFlags` skips these
// before the FLAG_TO_CONFIG_PATH lookup, which is also what keeps them out of the
// "no config destination" warning. An entry here must therefore not also have a
// config destination — pinned by explicit-runtime-exclusions.test.ts.
export const RUNTIME_ONLY_FLAGS = new Set([
  'price',
  'allow-over-budget',
  'show',
  'reset',
  'config-path',
  'password',
  'mistral-tts-ref-audio'
])

const setNestedValue = (obj: Record<string, unknown>, path: string[], value: unknown): void => {
  let current = obj
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i] as string
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }
  const lastKey = path[path.length - 1] as string
  current[lastKey] = value
}

const readConfigFlagValue = (
  flags: Record<string, unknown>,
  flagName: string
): unknown => {
  return flags[flagName]
}

const parseConfigValue = (flagName: string, rawValue: unknown): unknown => {
  if ((flagName === 'minimax-tts-pronunciation' || flagName === 'elevenlabs-tts-pronunciation-dictionary-locator') && typeof rawValue === 'string') {
    return [rawValue]
  }
  if (typeof rawValue !== 'string') return rawValue
  const numericFlags = new Set([
    'speaker-count', 'stt-reverb-verbatimicity', 'image-count', 'video-duration',
    'music-duration', 'ocr-dpi', 'length', 'batch-limit', 'batch-concurrency',
    'max-cents',
    'provider-concurrency', 'local-concurrency',
    'llm-provider-concurrency', 'llm-local-concurrency',
    'stt-provider-concurrency', 'stt-local-concurrency', 'stt-segment-concurrency', 'stt-preflight-concurrency',
    'ocr-concurrency', 'ocr-provider-concurrency', 'ocr-local-concurrency',
    'tts-provider-concurrency', 'tts-local-concurrency', 'tts-chunk-concurrency',
    'image-provider-concurrency', 'image-local-concurrency',
    'video-provider-concurrency', 'video-local-concurrency',
    'music-provider-concurrency', 'music-local-concurrency',
    'openai-tts-speed', 'minimax-tts-speed', 'minimax-tts-volume', 'minimax-tts-pitch',
    'deepgram-tts-speed',
    'elevenlabs-tts-stability', 'elevenlabs-tts-similarity-boost', 'elevenlabs-tts-style',
    'elevenlabs-tts-speed', 'elevenlabs-tts-seed',
    'replicate-video-seed'
  ])
  if (numericFlags.has(flagName)) {
    const n = Number(rawValue)
    return Number.isFinite(n) ? n : rawValue
  }
  return rawValue
}

const resolveConfigFlagValue = (flagName: string, rawValue: unknown): unknown => {
  if (rawValue === true || rawValue === '') {
    const cheapestModel = resolveCheapestModelForFlag(flagName)
    if (cheapestModel !== undefined) {
      return cheapestModel
    }
  }

  return parseConfigValue(flagName, rawValue)
}

export const buildConfigPatchFromFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[] = []
): Record<string, unknown> => {
  const patch: Record<string, unknown> = {}
  const rawOccurrences = collectRepeatableModelFlagOccurrences(flagOccurrences)
  const discardedFlags: string[] = []

  for (const flagName of explicitFlags) {
    if (RUNTIME_ONLY_FLAGS.has(flagName)) continue
    const configPath = FLAG_TO_CONFIG_PATH[flagName]
    // A flag with no destination used to be dropped in silence, so `config
    // --image-mask x` reported success and wrote nothing. Say so instead.
    if (!configPath) {
      if (!MULTI_DESTINATION_FLAGS.has(flagName)) discardedFlags.push(flagName)
      continue
    }
    let value: unknown

    if (REPEATABLE_CONFIG_MODEL_FLAG_SET.has(flagName)) {
      value = normalizeModelFlagOccurrences(flagName as RepeatableModelFlag, flags, rawOccurrences)
      if (!Array.isArray(value) || value.length === 0) {
        continue
      }
    } else {
      const rawValue = readConfigFlagValue(flags, flagName)
      if (rawValue === undefined) continue
      value = resolveConfigFlagValue(flagName, rawValue)
    }

    setNestedValue(patch, configPath, value)
  }

  if (discardedFlags.length > 0) {
    l.warn(
      `These flags have no config destination and were not saved: ${discardedFlags.sort().map(flag => `--${flag}`).join(', ')}. `
      + 'Pass them on the command that uses them instead.'
    )
  }

  if (explicitFlags.has('provider-concurrency')) {
    const value = resolveConfigFlagValue('provider-concurrency', flags['provider-concurrency'])
    for (const path of [
      ['defaults', 'extract', 'stt', 'providerConcurrency'],
      ['defaults', 'extract', 'ocr', 'providerConcurrency'],
      ['defaults', 'llm', 'providerConcurrency'],
      ['defaults', 'post', 'tts', 'providerConcurrency'],
      ['defaults', 'post', 'image', 'providerConcurrency'],
      ['defaults', 'post', 'video', 'providerConcurrency'],
      ['defaults', 'post', 'music', 'providerConcurrency']
    ]) {
      setNestedValue(patch, path, value)
    }
  }

  if (explicitFlags.has('local-concurrency')) {
    const value = resolveConfigFlagValue('local-concurrency', flags['local-concurrency'])
    for (const path of [
      ['defaults', 'extract', 'stt', 'localConcurrency'],
      ['defaults', 'extract', 'ocr', 'localConcurrency'],
      ['defaults', 'llm', 'localConcurrency'],
      ['defaults', 'post', 'tts', 'localConcurrency'],
      ['defaults', 'post', 'image', 'localConcurrency'],
      ['defaults', 'post', 'video', 'localConcurrency'],
      ['defaults', 'post', 'music', 'localConcurrency']
    ]) {
      setNestedValue(patch, path, value)
    }
  }

  if (explicitFlags.has('prompt') && !RUNTIME_ONLY_FLAGS.has('prompt')) {
    const promptVal = flags['prompt']
    if (Array.isArray(promptVal)) {
      setNestedValue(patch, ['defaults', 'prompts'], promptVal)
    } else if (typeof promptVal === 'string' && promptVal.length > 0) {
      setNestedValue(patch, ['defaults', 'prompts'], [promptVal])
    }
  }

  return patch
}

export const deepMergeConfig = (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) &&
        typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
      result[key] = deepMergeConfig(result[key] as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}
