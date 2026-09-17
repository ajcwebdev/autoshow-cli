import { STT_ENGINE_OPTION_CAPABILITIES, STT_ENGINE_PROVIDER_NAME } from '~/cli/commands/stt/stt-cli'
import type { ControlSpec, TranscribeEngine } from '~/types'
import type { GenericOptionControl } from './generic-provider-option-selectors'

// Each generic STT flag names, per provider, the capability the STT engine table declares for it.
// Everything here is derived from that table, so an engine that gains or loses a capability changes
// the accepted flags, the help text and the validation together.
export const GENERIC_STT_OPTION_FLAGS = [
  'stt-language',
  'stt-verbatim',
  'stt-chunk-size',
  'stt-response-format',
  'stt-organization-id'
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
    case 'stt-chunk-size':
      return options.chunkSize ? { spec: { kind: 'number', min: 1, integer: true } } : undefined
    case 'stt-response-format':
      return options.responseFormat
        ? { spec: { kind: 'string', normalize: (value) => value.trim().toLowerCase(), allowedValues: options.responseFormat.allowedValues }, ...(options.responseFormat.defaultValue !== undefined ? { defaultValue: options.responseFormat.defaultValue } : {}) }
        : undefined
    case 'stt-organization-id':
      return options.organizationId ? { spec: { kind: 'string', normalize: (value) => value.trim() } } : undefined
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

export const genericSttOptionDescription = (flagName: GenericSttOptionFlag, summary: string): string => {
  const controls = Object.values(sttControlsForFlag(flagName))
  const providers = controls.map((control) => control.provider)
  const values = [...new Set(controls.map((control) => describeSpec(control.spec)).filter(Boolean))].join(', ')
  return `${summary}: ${providers.join('/')} only. Use value with one selected provider, or provider=value with multiple providers.${values ? ` Accepted values: ${values}.` : ''}`
}

// Rendered `default` for each flag, per the scoped-repeatable convention: the array is what --help
// shows, and resolution reads the same registry rather than the seeded value.
export const genericSttOptionDefault = (flagName: GenericSttOptionFlag): string[] | undefined => {
  const seeded = Object.values(sttControlsForFlag(flagName))
    .flatMap((control) => control.defaultValue !== undefined ? [`${control.provider}=${control.defaultValue}`] : [])
  return seeded.length > 0 ? seeded : undefined
}
