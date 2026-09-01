import { describe, expect, test } from 'bun:test'
import { REPEATABLE_MODEL_FLAGS } from '~/cli/flags/service-selector-normalization/repeatable-model-flags'
import { resolveInputRoutingForCommand } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-routing'
import {
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  STANDALONE_TTS_PROVIDER_TARGETS,
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  WRITE_LLM_PROVIDER_TARGETS
} from '~/cli/flags/service-selector-normalization/provider-targets'
import { collectOcrProviderSpecs } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-cli'
import { collectSttProviderSpecs } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-cli'
import { getStep2ProviderEntries } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import type { OcrSelectionOptions, SttSelectionOptions } from '~/types'

const EXPECTED_REPEATABLE_MODEL_FLAGS = [
  'whisper-stt',
  'whisperfile-stt',
  'deepinfra-stt',
  'groq-stt',
  'grok-stt',
  'deepgram-stt',
  'soniox-stt',
  'speechmatics-stt',
  'mistral-stt',
  'assemblyai-stt',
  'gladia-stt',
  'happyscribe-stt',
  'supadata-stt',
  'scrapecreators-stt',
  'gemini-stt',
  'together-stt',
  'mistral-ocr',
  'glm-ocr',
  'kimi-ocr',
  'openai-ocr',
  'grok-ocr',
  'anthropic-ocr',
  'gemini-ocr',
  'deepinfra-ocr',
  'openai',
  'groq',
  'gemini',
  'anthropic',
  'minimax',
  'grok',
  'glm',
  'kimi',
  'together',
  'cerebras',
  'elevenlabs-tts',
  'minimax-tts',
  'grok-tts',
  'mistral-tts',
  'openai-tts',
  'speechify-tts',
  'hume-tts',
  'cartesia-tts',
  'inworld-tts',
  'gemini-image',
  'openai-image',
  'grok-image',
  'bfl-image',
  'replicate-image',
  'lumalabs-image',
  'fal-image',
  'elevenlabs-music',
  'minimax-music',
  'gemini-music',
  'gemini-video',
  'grok-video',
  'ltx-video',
  'replicate-video',
  'lumalabs-video',
  'fal-video'
] as const

const STT_SELECTION_PROBE = {
  deepinfraSttModels: undefined,
  deepgramSttModels: undefined,
  sonioxSttModels: undefined,
  speechmaticsSttModels: undefined,
  groqSttModels: undefined,
  grokSttModels: undefined,
  mistralSttModels: undefined,
  assemblyaiSttModels: undefined,
  gladiaSttModels: undefined,
  happyscribeSttModels: undefined,
  supadataSttModels: undefined,
  scrapecreatorsSttModels: undefined,
  geminiSttModels: ['gemini-3-flash-preview'],
  togetherSttModels: ['openai/whisper-large-v3'],
  whisperModels: ['tiny'],
  whisperfileModels: undefined,
  step2SelectionOrigins: {
    'gemini-stt': 'explicit',
    'together-stt': 'explicit'
  }
} satisfies SttSelectionOptions

const OCR_SELECTION_PROBE = {
  useTesseract: false,
  mistralOcrModels: undefined,
  glmOcrModels: undefined,
  kimiOcrModels: undefined,
  openaiOcrModels: undefined,
  grokOcrModels: undefined,
  anthropicOcrModels: undefined,
  geminiOcrModels: undefined,
  deepinfraOcrModels: undefined,
  step2SelectionOrigins: {}
} satisfies OcrSelectionOptions

const ROUTING_SELECTION_PROBE = {
  ...STT_SELECTION_PROBE,
  ...OCR_SELECTION_PROBE,
  urlBackend: 'defuddle',
  urlBackendExplicit: false,
  urlBackends: undefined
} satisfies NonNullable<Parameters<typeof resolveInputRoutingForCommand>[2]>

const registrySelectionKeys = (step: 'stt' | 'ocr'): string[] => [
  ...getStep2ProviderEntries(step).flatMap((entry) => {
    if (entry.selection.type === 'boolean') return [entry.selection.runtimeKey]
    if (entry.selection.type === 'models') {
      return [entry.selection.runtimeModelsKey]
    }
    return []
  }),
  'step2SelectionOrigins'
]

describe('selection inventory contracts', () => {
  test('repeatable model flags preserve order and cover selectable model targets in both directions', () => {
    const selectableFlags = [
      ...getStep2ProviderEntries('stt'),
      ...getStep2ProviderEntries('ocr')
    ].flatMap((entry) => entry.selection.type === 'models' ? [entry.flagName] : [])
    selectableFlags.push(
      ...Object.values(WRITE_LLM_PROVIDER_TARGETS),
      ...Object.values(STANDALONE_TTS_PROVIDER_TARGETS),
      ...Object.values(STANDALONE_IMAGE_PROVIDER_TARGETS),
      ...Object.values(STANDALONE_MUSIC_PROVIDER_TARGETS),
      ...Object.values(STANDALONE_VIDEO_PROVIDER_TARGETS)
    )

    expect(REPEATABLE_MODEL_FLAGS).toEqual(EXPECTED_REPEATABLE_MODEL_FLAGS)
    expect(new Set(REPEATABLE_MODEL_FLAGS).size).toBe(REPEATABLE_MODEL_FLAGS.length)
    expect([...new Set<string>(REPEATABLE_MODEL_FLAGS)].sort()).toEqual([...new Set(selectableFlags)].sort())
  })

  test('registry selection keys and the canonical collector input types cover one another', () => {
    expect(Object.keys(STT_SELECTION_PROBE).sort()).toEqual(registrySelectionKeys('stt').sort())
    expect(Object.keys(OCR_SELECTION_PROBE).sort()).toEqual(registrySelectionKeys('ocr').sort())
    expect(ROUTING_SELECTION_PROBE.geminiSttModels).toEqual(STT_SELECTION_PROBE.geminiSttModels)
    expect(collectSttProviderSpecs(STT_SELECTION_PROBE)).toEqual([
      { provider: 'gemini-stt', model: 'gemini-3-flash-preview' },
      { provider: 'together', model: 'openai/whisper-large-v3' }
    ])
    expect(collectOcrProviderSpecs(OCR_SELECTION_PROBE)).toEqual([])
  })
})
