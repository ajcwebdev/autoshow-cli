import type {
  ControlSpec,
  ProviderControlSpecs,
  TtsEffectiveInvocationControlsFor,
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
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { UsageError } from '~/utils/error-handler'

const trim = (value: string): string => value.trim()

const CONTROL_SPECS = {
  openai: {
    instructions: { kind: 'string', preserveWhitespace: true },
    speed: { kind: 'number', min: 0.25, max: 4 },
  },
  elevenlabs: {
    languageCode: { kind: 'string', normalize: trim },
    stability: { kind: 'number', min: 0, max: 1 },
    similarityBoost: { kind: 'number', min: 0, max: 1 },
    style: { kind: 'number', min: 0, max: 1 },
    useSpeakerBoost: { kind: 'boolean' },
    speed: { kind: 'number', min: 0.7, max: 1.2 },
    seed: { kind: 'number', min: 0, max: 4_294_967_295, integer: true },
    textNormalization: { kind: 'string', normalize: validateElevenLabsTtsTextNormalization },
    pronunciationDictionaryLocators: { kind: 'string-array' },
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
  grok: {
    language: { kind: 'string', normalize: validateGrokTtsLanguage },
    textNormalization: { kind: 'boolean' },
  },
  mistral: {
    responseFormat: { kind: 'string', normalize: value => value.trim().toLowerCase(), allowedValues: ['wav', 'mp3', 'flac', 'opus'] },
  },
  speechify: {
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
} as const satisfies Record<TtsProvider, ProviderControlSpecs>

const PROVIDERS = new Set<TtsProvider>(Object.keys(CONTROL_SPECS) as TtsProvider[])
const CANONICAL_TURN_ID_RE = /^dialogue-turn-\d{3,}(?:-\d{2,})?$/

const invalidControl = (provider: TtsProvider, key: string, detail: string): Error =>
  UsageError(`Invalid per-turn ${provider} TTS control ${key}: ${detail}.`)

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
      throw UsageError(
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
    throw UsageError(`Per-turn TTS controls require a canonical dialogue turn ID; received ${sourceId}.`)
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
      throw UsageError(`Per-turn TTS controls require canonical dialogue-turn-NNN or dialogue-turn-NNN-NN keys; received ${sourceId}.`)
    }
    if (expected && !expected.has(sourceId)) {
      throw UsageError(`Per-turn TTS controls reference unknown dialogue turn ${sourceId}.`)
    }
    const rawProviderControls = controlsByTurn[sourceId]
    if (!rawProviderControls || typeof rawProviderControls !== 'object' || Array.isArray(rawProviderControls)) {
      throw UsageError(`Per-turn TTS controls for ${sourceId} must be a provider-keyed object.`)
    }
    const normalizedProviders: Partial<Record<TtsProvider, TtsTargetInvocationControls>> = {}
    for (const rawProvider of Object.keys(rawProviderControls).sort()) {
      if (!PROVIDERS.has(rawProvider as TtsProvider)) {
        throw UsageError(`Per-turn TTS controls for ${sourceId} use unknown provider ${rawProvider}.`)
      }
      const provider = rawProvider as TtsProvider
      const rawControls = rawProviderControls[provider]
      if (!rawControls || typeof rawControls !== 'object' || Array.isArray(rawControls)) {
        throw UsageError(`Per-turn ${provider} TTS controls for ${sourceId} must be an object.`)
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
