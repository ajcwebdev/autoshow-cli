import type { GenerationPricingProviders, GenerationSelectionDescriptor, GenerationSelectionFields } from '~/types'

export const STANDALONE_TTS_PROVIDER_TARGETS = {
  elevenlabs: 'elevenlabs-tts',
  minimax: 'minimax-tts',
  groq: 'groq-tts',
  grok: 'grok-tts',
  mistral: 'mistral-tts',
  openai: 'openai-tts',
  gemini: 'gemini-tts',
  deepgram: 'deepgram-tts',
  speechify: 'speechify-tts',
  hume: 'hume-tts',
  cartesia: 'cartesia-tts',
  fish: 'fish-tts',
  inworld: 'inworld-tts',
  deepinfra: 'deepinfra-tts',
  replicate: 'replicate-tts',
  fal: 'fal-tts'
} as const satisfies Record<string, string>

export const STANDALONE_IMAGE_PROVIDER_TARGETS = {
  gemini: 'gemini-image',
  openai: 'openai-image',
  grok: 'grok-image',
  bfl: 'bfl-image',
  replicate: 'replicate-image',
  lumalabs: 'lumalabs-image',
  fal: 'fal-image'
} as const satisfies Record<string, string>

export const STANDALONE_VIDEO_PROVIDER_TARGETS = {
  gemini: 'gemini-video',
  grok: 'grok-video',
  ltx: 'ltx-video',
  replicate: 'replicate-video',
  lumalabs: 'lumalabs-video',
  fal: 'fal-video'
} as const satisfies Record<string, string>

export const STANDALONE_MUSIC_PROVIDER_TARGETS = {
  elevenlabs: 'elevenlabs-music',
  minimax: 'minimax-music',
  gemini: 'gemini-music'
} as const satisfies Record<string, string>

const defineGenerationSelectionDescriptor = <
  const TProviderTargets extends Readonly<Record<string, string>>,
  const TSelections extends GenerationSelectionFields<TProviderTargets>
>(
  providerTargets: TProviderTargets,
  selections: TSelections & Record<Exclude<keyof TSelections, keyof TProviderTargets>, never>
) => ({ providerTargets, selections })

export const deriveGenerationPricingProviders = <const TDescriptor extends GenerationSelectionDescriptor>(
  descriptor: TDescriptor
): GenerationPricingProviders<TDescriptor> =>
  Object.keys(descriptor.providerTargets).map((service) => ({
    service,
    modelsKey: descriptor.selections[service]!.modelsKey
  })) as GenerationPricingProviders<TDescriptor>

export const deriveGenerationResumeModelFields = <const TDescriptor extends GenerationSelectionDescriptor>(
  descriptor: TDescriptor
): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.keys(descriptor.providerTargets).map((service) => [
    service,
    descriptor.selections[service]!.modelsKey
  ]))

export const deriveGenerationResumeProviderFlags = <const TDescriptor extends GenerationSelectionDescriptor>(
  descriptor: TDescriptor,
  ...shortcutFlags: readonly string[]
): readonly string[] => [...shortcutFlags, ...Object.values(descriptor.providerTargets)]

export const TTS_GENERATION_SELECTION = defineGenerationSelectionDescriptor(
  STANDALONE_TTS_PROVIDER_TARGETS,
  {
    elevenlabs: { modelsKey: 'elevenlabsTtsModels' },
    minimax: { modelsKey: 'minimaxTtsModels' },
    groq: { modelsKey: 'groqTtsModels' },
    grok: { modelsKey: 'grokTtsModels' },
    mistral: { modelsKey: 'mistralTtsModels' },
    openai: { modelsKey: 'openaiTtsModels' },
    gemini: { modelsKey: 'geminiTtsModels' },
    deepgram: { modelsKey: 'deepgramTtsModels' },
    speechify: { modelsKey: 'speechifyTtsModels' },
    hume: { modelsKey: 'humeTtsModels' },
    cartesia: { modelsKey: 'cartesiaTtsModels' },
    fish: { modelsKey: 'fishTtsModels' },
    inworld: { modelsKey: 'inworldTtsModels' },
    deepinfra: { modelsKey: 'deepinfraTtsModels' },
    replicate: { modelsKey: 'replicateTtsModels' },
    fal: { modelsKey: 'falTtsModels' }
  }
)

export const IMAGE_GENERATION_SELECTION = defineGenerationSelectionDescriptor(
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  {
    gemini: { modelsKey: 'geminiImageModels' },
    openai: { modelsKey: 'openaiImageModels' },
    grok: { modelsKey: 'grokImageModels' },
    bfl: { modelsKey: 'bflImageModels' },
    replicate: { modelsKey: 'replicateImageModels' },
    lumalabs: { modelsKey: 'lumalabsImageModels' },
    fal: { modelsKey: 'falImageModels' }
  }
)

export const VIDEO_GENERATION_SELECTION = defineGenerationSelectionDescriptor(
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  {
    gemini: { modelsKey: 'geminiVideoModels' },
    grok: { modelsKey: 'grokVideoModels' },
    ltx: { modelsKey: 'ltxVideoModels' },
    replicate: { modelsKey: 'replicateVideoModels' },
    lumalabs: { modelsKey: 'lumalabsVideoModels' },
    fal: { modelsKey: 'falVideoModels' }
  }
)

export const MUSIC_GENERATION_SELECTION = defineGenerationSelectionDescriptor(
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  {
    elevenlabs: { modelsKey: 'elevenlabsMusicModels' },
    minimax: { modelsKey: 'minimaxMusicModels' },
    gemini: { modelsKey: 'geminiMusicModels' }
  }
)

export const WRITE_STT_PROVIDER_TARGETS = {
  deepinfra: 'deepinfra-stt',
  deepgram: 'deepgram-stt',
  soniox: 'soniox-stt',
  speechmatics: 'speechmatics-stt',
  groq: 'groq-stt',
  grok: 'grok-stt',
  mistral: 'mistral-stt',
  assemblyai: 'assemblyai-stt',
  gladia: 'gladia-stt',
  happyscribe: 'happyscribe-stt',
  supadata: 'supadata-stt',
  scrapecreators: 'scrapecreators-stt',
  gemini: 'gemini-stt',
  together: 'together-stt',
  whisper: 'whisper-stt',
  whisperfile: 'whisperfile-stt'
} as const satisfies Record<string, string>

export const WRITE_OCR_PROVIDER_TARGETS = {
  tesseract: 'tesseract-ocr',
  mistral: 'mistral-ocr',
  glm: 'glm-ocr',
  kimi: 'kimi-ocr',
  openai: 'openai-ocr',
  grok: 'grok-ocr',
  anthropic: 'anthropic-ocr',
  gemini: 'gemini-ocr',
  deepinfra: 'deepinfra-ocr'
} as const satisfies Record<string, string>

export const WRITE_LLM_PROVIDER_TARGETS = {
  openai: 'openai',
  groq: 'groq',
  gemini: 'gemini',
  anthropic: 'anthropic',
  minimax: 'minimax',
  grok: 'grok',
  glm: 'glm',
  kimi: 'kimi',
  together: 'together',
  cerebras: 'cerebras'
} as const satisfies Record<string, string>

export const WRITE_LLM_GENERATION_SELECTION = defineGenerationSelectionDescriptor(
  WRITE_LLM_PROVIDER_TARGETS,
  {
    openai: { modelsKey: 'openaiModels' },
    groq: { modelsKey: 'groqModels' },
    gemini: { modelsKey: 'geminiModels' },
    anthropic: { modelsKey: 'anthropicModels' },
    minimax: { modelsKey: 'minimaxModels' },
    grok: { modelsKey: 'grokModels' },
    glm: { modelsKey: 'glmModels' },
    kimi: { modelsKey: 'kimiModels' },
    together: { modelsKey: 'togetherModels' },
    cerebras: { modelsKey: 'cerebrasModels' }
  }
)

export const BOOLEAN_PROVIDER_TARGETS = new Set<string>([
  'tesseract-ocr'
])
