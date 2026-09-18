import type { DiarizationOptions, ProviderSpec, Step2ProviderSelectionFilter, SttDiarizationFlagOptions, SttSelectionOptions, TranscribeEngine, TranscribeEngineCapabilities } from '~/types'
import { collectStep2ProviderSpecs } from '../command-shared/extract-routing/provider-registry'
import { DEEPINFRA_STT_RESPONSE_FORMATS, DEFAULT_DEEPINFRA_STT_RESPONSE_FORMAT } from './stt-response-format-contract'

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

const STT_MODEL_CAPABILITIES: Partial<Record<TranscribeEngine, Record<string, Partial<TranscribeEngineCapabilities>>>> = {
  together: {
    'openai/whisper-large-v3': { diarizationValidation: 'documented' },
    'nvidia/parakeet-tdt-0.6b-v3': { diarizationValidation: 'live-tested' }
  },
  mistral: {
    'voxtral-mini-2602': { nativeWordTiming: 'without-diarization' }
  },
  deepinfra: {
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
