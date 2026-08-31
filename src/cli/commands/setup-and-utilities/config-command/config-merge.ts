import type { AutoshowConfig, CliFlagOccurrence, RepeatableModelFlag } from '~/types'
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
const MULTI_DESTINATION_FLAGS = new Set(['provider-concurrency', 'local-concurrency', 'prompt'])
const STEP2_PROVIDER_CONFIG_PATHS = Object.fromEntries(
  getStep2ProviderConfigPathEntries().map(({ flagName, configPath }) => [flagName, [...configPath]])
) as Record<string, string[]>

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

export type ConfigInjectionScope =
  | 'write'
  | 'extract'
  | 'download'
  | 'metadata'
  | 'tts'
  | 'image'
  | 'video'
  | 'music'
  | 'resume'
  | 'config'
  | 'all'

const SCOPE_PATH_PREFIXES: Record<ConfigInjectionScope, readonly (readonly string[])[]> = {
  write: [
    ['defaults', 'llm'],
    ['defaults', 'batch'],
    ['defaults', 'prompts'],
    ['defaults', 'concurrency'],
    ['pricing'],
    ['auth']
  ],
  extract: [
    ['defaults', 'extract'],
    ['defaults', 'batch'],
    ['defaults', 'concurrency'],
    ['pricing'],
    ['auth']
  ],
  download: [
    ['defaults', 'extract'],
    ['defaults', 'batch'],
    ['defaults', 'concurrency'],
    ['pricing'],
    ['auth']
  ],
  metadata: [
    ['defaults', 'extract'],
    ['defaults', 'batch'],
    ['defaults', 'concurrency'],
    ['pricing'],
    ['auth']
  ],
  tts: [
    ['defaults', 'tts'],
    ['defaults', 'batch'],
    ['defaults', 'concurrency'],
    ['pricing'],
    ['auth']
  ],
  image: [
    ['defaults', 'image'],
    ['defaults', 'batch'],
    ['defaults', 'concurrency'],
    ['pricing'],
    ['auth']
  ],
  video: [
    ['defaults', 'video'],
    ['defaults', 'batch'],
    ['defaults', 'concurrency'],
    ['pricing'],
    ['auth']
  ],
  music: [
    ['defaults', 'music'],
    ['defaults', 'batch'],
    ['defaults', 'concurrency'],
    ['pricing'],
    ['auth']
  ],
  resume: [],
  config: [],
  all: []
}

const pathMatchesScope = (path: readonly string[], scope: ConfigInjectionScope): boolean => {
  const prefixes = SCOPE_PATH_PREFIXES[scope]
  if (prefixes.length === 0) return true
  return prefixes.some((prefix) => prefix.every((segment, index) => path[index] === segment))
}

export const mergeConfigIntoRawFlags = (
  rawFlags: Record<string, unknown>,
  config: AutoshowConfig,
  explicitFlags: Set<string>,
  scope: ConfigInjectionScope = 'all'
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...rawFlags }
  const injectedFlags = new Set<string>()
  const d = config.defaults
  if (!d) return merged

  const configRecord = config as unknown as Record<string, unknown>

  const inject = (flagName: string, path: readonly string[]): void => {
    if (!pathMatchesScope(path, scope)) return
    const value = readNestedValue(configRecord, path)
    if (value === undefined) return
    if (explicitFlags.has(flagName)) return
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

  const scopedPaths = SCOPED_FLAG_TO_CONFIG_PATHS[scope] ?? {}
  for (const [flagName, path] of Object.entries({ ...FLAG_TO_CONFIG_PATH, ...scopedPaths })) {
    if (GROUP_INJECTED_FLAGS.has(flagName) || path[0] !== 'defaults') continue
    inject(flagName, path)
  }

  if (
    pathMatchesScope(['defaults', 'prompts'], scope)
    && d.prompts
    && d.prompts.length > 0
    && !explicitFlags.has('prompt')
  ) {
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
  'elevenlabs-tts':    ['defaults', 'tts', 'elevenlabsTts'],
  'minimax-tts':       ['defaults', 'tts', 'minimaxTts'],
  'grok-tts':          ['defaults', 'tts', 'grokTts'],
  'mistral-tts':       ['defaults', 'tts', 'mistralTts'],
  'openai-tts':        ['defaults', 'tts', 'openaiTts'],
  'speechify-tts':     ['defaults', 'tts', 'speechifyTts'],
  'hume-tts':          ['defaults', 'tts', 'humeTts'],
  'cartesia-tts':      ['defaults', 'tts', 'cartesiaTts'],
  'fish-tts':          ['defaults', 'tts', 'fishTts'],
  'inworld-tts':       ['defaults', 'tts', 'inworldTts'],
  'deepinfra-tts':     ['defaults', 'tts', 'deepinfraTts'],
  'tts-voice':         ['defaults', 'tts', 'voice'],
  'tts-speed':         ['defaults', 'tts', 'speed'],
  'tts-language':      ['defaults', 'tts', 'language'],
  'tts-text-normalization': ['defaults', 'tts', 'textNormalization'],
  'tts-instructions':  ['defaults', 'tts', 'instructions'],
  'tts-dialogue-format': ['defaults', 'tts', 'ttsDialogueFormat'],
  'tts-speaker': ['defaults', 'tts', 'ttsSpeakers'],
  'elevenlabs-tts-stability': ['defaults', 'tts', 'elevenlabsTtsStability'],
  'elevenlabs-tts-similarity-boost': ['defaults', 'tts', 'elevenlabsTtsSimilarityBoost'],
  'elevenlabs-tts-style': ['defaults', 'tts', 'elevenlabsTtsStyle'],
  'elevenlabs-tts-use-speaker-boost': ['defaults', 'tts', 'elevenlabsTtsUseSpeakerBoost'],
  'elevenlabs-tts-seed': ['defaults', 'tts', 'elevenlabsTtsSeed'],
  'elevenlabs-tts-pronunciation-dictionary-locator': ['defaults', 'tts', 'elevenlabsTtsPronunciationDictionaryLocators'],
  'minimax-tts-volume': ['defaults', 'tts', 'minimaxTtsVolume'],
  'minimax-tts-pitch': ['defaults', 'tts', 'minimaxTtsPitch'],
  'minimax-tts-emotion': ['defaults', 'tts', 'minimaxTtsEmotion'],
  'minimax-tts-pronunciation': ['defaults', 'tts', 'minimaxTtsPronunciations'],
  'tts-provider-concurrency': ['defaults', 'tts', 'providerConcurrency'],
  'tts-chunk-concurrency': ['defaults', 'tts', 'chunkConcurrency'],
  'gemini-image':      ['defaults', 'image', 'geminiImage'],
  'openai-image':      ['defaults', 'image', 'openaiImage'],
  'grok-image':        ['defaults', 'image', 'grokImage'],
  'bfl-image':         ['defaults', 'image', 'bflImage'],
  'replicate-image':   ['defaults', 'image', 'replicateImage'],
  'lumalabs-image':    ['defaults', 'image', 'lumalabsImage'],
  'fal-image':         ['defaults', 'image', 'falImage'],
  'image-provider-concurrency': ['defaults', 'image', 'providerConcurrency'],
  'gemini-video':      ['defaults', 'video', 'geminiVideo'],
  'grok-video':        ['defaults', 'video', 'grokVideo'],
  'ltx-video':         ['defaults', 'video', 'ltxVideo'],
  'replicate-video':   ['defaults', 'video', 'replicateVideo'],
  'lumalabs-video':    ['defaults', 'video', 'lumalabsVideo'],
  'fal-video':         ['defaults', 'video', 'falVideo'],
  'replicate-video-seed': ['defaults', 'video', 'replicateVideoSeed'],
  'replicate-video-negative-prompt': ['defaults', 'video', 'replicateVideoNegativePrompt'],
  'video-provider-concurrency': ['defaults', 'video', 'providerConcurrency'],
  'elevenlabs-music':  ['defaults', 'music', 'elevenlabsMusic'],
  'minimax-music':     ['defaults', 'music', 'minimaxMusic'],
  'gemini-music':      ['defaults', 'music', 'geminiMusic'],
  'music-provider-concurrency': ['defaults', 'music', 'providerConcurrency'],
  'ocr-language':       ['defaults', 'extract', 'ocr', 'ocrLanguage'],
  'format':             ['defaults', 'extract', 'ocr', 'format'],
  'ocr-dpi':            ['defaults', 'extract', 'ocr', 'dpi'],
  'ocr-concurrency':   ['defaults', 'extract', 'ocr', 'ocrConcurrency'],
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

const SCOPED_FLAG_TO_CONFIG_PATHS: Partial<Record<ConfigInjectionScope, Record<string, string[]>>> = {
  image: {
    'aspect-ratio': ['defaults', 'image', 'aspectRatio'],
    size: ['defaults', 'image', 'size'],
    quality: ['defaults', 'image', 'quality'],
    format: ['defaults', 'image', 'format'],
    background: ['defaults', 'image', 'background'],
    count: ['defaults', 'image', 'count']
  },
  video: {
    duration: ['defaults', 'video', 'duration'],
    'aspect-ratio': ['defaults', 'video', 'aspectRatio'],
    resolution: ['defaults', 'video', 'resolution'],
    mode: ['defaults', 'video', 'mode'],
    'input-image': ['defaults', 'video', 'inputImage'],
    'last-frame': ['defaults', 'video', 'lastFrame'],
    'reference-image': ['defaults', 'video', 'referenceImages'],
    'input-video': ['defaults', 'video', 'inputVideo'],
    'generate-audio': ['defaults', 'video', 'generateAudio'],
    'reference-video': ['defaults', 'video', 'referenceVideos'],
    'reference-audio': ['defaults', 'video', 'referenceAudios']
  },
  music: {
    duration: ['defaults', 'music', 'duration'],
    instrumental: ['defaults', 'music', 'instrumental']
  }
}

export const RUNTIME_ONLY_FLAGS = new Set([
  'price',
  'allow-over-budget',
  'show',
  'reset',
  'config-path',
  'password',
  'tts-ref-audio'
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
    'speaker-count', 'ocr-dpi', 'length', 'batch-limit', 'batch-concurrency',
    'max-cents',
    'provider-concurrency', 'local-concurrency',
    'llm-provider-concurrency', 'llm-local-concurrency',
    'stt-provider-concurrency', 'stt-local-concurrency', 'stt-segment-concurrency', 'stt-preflight-concurrency',
    'ocr-concurrency', 'ocr-provider-concurrency', 'ocr-local-concurrency',
    'tts-provider-concurrency', 'tts-chunk-concurrency',
    'image-provider-concurrency',
    'video-provider-concurrency',
    'music-provider-concurrency',
    'tts-speed', 'minimax-tts-volume', 'minimax-tts-pitch',
    'elevenlabs-tts-stability', 'elevenlabs-tts-similarity-boost', 'elevenlabs-tts-style',
    'elevenlabs-tts-seed',
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
      + 'Pass them on the command that uses them instead.',
      { category: 'command', metadata: { discardedFlags: [...discardedFlags].sort() } }
    )
  }

  if (explicitFlags.has('provider-concurrency')) {
    const value = resolveConfigFlagValue('provider-concurrency', flags['provider-concurrency'])
    for (const path of [
      ['defaults', 'extract', 'stt', 'providerConcurrency'],
      ['defaults', 'extract', 'ocr', 'providerConcurrency'],
      ['defaults', 'llm', 'providerConcurrency'],
      ['defaults', 'tts', 'providerConcurrency'],
      ['defaults', 'image', 'providerConcurrency'],
      ['defaults', 'video', 'providerConcurrency'],
      ['defaults', 'music', 'providerConcurrency']
    ]) {
      setNestedValue(patch, path, value)
    }
  }

  if (explicitFlags.has('local-concurrency')) {
    const value = resolveConfigFlagValue('local-concurrency', flags['local-concurrency'])
    for (const path of [
      ['defaults', 'extract', 'stt', 'localConcurrency'],
      ['defaults', 'extract', 'ocr', 'localConcurrency']
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
