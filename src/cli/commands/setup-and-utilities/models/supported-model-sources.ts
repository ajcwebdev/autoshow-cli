import type { ModelCategory, SupportedModelSource } from '~/types'
import {
  SUPPORTED_ANTHROPIC_MODELS,
  SUPPORTED_ANTHROPIC_OCR_MODELS,
  SUPPORTED_ASSEMBLYAI_STT_MODELS,
  SUPPORTED_CARTESIA_TTS_MODELS,
  SUPPORTED_DEEPGRAM_STT_MODELS,
  SUPPORTED_DEEPINFRA_OCR_MODELS,
  SUPPORTED_DEEPINFRA_STT_MODELS,
  SUPPORTED_ELEVENLABS_MUSIC_MODELS,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_FAL_IMAGE_MODELS,
  SUPPORTED_FAL_VIDEO_MODELS,
  SUPPORTED_GEMINI_IMAGE_MODELS,
  SUPPORTED_GEMINI_MODELS,
  SUPPORTED_GEMINI_MUSIC_MODELS,
  SUPPORTED_GEMINI_OCR_MODELS,
  SUPPORTED_GEMINI_STT_MODELS,
  SUPPORTED_GEMINI_VIDEO_MODELS,
  SUPPORTED_GLADIA_STT_MODELS,
  SUPPORTED_GLM_MODELS,
  SUPPORTED_GLM_OCR_MODELS,
  SUPPORTED_GROK_IMAGE_MODELS,
  SUPPORTED_GROK_MODELS,
  SUPPORTED_GROK_OCR_MODELS,
  SUPPORTED_GROK_STT_MODELS,
  SUPPORTED_GROK_TTS_MODELS,
  SUPPORTED_GROK_VIDEO_MODELS,
  SUPPORTED_HAPPYSCRIBE_STT_MODELS,
  SUPPORTED_HUME_TTS_MODELS,
  SUPPORTED_INWORLD_TTS_MODELS,
  SUPPORTED_KIMI_MODELS,
  SUPPORTED_KIMI_OCR_MODELS,
  SUPPORTED_LTX_VIDEO_MODELS,
  SUPPORTED_LUMALABS_IMAGE_MODELS,
  SUPPORTED_LUMALABS_VIDEO_MODELS,
  SUPPORTED_MINIMAX_MUSIC_MODELS,
  SUPPORTED_MISTRAL_OCR_MODELS,
  SUPPORTED_MISTRAL_STT_MODELS,
  SUPPORTED_MISTRAL_TTS_MODELS,
  SUPPORTED_OPENAI_IMAGE_MODELS,
  SUPPORTED_OPENAI_MODELS,
  SUPPORTED_OPENAI_OCR_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_REPLICATE_IMAGE_MODELS,
  SUPPORTED_REPLICATE_VIDEO_MODELS,
  SUPPORTED_SCRAPECREATORS_STT_MODELS,
  SUPPORTED_SONIOX_STT_MODELS,
  SUPPORTED_SPEECHIFY_TTS_MODELS,
  SUPPORTED_SPEECHMATICS_STT_MODELS,
  SUPPORTED_SUPADATA_STT_MODELS,
  SUPPORTED_TOGETHER_MODELS,
  SUPPORTED_TOGETHER_STT_MODELS,
  SUPPORTED_OPENAI_STT_MODELS,
  SUPPORTED_WHISPERFILE_MODELS
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'

/**
 * Pairs every hand-maintained `SUPPORTED_*` array with the registry service it mirrors. The arrays
 * stay literal so the model unions keep narrowing and the flag layer never loads the JSON registry;
 * this map is what lets a contract test hold the two spellings to one another in both directions.
 */
export const SUPPORTED_MODEL_SOURCES = [
  { step: 'stt', service: 'whisperfile', arrayName: 'SUPPORTED_WHISPERFILE_MODELS', models: SUPPORTED_WHISPERFILE_MODELS },
  { step: 'stt', service: 'deepgram', arrayName: 'SUPPORTED_DEEPGRAM_STT_MODELS', models: SUPPORTED_DEEPGRAM_STT_MODELS },
  { step: 'stt', service: 'deepinfra', arrayName: 'SUPPORTED_DEEPINFRA_STT_MODELS', models: SUPPORTED_DEEPINFRA_STT_MODELS },
  { step: 'stt', service: 'soniox', arrayName: 'SUPPORTED_SONIOX_STT_MODELS', models: SUPPORTED_SONIOX_STT_MODELS },
  { step: 'stt', service: 'speechmatics', arrayName: 'SUPPORTED_SPEECHMATICS_STT_MODELS', models: SUPPORTED_SPEECHMATICS_STT_MODELS },
  { step: 'stt', service: 'grok', arrayName: 'SUPPORTED_GROK_STT_MODELS', models: SUPPORTED_GROK_STT_MODELS },
  { step: 'stt', service: 'mistral', arrayName: 'SUPPORTED_MISTRAL_STT_MODELS', models: SUPPORTED_MISTRAL_STT_MODELS },
  { step: 'stt', service: 'assemblyai', arrayName: 'SUPPORTED_ASSEMBLYAI_STT_MODELS', models: SUPPORTED_ASSEMBLYAI_STT_MODELS },
  { step: 'stt', service: 'gladia', arrayName: 'SUPPORTED_GLADIA_STT_MODELS', models: SUPPORTED_GLADIA_STT_MODELS },
  { step: 'stt', service: 'happyscribe', arrayName: 'SUPPORTED_HAPPYSCRIBE_STT_MODELS', models: SUPPORTED_HAPPYSCRIBE_STT_MODELS },
  { step: 'stt', service: 'supadata', arrayName: 'SUPPORTED_SUPADATA_STT_MODELS', models: SUPPORTED_SUPADATA_STT_MODELS },
  { step: 'stt', service: 'scrapecreators', arrayName: 'SUPPORTED_SCRAPECREATORS_STT_MODELS', models: SUPPORTED_SCRAPECREATORS_STT_MODELS },
  { step: 'stt', service: 'gemini-stt', arrayName: 'SUPPORTED_GEMINI_STT_MODELS', models: SUPPORTED_GEMINI_STT_MODELS },
  { step: 'stt', service: 'together', arrayName: 'SUPPORTED_TOGETHER_STT_MODELS', models: SUPPORTED_TOGETHER_STT_MODELS },
  { step: 'stt', service: 'openai-stt', arrayName: 'SUPPORTED_OPENAI_STT_MODELS', models: SUPPORTED_OPENAI_STT_MODELS },

  { step: 'extract', service: 'mistral', arrayName: 'SUPPORTED_MISTRAL_OCR_MODELS', models: SUPPORTED_MISTRAL_OCR_MODELS },
  { step: 'extract', service: 'glm', arrayName: 'SUPPORTED_GLM_OCR_MODELS', models: SUPPORTED_GLM_OCR_MODELS },
  { step: 'extract', service: 'kimi', arrayName: 'SUPPORTED_KIMI_OCR_MODELS', models: SUPPORTED_KIMI_OCR_MODELS },
  { step: 'extract', service: 'openai', arrayName: 'SUPPORTED_OPENAI_OCR_MODELS', models: SUPPORTED_OPENAI_OCR_MODELS },
  { step: 'extract', service: 'grok', arrayName: 'SUPPORTED_GROK_OCR_MODELS', models: SUPPORTED_GROK_OCR_MODELS },
  { step: 'extract', service: 'anthropic', arrayName: 'SUPPORTED_ANTHROPIC_OCR_MODELS', models: SUPPORTED_ANTHROPIC_OCR_MODELS },
  { step: 'extract', service: 'gemini', arrayName: 'SUPPORTED_GEMINI_OCR_MODELS', models: SUPPORTED_GEMINI_OCR_MODELS },
  { step: 'extract', service: 'deepinfra', arrayName: 'SUPPORTED_DEEPINFRA_OCR_MODELS', models: SUPPORTED_DEEPINFRA_OCR_MODELS },

  { step: 'llm', service: 'openai', arrayName: 'SUPPORTED_OPENAI_MODELS', models: SUPPORTED_OPENAI_MODELS },
  { step: 'llm', service: 'gemini', arrayName: 'SUPPORTED_GEMINI_MODELS', models: SUPPORTED_GEMINI_MODELS },
  { step: 'llm', service: 'anthropic', arrayName: 'SUPPORTED_ANTHROPIC_MODELS', models: SUPPORTED_ANTHROPIC_MODELS },
  { step: 'llm', service: 'grok', arrayName: 'SUPPORTED_GROK_MODELS', models: SUPPORTED_GROK_MODELS },
  { step: 'llm', service: 'glm', arrayName: 'SUPPORTED_GLM_MODELS', models: SUPPORTED_GLM_MODELS },
  { step: 'llm', service: 'kimi', arrayName: 'SUPPORTED_KIMI_MODELS', models: SUPPORTED_KIMI_MODELS },
  { step: 'llm', service: 'together', arrayName: 'SUPPORTED_TOGETHER_MODELS', models: SUPPORTED_TOGETHER_MODELS },

  { step: 'tts', service: 'elevenlabs', arrayName: 'SUPPORTED_ELEVENLABS_TTS_MODELS', models: SUPPORTED_ELEVENLABS_TTS_MODELS },
  { step: 'tts', service: 'grok', arrayName: 'SUPPORTED_GROK_TTS_MODELS', models: SUPPORTED_GROK_TTS_MODELS },
  { step: 'tts', service: 'mistral', arrayName: 'SUPPORTED_MISTRAL_TTS_MODELS', models: SUPPORTED_MISTRAL_TTS_MODELS },
  { step: 'tts', service: 'openai', arrayName: 'SUPPORTED_OPENAI_TTS_MODELS', models: SUPPORTED_OPENAI_TTS_MODELS },
  { step: 'tts', service: 'speechify', arrayName: 'SUPPORTED_SPEECHIFY_TTS_MODELS', models: SUPPORTED_SPEECHIFY_TTS_MODELS },
  { step: 'tts', service: 'hume', arrayName: 'SUPPORTED_HUME_TTS_MODELS', models: SUPPORTED_HUME_TTS_MODELS },
  { step: 'tts', service: 'cartesia', arrayName: 'SUPPORTED_CARTESIA_TTS_MODELS', models: SUPPORTED_CARTESIA_TTS_MODELS },
  { step: 'tts', service: 'inworld', arrayName: 'SUPPORTED_INWORLD_TTS_MODELS', models: SUPPORTED_INWORLD_TTS_MODELS },

  { step: 'image', service: 'gemini', arrayName: 'SUPPORTED_GEMINI_IMAGE_MODELS', models: SUPPORTED_GEMINI_IMAGE_MODELS },
  { step: 'image', service: 'openai', arrayName: 'SUPPORTED_OPENAI_IMAGE_MODELS', models: SUPPORTED_OPENAI_IMAGE_MODELS },
  { step: 'image', service: 'grok', arrayName: 'SUPPORTED_GROK_IMAGE_MODELS', models: SUPPORTED_GROK_IMAGE_MODELS },
  { step: 'image', service: 'replicate', arrayName: 'SUPPORTED_REPLICATE_IMAGE_MODELS', models: SUPPORTED_REPLICATE_IMAGE_MODELS },
  { step: 'image', service: 'lumalabs', arrayName: 'SUPPORTED_LUMALABS_IMAGE_MODELS', models: SUPPORTED_LUMALABS_IMAGE_MODELS },
  { step: 'image', service: 'fal', arrayName: 'SUPPORTED_FAL_IMAGE_MODELS', models: SUPPORTED_FAL_IMAGE_MODELS },

  { step: 'video', service: 'gemini', arrayName: 'SUPPORTED_GEMINI_VIDEO_MODELS', models: SUPPORTED_GEMINI_VIDEO_MODELS },
  { step: 'video', service: 'grok', arrayName: 'SUPPORTED_GROK_VIDEO_MODELS', models: SUPPORTED_GROK_VIDEO_MODELS },
  { step: 'video', service: 'ltx', arrayName: 'SUPPORTED_LTX_VIDEO_MODELS', models: SUPPORTED_LTX_VIDEO_MODELS },
  { step: 'video', service: 'replicate', arrayName: 'SUPPORTED_REPLICATE_VIDEO_MODELS', models: SUPPORTED_REPLICATE_VIDEO_MODELS },
  { step: 'video', service: 'lumalabs', arrayName: 'SUPPORTED_LUMALABS_VIDEO_MODELS', models: SUPPORTED_LUMALABS_VIDEO_MODELS },
  { step: 'video', service: 'fal', arrayName: 'SUPPORTED_FAL_VIDEO_MODELS', models: SUPPORTED_FAL_VIDEO_MODELS },

  { step: 'music', service: 'elevenlabs', arrayName: 'SUPPORTED_ELEVENLABS_MUSIC_MODELS', models: SUPPORTED_ELEVENLABS_MUSIC_MODELS },
  { step: 'music', service: 'minimax', arrayName: 'SUPPORTED_MINIMAX_MUSIC_MODELS', models: SUPPORTED_MINIMAX_MUSIC_MODELS },
  { step: 'music', service: 'gemini', arrayName: 'SUPPORTED_GEMINI_MUSIC_MODELS', models: SUPPORTED_GEMINI_MUSIC_MODELS }
] as const satisfies readonly SupportedModelSource[]

/**
 * Registry services that deliberately carry no `SUPPORTED_*` array because they expose no model
 * selector: the transport itself is the choice. Anything else added to a registry must land here
 * or in `SUPPORTED_MODEL_SOURCES`.
 */
export const MODEL_SELECTOR_FREE_SERVICES: Readonly<Record<ModelCategory, readonly string[]>> = {
  stt: ['youtube-captions'],
  extract: ['defuddle', 'firecrawl', 'glm-reader', 'spider', 'supadata', 'zyte'],
  llm: [],
  tts: [],
  image: [],
  video: [],
  music: []
}

export const getSupportedModelSource = (
  step: ModelCategory,
  service: string
): SupportedModelSource | undefined =>
  SUPPORTED_MODEL_SOURCES.find(source => source.step === step && source.service === service)
