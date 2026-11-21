import type { DiarizationOptions, ProviderSpec, Step2ProviderSelectionFilter, SttDiarizationFlagOptions, SttSelectionOptions, TranscribeEngine, TranscribeEngineCapabilities } from '~/types'
import { collectStep2ProviderSpecs } from '../command-shared/extract-routing/provider-registry'
import { UsageError } from '~/utils/error-handler'
import { DEEPINFRA_STT_RESPONSE_FORMATS, DEFAULT_DEEPINFRA_STT_RESPONSE_FORMAT } from './stt-response-format-contract'

const NO_OPTIONS = {} as const

// AssemblyAI documents disfluencies and format_text for AssemblyAI-STT-3.7; it does not document disfluencies for
// Universal-3.5 Pro, whose request body stays byte-identical, so both controls are scoped to the 3.7 model.
// https://www.assemblyai.com/docs/pre-recorded-audio/assemblyai-stt-3-7-migration-guide.md
const ASSEMBLYAI_TRANSCRIPT_STYLE_CONTROL = { models: ['assemblyai-stt-3-7'] } as const

const STT_ENGINE_CAPABILITIES = {
  deepinfra: { diarizationByDefault: false, supportsSpeakerCountHint: false, options: { responseFormat: { allowedValues: DEEPINFRA_STT_RESPONSE_FORMATS, defaultValue: DEFAULT_DEEPINFRA_STT_RESPONSE_FORMAT } } },
  deepgram: { diarizationByDefault: true, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  soniox: { diarizationByDefault: true, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  speechmatics: { diarizationByDefault: true, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  rev: { diarizationByDefault: true, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  grok: { diarizationByDefault: true, supportsSpeakerCountHint: false, options: { verbatim: true, fillerWords: {}, numberFormat: {} } },
  mistral: { diarizationByDefault: true, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  assemblyai: { diarizationByDefault: true, supportsSpeakerCountHint: true, options: { fillerWords: ASSEMBLYAI_TRANSCRIPT_STYLE_CONTROL, numberFormat: ASSEMBLYAI_TRANSCRIPT_STYLE_CONTROL } },
  gladia: { diarizationByDefault: true, supportsSpeakerCountHint: true, options: NO_OPTIONS },
  happyscribe: { diarizationByDefault: false, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  supadata: { diarizationByDefault: false, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  scrapecreators: { diarizationByDefault: false, supportsSpeakerCountHint: false, options: { languageHint: { defaultValue: 'en' } } },
  'gemini-stt': { diarizationByDefault: true, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  together: { diarizationByDefault: false, supportsSpeakerCountHint: true, options: NO_OPTIONS },
  'openai-stt': { diarizationByDefault: false, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  cloudflare: { diarizationByDefault: false, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  whisperfile: { diarizationByDefault: false, supportsSpeakerCountHint: false, options: NO_OPTIONS },
  'youtube-captions': { diarizationByDefault: false, supportsSpeakerCountHint: false, options: NO_OPTIONS }
} as const satisfies Record<TranscribeEngine, Pick<TranscribeEngineCapabilities, 'diarizationByDefault' | 'supportsSpeakerCountHint'> & { options: SttEngineOptionCapabilities }>

export type SttEngineOptionCapabilities = Readonly<{
  languageHint?: Readonly<{ defaultValue?: string }>
  verbatim?: boolean
  responseFormat?: Readonly<{ allowedValues: readonly string[], defaultValue?: string }>
  /** Keep (true) or remove (false) filler words; `models` limits support to the listed models. */
  fillerWords?: SttModelScopedControl
  /** Written (formatted digits) or spoken (words) numbers; `models` limits support to the listed models. */
  numberFormat?: SttModelScopedControl
}>

/** A control the engine supports for every model, or only for `models` when that list is present. */
export type SttModelScopedControl = Readonly<{ models?: readonly string[] }>

export const STT_NUMBER_FORMATS = ['written', 'spoken'] as const
export type SttNumberFormat = typeof STT_NUMBER_FORMATS[number]

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
  happyscribe: undefined,
  supadata: undefined,
  scrapecreators: 'scrapecreators',
  'gemini-stt': 'gemini',
  together: 'together',
  'openai-stt': 'openai',
  cloudflare: 'cloudflare',
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
    supportsDiarizationToggle: hasDiarization,
    diarizationKind: hasDiarization ? 'native' : 'unavailable',
    diarizationValidation: hasDiarization ? 'documented' : 'unsupported',
    nativeWordTiming: ['happyscribe', 'supadata', 'scrapecreators', 'youtube-captions', 'openai-stt', 'rev'].includes(engine) ? 'unavailable' : engine === 'mistral' ? 'without-diarization' : 'available',
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
  const raw = options as Record<string, unknown>
  const excluded = ['happyscribeSttModels', 'supadataSttModels', 'happyscribeOrganizationId', 'supadataLang', 'supadataChunkSize'].filter(key => raw[key] !== undefined)
  if (excluded.length > 0) throw UsageError(`Excluded STT provider settings ${excluded.join(', ')} cannot be used. Select an active STT provider explicitly.`)
  const specs = collectStep2ProviderSpecs('stt', options, filter)

  if (specs.length === 0 && !filter?.includeOrigins) {
    specs.push({ provider: 'whisperfile', model: options.whisperfileModels?.[0] ?? 'tiny' })
  }

  return specs
}

const MODEL_SCOPED_CONTROL_FLAGS = { fillerWords: 'stt-filler-words', numberFormat: 'stt-number-format' } as const

/** Models that support a model-scoped control, or undefined when every model of the engine supports it. */
export const sttModelScopedControlModels = (
  engine: TranscribeEngine,
  control: keyof typeof MODEL_SCOPED_CONTROL_FLAGS
): readonly string[] | undefined => STT_ENGINE_OPTION_CAPABILITIES[engine][control]?.models

// Runs while targets are built, which precedes pricing, credential lookup and dispatch.
export const assertSttModelScopedControl = (
  engine: TranscribeEngine,
  model: string,
  control: keyof typeof MODEL_SCOPED_CONTROL_FLAGS
): void => {
  const flag = MODEL_SCOPED_CONTROL_FLAGS[control]
  const capability = STT_ENGINE_OPTION_CAPABILITIES[engine][control]
  if (!capability) throw UsageError(`--${flag} does not apply to ${STT_ENGINE_PROVIDER_NAME[engine] ?? engine} STT.`)
  if (capability.models && !capability.models.includes(model)) {
    throw UsageError(`--${flag} does not apply to ${STT_ENGINE_PROVIDER_NAME[engine] ?? engine}/${model}; supported models: ${capability.models.join(', ')}.`)
  }
}
