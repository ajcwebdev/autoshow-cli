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
  'rev-stt',
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
  'replicate-ocr',
  'fal-ocr',
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
  'groq-tts',
  'grok-tts',
  'mistral-tts',
  'openai-tts',
  'gemini-tts',
  'speechify-tts',
  'hume-tts',
  'cartesia-tts',
  'fish-tts',
  'inworld-tts',
  'deepinfra-tts',
  'replicate-tts',
  'fal-tts',
  'deepgram-tts',
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
  'minimax-video',
  'grok-video',
  'ltx-video',
  'replicate-video',
  'lumalabs-video',
  'fal-video'
] as const

const STT_SELECTION_PROBE = {
  deepinfraSttModels: undefined,
  deepinfraSttModel: undefined,
  deepgramSttModels: undefined,
  deepgramSttModel: undefined,
  sonioxSttModels: undefined,
  sonioxSttModel: undefined,
  speechmaticsSttModels: undefined,
  speechmaticsSttModel: undefined,
  revSttModels: undefined,
  revSttModel: undefined,
  groqSttModels: undefined,
  groqSttModel: undefined,
  grokSttModels: undefined,
  grokSttModel: undefined,
  mistralSttModels: undefined,
  mistralSttModel: undefined,
  assemblyaiSttModels: undefined,
  assemblyaiSttModel: undefined,
  gladiaSttModels: undefined,
  gladiaSttModel: undefined,
  happyscribeSttModels: undefined,
  happyscribeSttModel: undefined,
  supadataSttModels: undefined,
  supadataSttModel: undefined,
  scrapecreatorsSttModels: undefined,
  scrapecreatorsSttModel: undefined,
  geminiSttModels: ['gemini-3-flash-preview'],
  geminiSttModel: undefined,
  togetherSttModels: ['openai/whisper-large-v3'],
  togetherSttModel: undefined,
  whisperModels: undefined,
  whisperModel: 'tiny',
  whisperfileModels: undefined,
  whisperfileModel: undefined,
  step2SelectionOrigins: {
    'gemini-stt': 'explicit',
    'together-stt': 'explicit'
  }
} satisfies SttSelectionOptions

const OCR_SELECTION_PROBE = {
  useTesseract: false,
  mistralOcrModels: undefined,
  mistralOcrModel: undefined,
  glmOcrModels: undefined,
  glmOcrModel: undefined,
  kimiOcrModels: undefined,
  kimiOcrModel: undefined,
  openaiOcrModels: undefined,
  openaiOcrModel: undefined,
  grokOcrModels: undefined,
  grokOcrModel: undefined,
  anthropicOcrModels: undefined,
  anthropicOcrModel: undefined,
  geminiOcrModels: undefined,
  geminiOcrModel: undefined,
  deepinfraOcrModels: undefined,
  deepinfraOcrModel: undefined,
  replicateOcrModels: undefined,
  replicateOcrModel: undefined,
  falOcrModels: undefined,
  falOcrModel: undefined,
  step2SelectionOrigins: {}
} satisfies OcrSelectionOptions

const ROUTING_SELECTION_PROBE = {
  ...STT_SELECTION_PROBE,
  ...OCR_SELECTION_PROBE,
  urlBackend: 'defuddle',
  urlBackendExplicit: false,
  urlBackends: undefined,
  useEpubBun: false
} satisfies NonNullable<Parameters<typeof resolveInputRoutingForCommand>[2]>

const registrySelectionKeys = (step: 'stt' | 'ocr'): string[] => [
  ...getStep2ProviderEntries(step).flatMap((entry) => {
    if (entry.selection.type === 'boolean') return [entry.selection.runtimeKey]
    if (entry.selection.type === 'models') {
      return [entry.selection.runtimeModelsKey, entry.selection.runtimeModelKey]
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
