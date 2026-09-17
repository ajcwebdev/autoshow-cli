import type { DiarizationOptions, ProviderSpec, Step2ProviderSelectionFilter, SttDiarizationFlagOptions, SttSelectionOptions, TranscribeEngine, TranscribeEngineCapabilities } from '~/types'
import { collectStep2ProviderSpecs } from '../command-shared/extract-routing/provider-registry'
import { DEEPINFRA_STT_RESPONSE_FORMATS, DEFAULT_DEEPINFRA_STT_RESPONSE_FORMAT } from './stt-response-format-contract'

// Engine capabilities, including which provider-general CLI options each engine accepts. The
// `satisfies Record<TranscribeEngine, ...>` means adding an engine without declaring its
// capabilities is a compile error, which is what keeps the generic --stt-* flags honest.
//
// These are ENGINE-level facts on purpose. The flag layer runs before model selection is final
// (--all-stt expands to many models), so a flag whose validity depended on the winning model would
// produce non-deterministic usage errors. STT_MODEL_CAPABILITIES below stays a runtime/diarization
// concern and is never consulted for flag validation.
const NO_OPTIONS = {} as const

const STT_ENGINE_CAPABILITIES = {
  deepinfra: { diarizationByDefault: false, supportsSpeakerCountHint: false, options: { responseFormat: { allowedValues: DEEPINFRA_STT_RESPONSE_FORMATS, defaultValue: DEFAULT_DEEPINFRA_STT_RESPONSE_FORMAT } } },
  deepgram: { diarizationByDefault: true, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  soniox: { diarizationByDefault: true, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  speechmatics: { diarizationByDefault: true, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  rev: { diarizationByDefault: true, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  grok: { diarizationByDefault: true, supportsSpeakerCountHint: false, options: { verbatim: true } },
  mistral: { diarizationByDefault: true, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  assemblyai: { diarizationByDefault: true, supportsSpeakerCountHint: true, options: NO_OPTIONS },
  gladia: { diarizationByDefault: true, supportsSpeakerCountHint: true, options: NO_OPTIONS },
  happyscribe: { diarizationByDefault: true, supportsSpeakerCountHint: false, options: { organizationId: true } },
  supadata: { diarizationByDefault: false, supportsSpeakerCountHint: false, options: { languageHint: {}, chunkSize: true } },
  scrapecreators: { diarizationByDefault: false, supportsSpeakerCountHint: false, options: { languageHint: { defaultValue: 'en' } } },
  'gemini-stt': { diarizationByDefault: true, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  together: { diarizationByDefault: false, supportsSpeakerCountHint: true, options: NO_OPTIONS },
  'openai-stt': { diarizationByDefault: false, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  whisperfile: { diarizationByDefault: false, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  'youtube-captions': { diarizationByDefault: false, supportsSpeakerCountHint: false, options: NO_OPTIONS }
} as const satisfies Record<TranscribeEngine, Pick<TranscribeEngineCapabilities, 'diarizationByDefault' | 'supportsSpeakerCountHint'> & { options: SttEngineOptionCapabilities }>

export type SttEngineOptionCapabilities = Readonly<{
  languageHint?: Readonly<{ defaultValue?: string }>
  verbatim?: boolean
  chunkSize?: boolean
  responseFormat?: Readonly<{ allowedValues: readonly string[], defaultValue?: string }>
  organizationId?: boolean
}>

export const STT_ENGINE_OPTION_CAPABILITIES: Record<TranscribeEngine, SttEngineOptionCapabilities> =
  Object.fromEntries(Object.entries(STT_ENGINE_CAPABILITIES).map(([engine, capabilities]) =>
    [engine, capabilities.options])) as Record<TranscribeEngine, SttEngineOptionCapabilities>

// Engine ids are internal; `gemini-stt` is spelled `gemini` on the CLI, and two engines have no
// public --provider spelling at all. Help text and usage errors both go through this map.
export const STT_ENGINE_PROVIDER_NAME: Record<TranscribeEngine, string | undefined> = {
  deepinfra: 'deepinfra',
  deepgram: 'deepgram',
  soniox: 'soniox',
  speechmatics: 'speechmatics',
  rev: undefined,
  grok: 'grok',
  mistral: 'mistral',
  assemblyai: 'assemblyai',
  gladia: 'gladia',
  happyscribe: 'happyscribe',
  supadata: 'supadata',
  scrapecreators: 'scrapecreators',
  'gemini-stt': 'gemini',
  together: 'together',
  'openai-stt': 'openai',
  whisperfile: 'whisperfile',
  'youtube-captions': undefined
}

// Model overrides describe the implemented request contract, separately from live
// validation. A shared endpoint does not prove feature parity between its models.
const STT_MODEL_CAPABILITIES: Partial<Record<TranscribeEngine, Record<string, Partial<TranscribeEngineCapabilities>>>> = {
  together: {
    'openai/whisper-large-v3': { diarizationValidation: 'documented' },
    // 2026-09-10: live two-speaker sample returned speaker segments and words.
    // Some native words had zero duration; this verifies diarization support,
    // not acoustic word-boundary accuracy. See docs/adr/ADR-009-extract-execution-and-artifact-contracts.md#together-parakeet-live-validation.
    'nvidia/parakeet-tdt-0.6b-v3': { diarizationValidation: 'live-tested' }
  },
  mistral: {
    'voxtral-mini-2602': { nativeWordTiming: 'without-diarization' }
  },
  deepinfra: {
    // 2026-09-16: live batch samples returned words and segments for the Whisper,
    // Qwen3-ASR, and Nemotron deployments, but both Voxtral deployments return
    // transcript text with null words and null segments.
    'mistralai/Voxtral-Mini-3B-2507': { nativeWordTiming: 'unavailable' },
    'mistralai/Voxtral-Small-24B-2507': { nativeWordTiming: 'unavailable' }
  }
}

export const getSttEngineCapabilities = (
  engine: TranscribeEngine,
  model?: string
): TranscribeEngineCapabilities => {
  const defaults = STT_ENGINE_CAPABILITIES[engine]
  const hasDiarization = defaults.diarizationByDefault || engine === 'together'
  return {
    ...defaults,
    supportsDiarizationToggle: hasDiarization && engine !== 'happyscribe',
    diarizationKind: hasDiarization ? 'native' : 'unavailable',
    diarizationValidation: hasDiarization ? 'documented' : 'unsupported',
    nativeWordTiming: ['supadata', 'scrapecreators', 'youtube-captions', 'openai-stt', 'rev'].includes(engine) ? 'unavailable' : engine === 'mistral' ? 'without-diarization' : 'available',
    ...(model ? STT_MODEL_CAPABILITIES[engine]?.[model] : {})
  }
}

export const resolveDiarizationOptions = (
  options: SttDiarizationFlagOptions,
  engine: TranscribeEngine,
  model?: string
): DiarizationOptions | undefined => {
  const speakerCount = options.diarizationSpeakerCount
  const capabilities = getSttEngineCapabilities(engine, model)
  const diarizationOptions: DiarizationOptions = capabilities.diarizationByDefault
    ? { enabled: true }
    : {}

  if (options.diarization !== undefined && capabilities.supportsDiarizationToggle) {
    diarizationOptions.enabled = options.diarization
  }
  if (diarizationOptions.enabled === false) return diarizationOptions
  if (engine === 'together' && speakerCount !== undefined) diarizationOptions.enabled = true

  if (speakerCount === undefined) {
    return Object.keys(diarizationOptions).length > 0 ? diarizationOptions : undefined
  }

  if (!capabilities.supportsSpeakerCountHint) {
    return Object.keys(diarizationOptions).length > 0 ? diarizationOptions : undefined
  }

  diarizationOptions.speakerCount = speakerCount
  return diarizationOptions
}

export const collectSttProviderSpecs = (
  options: SttSelectionOptions,
  filter?: Step2ProviderSelectionFilter
): ProviderSpec[] => {
  const specs = collectStep2ProviderSpecs('stt', options, filter)

  if (specs.length === 0 && !filter?.includeOrigins) {
    specs.push({ provider: 'whisperfile', model: options.whisperfileModels?.[0] ?? 'tiny' })
  }

  return specs
}
