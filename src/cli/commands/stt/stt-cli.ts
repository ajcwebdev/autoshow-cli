import type { DiarizationOptions, ProviderSpec, Step2ProviderSelectionFilter, SttDiarizationFlagOptions, SttSelectionOptions, TranscribeEngine, TranscribeEngineCapabilities } from '~/types'
import { collectStep2ProviderSpecs } from '../command-shared/extract-routing/provider-registry'

const STT_ENGINE_CAPABILITIES = {
  deepinfra: { diarizationByDefault: false, supportsSpeakerCountHint: false },
  deepgram: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  soniox: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  speechmatics: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  rev: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  grok: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  mistral: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  assemblyai: { diarizationByDefault: true, supportsSpeakerCountHint: true },
  gladia: { diarizationByDefault: true, supportsSpeakerCountHint: true },
  happyscribe: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  supadata: { diarizationByDefault: false, supportsSpeakerCountHint: false },
  scrapecreators: { diarizationByDefault: false, supportsSpeakerCountHint: false },
  'gemini-stt': { diarizationByDefault: false, supportsSpeakerCountHint: false },
  together: { diarizationByDefault: false, supportsSpeakerCountHint: true },
  whisperfile: { diarizationByDefault: false, supportsSpeakerCountHint: false },
  'youtube-captions': { diarizationByDefault: false, supportsSpeakerCountHint: false }
} as const satisfies Record<TranscribeEngine, Pick<TranscribeEngineCapabilities, 'diarizationByDefault' | 'supportsSpeakerCountHint'>>

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
  }
}

export const getSttEngineCapabilities = (
  engine: TranscribeEngine,
  model?: string
): TranscribeEngineCapabilities => {
  const defaults = STT_ENGINE_CAPABILITIES[engine]
  const hasDiarization = defaults.diarizationByDefault || engine === 'together' || engine === 'gemini-stt'
  return {
    ...defaults,
    supportsDiarizationToggle: hasDiarization && engine !== 'happyscribe',
    diarizationKind: engine === 'gemini-stt' ? 'generated' : hasDiarization ? 'native' : 'unavailable',
    diarizationValidation: hasDiarization ? 'documented' : 'unsupported',
    nativeWordTiming: ['supadata', 'scrapecreators', 'gemini-stt', 'youtube-captions', 'rev'].includes(engine) ? 'unavailable' : engine === 'mistral' ? 'without-diarization' : 'available',
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
