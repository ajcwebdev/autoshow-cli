import { InternalError } from '~/utils/error-handler'
import { CONTROL_SPECS } from '~/cli/commands/audio/tts/tts-targets/tts-invocation-controls'
import type { ControlSpec, TtsInvocationControlsByProvider, TtsProvider } from '~/types'
import type { GenericOptionControl } from './generic-provider-option-selectors'

// Each generic TTS flag names, per provider, the capability control in CONTROL_SPECS that backs it.
// The key type is `keyof TtsInvocationControlsByProvider[P]`, so naming a control a provider does
// not define is a type error rather than a silent no-op.
export type GenericTtsControlMap = {
  [Flag in string]: Partial<{ [P in TtsProvider]: keyof TtsInvocationControlsByProvider[P] & string }>
}

export const GENERIC_TTS_CONTROL_MAP = {
  'tts-speed': { openai: 'speed', elevenlabs: 'speed', grok: 'speed', hume: 'speed', cartesia: 'speed', inworld: 'speed' },
  'tts-language': { grok: 'language', speechify: 'language', cartesia: 'language', elevenlabs: 'languageCode' },
  'tts-text-normalization': { grok: 'textNormalization', elevenlabs: 'textNormalization' },
  'tts-instructions': { openai: 'instructions', inworld: 'steeringPrompt', hume: 'description' },
  'tts-stability': { elevenlabs: 'stability' },
  'tts-similarity': { elevenlabs: 'similarityBoost' },
  'tts-style': { elevenlabs: 'style' },
  'tts-speaker-boost': { elevenlabs: 'useSpeakerBoost' },
  'tts-seed': { elevenlabs: 'seed' },
  'tts-pronunciation-dictionary': { elevenlabs: 'pronunciationDictionaryLocators' },
  'tts-trailing-silence': { hume: 'trailingSilence' },
  'tts-response-format': { mistral: 'responseFormat', elevenlabs: 'responseFormat', hume: 'responseFormat' }
} as const satisfies GenericTtsControlMap

// Flags that select a voice identity in the target layer rather than a control in the control layer.
export const GENERIC_TTS_IDENTITY_MAP = {
  'tts-voice': ['elevenlabs', 'grok', 'mistral', 'openai', 'speechify', 'hume', 'cartesia', 'inworld'],
  'tts-ref-audio': ['mistral']
} as const satisfies Record<string, readonly TtsProvider[]>

export type GenericTtsControlFlag = keyof typeof GENERIC_TTS_CONTROL_MAP
export type GenericTtsIdentityFlag = keyof typeof GENERIC_TTS_IDENTITY_MAP

export const GENERIC_TTS_CONTROL_FLAGS = Object.keys(GENERIC_TTS_CONTROL_MAP) as GenericTtsControlFlag[]
export const GENERIC_TTS_IDENTITY_FLAGS = Object.keys(GENERIC_TTS_IDENTITY_MAP) as GenericTtsIdentityFlag[]

export const ttsControlSpec = (provider: string, key: string): ControlSpec | undefined =>
  (CONTROL_SPECS as Record<string, Record<string, ControlSpec>>)[provider]?.[key]

export const ttsControlsForFlag = (flagName: string): Readonly<Record<string, GenericOptionControl>> => {
  const mapping = (GENERIC_TTS_CONTROL_MAP as Record<string, Record<string, string>>)[flagName]
  if (!mapping) return {}
  return Object.fromEntries(Object.entries(mapping).map(([provider, key]) => {
    const spec = ttsControlSpec(provider, key)
    if (!spec) throw InternalError(`Generic TTS flag --${flagName} names ${provider}.${key}, which CONTROL_SPECS does not define.`)
    return [provider, { provider, key, spec }]
  }))
}

export const ttsIdentityProvidersForFlag = (flagName: string): readonly string[] =>
  (GENERIC_TTS_IDENTITY_MAP as Record<string, readonly string[]>)[flagName] ?? []

const describeSpec = (spec: ControlSpec): string | undefined => {
  let values: string | undefined
  if (spec.kind === 'number') {
    if (spec.min === undefined || spec.max === undefined) values = spec.integer ? 'integer' : undefined
    else values = `${spec.min}-${spec.max}${spec.integer ? ' (integer)' : ''}`
  } else if (spec.kind === 'boolean') {
    values = 'true|false'
  } else if (spec.kind === 'string-array') {
    values = 'repeatable list entry'
  } else {
    values = spec.allowedValues ? spec.allowedValues.join('|') : undefined
  }
  if (!values) return spec.helpNote
  return spec.helpNote ? `${values}; ${spec.helpNote}` : values
}

// Renders "<values> (<providers>)" clauses straight from CONTROL_SPECS so a range change in the
// capability table changes the help row with it.
export const describeGenericTtsControlValues = (flagName: string): string => {
  const clauses: { values: string, providers: string[] }[] = []
  const omittedNotes: string[] = []
  for (const control of Object.values(ttsControlsForFlag(flagName))) {
    if (control.spec.helpOmit) {
      if (control.spec.helpNote) omittedNotes.push(`${control.provider}: ${control.spec.helpNote}`)
      continue
    }
    const values = describeSpec(control.spec) ?? 'provider-defined'
    const existing = clauses.find((clause) => clause.values === values)
    if (existing) existing.providers.push(control.provider)
    else clauses.push({ values, providers: [control.provider] })
  }
  const accepted = clauses.map((clause) => `${clause.values} (${clause.providers.join('/')})`).join(', ')
  if (omittedNotes.length === 0) return accepted
  return [accepted, ...omittedNotes].filter(Boolean).join('; ')
}

export const genericTtsOptionDescription = (flagName: string, summary: string): string => {
  const values = describeGenericTtsControlValues(flagName)
  const providers = Object.values(ttsControlsForFlag(flagName))
    .filter((control) => !control.spec.helpOmit)
    .map((control) => control.provider)
  return `${summary}: ${providers.join('/')}. Use value with one selected provider, or provider=value with multiple providers.${values ? ` Accepted values: ${values}.` : ''}`
}
