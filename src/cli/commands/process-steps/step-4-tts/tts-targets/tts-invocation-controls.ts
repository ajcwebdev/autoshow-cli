import type {
  TtsProvider,
  TtsTargetInvocation,
  TtsTargetInvocationControls,
  TtsTargetInvocationControlValue,
  TtsTurnControls,
} from '~/types'
import {
  validateElevenLabsTtsTextNormalization,
  validateGrokTtsLanguage,
  validateMinimaxTtsEmotion,
  validateMinimaxTtsLanguageBoost,
  validateSpeechifyTtsAudioFormat,
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { CLIUsageError } from '~/utils/error-handler'

type OptionalControl<T> = T | null | undefined

export type TtsInvocationControlsByProvider = {
  kitten: Readonly<{ maxChunkChars?: OptionalControl<number> }>
  openai: Readonly<{
    instructions?: OptionalControl<string>
    speed?: OptionalControl<number>
  }>
  elevenlabs: Readonly<{
    outputFormat?: OptionalControl<string>
    languageCode?: OptionalControl<string>
    stability?: OptionalControl<number>
    similarityBoost?: OptionalControl<number>
    style?: OptionalControl<number>
    useSpeakerBoost?: OptionalControl<boolean>
    speed?: OptionalControl<number>
    seed?: OptionalControl<number>
    textNormalization?: OptionalControl<string>
    pronunciationDictionaryLocators?: OptionalControl<readonly string[]>
    optimizeStreamingLatency?: OptionalControl<number>
  }>
  minimax: Readonly<{
    languageBoost?: OptionalControl<string>
    speed?: OptionalControl<number>
    volume?: OptionalControl<number>
    pitch?: OptionalControl<number>
    emotion?: OptionalControl<string>
    englishNormalization?: OptionalControl<boolean>
    pronunciations?: OptionalControl<readonly string[]>
  }>
  groq: Readonly<{ speed?: OptionalControl<number> }>
  grok: Readonly<{
    language?: OptionalControl<string>
    textNormalization?: OptionalControl<boolean>
  }>
  mistral: Readonly<{ responseFormat?: OptionalControl<'wav' | 'mp3' | 'flac' | 'opus'> }>
  gemini: Readonly<{ languageCode?: OptionalControl<string> }>
  deepgram: Readonly<{
    encoding?: OptionalControl<string>
    container?: OptionalControl<string>
    bitRate?: OptionalControl<number>
    sampleRate?: OptionalControl<number>
    speed?: OptionalControl<number>
  }>
  speechify: Readonly<{
    audioFormat?: OptionalControl<string>
    language?: OptionalControl<string>
  }>
  hume: Readonly<{
    speed?: OptionalControl<number>
    trailingSilence?: OptionalControl<number>
    description?: OptionalControl<string>
  }>
  cartesia: Readonly<{ language?: OptionalControl<string> }>
  fish: Readonly<{ latency?: OptionalControl<string> }>
  inworld: Readonly<{ steeringPrompt?: OptionalControl<string> }>
  deepinfra: Readonly<{ promptInstructions?: OptionalControl<string> }>
  replicate: Readonly<{ speed?: OptionalControl<number> }>
}

export type TtsInvocationControlsFor<P extends TtsProvider> = TtsInvocationControlsByProvider[P]
export type TtsEffectiveInvocationControlsFor<P extends TtsProvider> = Readonly<{
  [K in keyof TtsInvocationControlsFor<P>]?: Exclude<TtsInvocationControlsFor<P>[K], null | undefined> | undefined
}>

type StringControlSpec = Readonly<{
  kind: 'string'
  normalize?: ((value: string) => string) | undefined
  preserveWhitespace?: boolean | undefined
  allowedValues?: readonly string[] | undefined
}>

type NumberControlSpec = Readonly<{
  kind: 'number'
  min?: number | undefined
  max?: number | undefined
  exclusiveMin?: boolean | undefined
  integer?: boolean | undefined
}>

type ControlSpec = StringControlSpec
  | NumberControlSpec
  | Readonly<{ kind: 'boolean' }>
  | Readonly<{ kind: 'string-array' }>

type ProviderControlSpecs = Readonly<Record<string, ControlSpec>>

const GEMINI_TTS_LANGUAGE_CODES = [
  'de-DE', 'en-AU', 'en-GB', 'en-IN', 'en-US', 'es-US', 'fr-FR', 'hi-IN',
  'pt-BR', 'ar-XA', 'es-ES', 'fr-CA', 'id-ID', 'it-IT', 'ja-JP', 'tr-TR',
  'vi-VN', 'bn-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'ta-IN', 'te-IN',
  'nl-NL', 'ko-KR', 'cmn-CN', 'pl-PL', 'ru-RU', 'th-TH',
] as const

const trim = (value: string): string => value.trim()

const CONTROL_SPECS = {
  kitten: {
    maxChunkChars: { kind: 'number', min: 1, max: 1_000_000, integer: true },
  },
  openai: {
    instructions: { kind: 'string', preserveWhitespace: true },
    speed: { kind: 'number', min: 0.25, max: 4 },
  },
  elevenlabs: {
    outputFormat: { kind: 'string', normalize: trim },
    languageCode: { kind: 'string', normalize: trim },
    stability: { kind: 'number', min: 0, max: 1 },
    similarityBoost: { kind: 'number', min: 0, max: 1 },
    style: { kind: 'number', min: 0, max: 1 },
    useSpeakerBoost: { kind: 'boolean' },
    speed: { kind: 'number', min: 0.7, max: 1.2 },
    seed: { kind: 'number', min: 0, max: 4_294_967_295, integer: true },
    textNormalization: { kind: 'string', normalize: validateElevenLabsTtsTextNormalization },
    pronunciationDictionaryLocators: { kind: 'string-array' },
    optimizeStreamingLatency: { kind: 'number', min: 0, max: 4, integer: true },
  },
  minimax: {
    languageBoost: { kind: 'string', normalize: validateMinimaxTtsLanguageBoost },
    speed: { kind: 'number', min: 0.5, max: 2 },
    volume: { kind: 'number', min: 0, max: 10, exclusiveMin: true },
    pitch: { kind: 'number', min: -12, max: 12, integer: true },
    emotion: { kind: 'string', normalize: validateMinimaxTtsEmotion },
    englishNormalization: { kind: 'boolean' },
    pronunciations: { kind: 'string-array' },
  },
  groq: {
    speed: { kind: 'number', min: 0.5, max: 5 },
  },
  grok: {
    language: { kind: 'string', normalize: validateGrokTtsLanguage },
    textNormalization: { kind: 'boolean' },
  },
  mistral: {
    responseFormat: { kind: 'string', normalize: value => value.trim().toLowerCase(), allowedValues: ['wav', 'mp3', 'flac', 'opus'] },
  },
  gemini: {
    languageCode: { kind: 'string', normalize: trim, allowedValues: GEMINI_TTS_LANGUAGE_CODES },
  },
  deepgram: {
    encoding: { kind: 'string', normalize: trim },
    container: { kind: 'string', normalize: trim },
    bitRate: { kind: 'number', min: 1, max: 1_000_000, integer: true },
    sampleRate: { kind: 'number', min: 1, max: 192_000, integer: true },
    speed: { kind: 'number', min: 0.5, max: 2 },
  },
  speechify: {
    audioFormat: { kind: 'string', normalize: validateSpeechifyTtsAudioFormat },
    language: { kind: 'string', normalize: trim },
  },
  hume: {
    speed: { kind: 'number', min: 0, max: 4, exclusiveMin: true },
    trailingSilence: { kind: 'number', min: 0, max: 60 },
    description: { kind: 'string', normalize: trim },
  },
  cartesia: {
    language: { kind: 'string', normalize: trim },
  },
  fish: {
    latency: { kind: 'string', normalize: trim },
  },
  inworld: {
    steeringPrompt: { kind: 'string', normalize: trim },
  },
  deepinfra: {
    promptInstructions: { kind: 'string', normalize: trim },
  },
  replicate: {
    speed: { kind: 'number', min: 0.1, max: 5 },
  },
} as const satisfies Record<TtsProvider, ProviderControlSpecs>

const PROVIDERS = new Set<TtsProvider>(Object.keys(CONTROL_SPECS) as TtsProvider[])
const CANONICAL_TURN_ID_RE = /^dialogue-turn-\d{3,}(?:-\d{2,})?$/

const invalidControl = (provider: TtsProvider, key: string, detail: string): Error =>
  CLIUsageError(`Invalid per-turn ${provider} TTS control ${key}: ${detail}.`)

const normalizeControlValue = (
  provider: TtsProvider,
  key: string,
  value: TtsTargetInvocationControlValue,
  spec: ControlSpec
): Exclude<TtsTargetInvocationControlValue, null> => {
  if (spec.kind === 'string') {
    if (typeof value !== 'string') throw invalidControl(provider, key, 'expected a string or null')
    const normalized = spec.normalize?.(value) ?? value
    if ((spec.preserveWhitespace ? normalized.trim() : normalized).length === 0) {
      throw invalidControl(provider, key, 'expected a non-empty string or null')
    }
    if (spec.allowedValues && !spec.allowedValues.includes(normalized)) {
      throw invalidControl(provider, key, `allowed values are ${spec.allowedValues.join(', ')}`)
    }
    return normalized
  }

  if (spec.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw invalidControl(provider, key, 'expected a finite number or null')
    }
    if (spec.integer && !Number.isInteger(value)) {
      throw invalidControl(provider, key, 'expected an integer')
    }
    if (spec.min !== undefined && (spec.exclusiveMin ? value <= spec.min : value < spec.min)) {
      throw invalidControl(provider, key, `must be ${spec.exclusiveMin ? 'greater than' : 'at least'} ${spec.min}`)
    }
    if (spec.max !== undefined && value > spec.max) {
      throw invalidControl(provider, key, `must be at most ${spec.max}`)
    }
    return Object.is(value, -0) ? 0 : value
  }

  if (spec.kind === 'boolean') {
    if (typeof value !== 'boolean') throw invalidControl(provider, key, 'expected a boolean or null')
    return value
  }

  if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string')) {
    throw invalidControl(provider, key, 'expected an array of strings or null')
  }
  const normalized = value.map(entry => entry.trim()).filter(Boolean)
  if (normalized.length !== value.length) {
    throw invalidControl(provider, key, 'array entries must be non-empty strings')
  }
  return Object.freeze(normalized)
}

const normalizeProviderControls = (
  provider: TtsProvider,
  controls: Readonly<Record<string, unknown>>,
  allowNull: boolean
): TtsTargetInvocationControls => {
  const specs = CONTROL_SPECS[provider] as ProviderControlSpecs
  const normalized: Record<string, TtsTargetInvocationControlValue> = {}
  for (const key of Object.keys(controls).sort()) {
    const spec = specs[key]
    if (!spec) {
      throw CLIUsageError(
        `Provider ${provider} does not support per-turn TTS invocation control ${key}. Allowed controls: ${Object.keys(specs).sort().join(', ')}.`
      )
    }
    const value = controls[key]
    if (value === null) {
      if (!allowNull) throw invalidControl(provider, key, 'null is allowed only in invocation overrides')
      normalized[key] = null
      continue
    }
    if (value === undefined) {
      if (allowNull) throw invalidControl(provider, key, 'omit undefined controls')
      continue
    }
    normalized[key] = normalizeControlValue(provider, key, value as TtsTargetInvocationControlValue, spec)
  }
  return Object.freeze(normalized)
}

export const resolveTtsTurnControlOverrides = (
  provider: TtsProvider,
  sourceId: string,
  controlsByTurn: TtsTurnControls | undefined
): TtsTargetInvocationControls => {
  if (!CANONICAL_TURN_ID_RE.test(sourceId)) {
    throw CLIUsageError(`Per-turn TTS controls require a canonical dialogue turn ID; received ${sourceId}.`)
  }
  const providerControls = controlsByTurn?.[sourceId]?.[provider]
  return providerControls
    ? normalizeProviderControls(provider, providerControls, true)
    : Object.freeze({})
}

export const normalizeTtsTurnControls = (
  controlsByTurn: TtsTurnControls | undefined,
  expectedTurnIds?: readonly string[] | undefined
): TtsTurnControls | undefined => {
  if (!controlsByTurn) return undefined
  const expected = expectedTurnIds ? new Set(expectedTurnIds) : undefined
  const normalizedByTurn: Record<string, Readonly<Partial<Record<TtsProvider, TtsTargetInvocationControls>>>> = {}

  for (const sourceId of Object.keys(controlsByTurn).sort()) {
    if (!CANONICAL_TURN_ID_RE.test(sourceId)) {
      throw CLIUsageError(`Per-turn TTS controls require canonical dialogue-turn-NNN or dialogue-turn-NNN-NN keys; received ${sourceId}.`)
    }
    if (expected && !expected.has(sourceId)) {
      throw CLIUsageError(`Per-turn TTS controls reference unknown dialogue turn ${sourceId}.`)
    }
    const rawProviderControls = controlsByTurn[sourceId]
    if (!rawProviderControls || typeof rawProviderControls !== 'object' || Array.isArray(rawProviderControls)) {
      throw CLIUsageError(`Per-turn TTS controls for ${sourceId} must be a provider-keyed object.`)
    }
    const normalizedProviders: Partial<Record<TtsProvider, TtsTargetInvocationControls>> = {}
    for (const rawProvider of Object.keys(rawProviderControls).sort()) {
      if (!PROVIDERS.has(rawProvider as TtsProvider)) {
        throw CLIUsageError(`Per-turn TTS controls for ${sourceId} use unknown provider ${rawProvider}.`)
      }
      const provider = rawProvider as TtsProvider
      const rawControls = rawProviderControls[provider]
      if (!rawControls || typeof rawControls !== 'object' || Array.isArray(rawControls)) {
        throw CLIUsageError(`Per-turn ${provider} TTS controls for ${sourceId} must be an object.`)
      }
      normalizedProviders[provider] = normalizeProviderControls(provider, rawControls, true)
    }
    normalizedByTurn[sourceId] = Object.freeze(normalizedProviders)
  }

  return Object.freeze(normalizedByTurn)
}

export const resolveTtsTargetInvocationControls = <P extends TtsProvider>(
  provider: P,
  invocation: TtsTargetInvocation | undefined,
  defaults: TtsEffectiveInvocationControlsFor<P>
): TtsEffectiveInvocationControlsFor<P> => {
  const normalizedDefaults = normalizeProviderControls(provider, defaults as Readonly<Record<string, unknown>>, false)
  const normalizedOverrides = normalizeProviderControls(provider, invocation?.controls ?? {}, true)
  const effective: Record<string, Exclude<TtsTargetInvocationControlValue, null>> = {}

  for (const [key, value] of Object.entries(normalizedDefaults)) {
    if (value !== null) effective[key] = value
  }
  for (const [key, value] of Object.entries(normalizedOverrides)) {
    if (value === null) delete effective[key]
    else effective[key] = value
  }

  return Object.freeze(effective) as TtsEffectiveInvocationControlsFor<P>
}
