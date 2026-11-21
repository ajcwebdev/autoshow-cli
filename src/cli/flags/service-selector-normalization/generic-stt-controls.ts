import { STT_ENGINE_OPTION_CAPABILITIES, STT_ENGINE_PROVIDER_NAME, STT_NUMBER_FORMATS } from '~/cli/commands/stt/stt-cli'
import type { ControlSpec, TranscribeEngine } from '~/types'
import type { GenericOptionControl } from './generic-provider-option-selectors'

// Each generic STT flag names, per provider, the capability the STT engine table declares for it.
// Everything here is derived from that table, so an engine that gains or loses a capability changes
// the accepted flags, the help text and the validation together.
export const GENERIC_STT_OPTION_FLAGS = [
  'stt-language',
  'stt-verbatim',
  'stt-filler-words',
  'stt-number-format',
  'stt-response-format'
] as const

export type GenericSttOptionFlag = typeof GENERIC_STT_OPTION_FLAGS[number]

const controlForEngine = (
  flagName: GenericSttOptionFlag,
  engine: TranscribeEngine
): { spec: ControlSpec, defaultValue?: string | undefined } | undefined => {
  const options = STT_ENGINE_OPTION_CAPABILITIES[engine]
  switch (flagName) {
    case 'stt-language':
      return options.languageHint
        ? { spec: { kind: 'string', normalize: (value) => value.trim() }, ...(options.languageHint.defaultValue !== undefined ? { defaultValue: options.languageHint.defaultValue } : {}) }
        : undefined
    case 'stt-verbatim':
      return options.verbatim ? { spec: { kind: 'boolean' } } : undefined
    case 'stt-filler-words':
      return options.fillerWords ? { spec: { kind: 'boolean' } } : undefined
    case 'stt-number-format':
      return options.numberFormat
        ? { spec: { kind: 'string', normalize: (value) => value.trim().toLowerCase(), allowedValues: STT_NUMBER_FORMATS } }
        : undefined
    case 'stt-response-format':
      return options.responseFormat
        ? { spec: { kind: 'string', normalize: (value) => value.trim().toLowerCase(), allowedValues: options.responseFormat.allowedValues }, ...(options.responseFormat.defaultValue !== undefined ? { defaultValue: options.responseFormat.defaultValue } : {}) }
        : undefined
  }
}

export const sttControlsForFlag = (flagName: string): Readonly<Record<string, GenericOptionControl>> => {
  if (!(GENERIC_STT_OPTION_FLAGS as readonly string[]).includes(flagName)) return {}
  const controls: Record<string, GenericOptionControl> = {}
  for (const [engine, provider] of Object.entries(STT_ENGINE_PROVIDER_NAME)) {
    if (provider === undefined) continue
    const control = controlForEngine(flagName as GenericSttOptionFlag, engine as TranscribeEngine)
    if (!control) continue
    controls[provider] = {
      provider,
      key: flagName,
      spec: control.spec,
      ...(control.defaultValue !== undefined ? { defaultValue: control.defaultValue } : {})
    }
  }
  return controls
}

const describeSpec = (spec: ControlSpec): string | undefined => {
  if (spec.kind === 'number') return spec.integer ? 'positive integer' : undefined
  if (spec.kind === 'boolean') return 'true|false'
  if (spec.kind === 'string') return spec.allowedValues?.join('|')
  return undefined
}

const modelScopeForFlag = (flagName: GenericSttOptionFlag, engine: TranscribeEngine): readonly string[] | undefined => {
  const options = STT_ENGINE_OPTION_CAPABILITIES[engine]
  if (flagName === 'stt-filler-words') return options.fillerWords?.models
  if (flagName === 'stt-number-format') return options.numberFormat?.models
  return undefined
}

const providerLabel = (flagName: GenericSttOptionFlag, provider: string): string => {
  const engine = Object.entries(STT_ENGINE_PROVIDER_NAME).find(([, name]) => name === provider)?.[0] as TranscribeEngine | undefined
  const models = engine ? modelScopeForFlag(flagName, engine) : undefined
  return models ? `${provider} (${models.join(', ')})` : provider
}

export const genericSttOptionDescription = (flagName: GenericSttOptionFlag, summary: string): string => {
  const controls = Object.values(sttControlsForFlag(flagName))
  const providers = controls.map((control) => providerLabel(flagName, control.provider))
  const values = [...new Set(controls.map((control) => describeSpec(control.spec)).filter(Boolean))].join(', ')
  // A model-scoped capability is still addressed per provider, so a provider=value applies to every selected model of
  // that provider and is refused when any of them lacks the capability.
  const modelScoped = controls.some((control) => providerLabel(flagName, control.provider) !== control.provider)
  const scopeNote = modelScoped ? ' A provider=value applies to every selected model of that provider, so select only the listed models of a model-scoped provider.' : ''
  return `${summary}: ${providers.join('/')} only. Use value with one selected provider, or provider=value with multiple providers.${scopeNote}${values ? ` Accepted values: ${values}.` : ''}`
}

// Rendered `default` for each flag, per the scoped-repeatable convention: the array is what --help
// shows, and resolution reads the same registry rather than the seeded value.
export const genericSttOptionDefault = (flagName: GenericSttOptionFlag): string[] | undefined => {
  const seeded = Object.values(sttControlsForFlag(flagName))
    .flatMap((control) => control.defaultValue !== undefined ? [`${control.provider}=${control.defaultValue}`] : [])
  return seeded.length > 0 ? seeded : undefined
}
