export const STANDALONE_TTS_PROVIDER_TARGETS = {
  kitten: 'kitten-tts',
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
  recraft: 'recraft-image',
  replicate: 'replicate-image',
  lumalabs: 'lumalabs-image',
  fal: 'fal-image'
} as const satisfies Record<string, string>

export const STANDALONE_VIDEO_PROVIDER_TARGETS = {
  gemini: 'gemini-video',
  minimax: 'minimax-video',
  glm: 'glm-video',
  grok: 'grok-video',
  runway: 'runway-video',
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

type GenerationSelectionField = {
  readonly modelsKey: string
  readonly modelKey: string
}

type GenerationSelectionFields<TProviderTargets extends Readonly<Record<string, string>>> = {
  readonly [Service in keyof TProviderTargets]: GenerationSelectionField
}

type GenerationSelectionDescriptor = {
  readonly providerTargets: Readonly<Record<string, string>>
  readonly selections: Readonly<Record<string, GenerationSelectionField>>
}

type GenerationPricingProviders<TDescriptor extends GenerationSelectionDescriptor> = Array<{
  [Service in keyof TDescriptor['providerTargets'] & keyof TDescriptor['selections'] & string]: {
    service: Service
    modelsKey: TDescriptor['selections'][Service]['modelsKey']
    modelKey: TDescriptor['selections'][Service]['modelKey']
  }
}[keyof TDescriptor['providerTargets'] & keyof TDescriptor['selections'] & string]>

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
    modelsKey: descriptor.selections[service]!.modelsKey,
    modelKey: descriptor.selections[service]!.modelKey
  })) as GenerationPricingProviders<TDescriptor>

export const deriveGenerationResumeModelFields = <const TDescriptor extends GenerationSelectionDescriptor>(
  descriptor: TDescriptor
): Readonly<Record<string, readonly [modelsKey: string, modelKey: string]>> =>
  Object.fromEntries(Object.keys(descriptor.providerTargets).map((service) => [
    service,
    [descriptor.selections[service]!.modelsKey, descriptor.selections[service]!.modelKey] as const
  ]))

export const deriveGenerationResumeProviderFlags = <const TDescriptor extends GenerationSelectionDescriptor>(
  descriptor: TDescriptor,
  ...shortcutFlags: readonly string[]
): readonly string[] => [...shortcutFlags, ...Object.values(descriptor.providerTargets)]

export const TTS_GENERATION_SELECTION = defineGenerationSelectionDescriptor(
  STANDALONE_TTS_PROVIDER_TARGETS,
  {
    kitten: { modelsKey: 'kittenTtsModels', modelKey: 'kittenTtsModel' },
    elevenlabs: { modelsKey: 'elevenlabsTtsModels', modelKey: 'elevenlabsTtsModel' },
    minimax: { modelsKey: 'minimaxTtsModels', modelKey: 'minimaxTtsModel' },
    groq: { modelsKey: 'groqTtsModels', modelKey: 'groqTtsModel' },
    grok: { modelsKey: 'grokTtsModels', modelKey: 'grokTtsModel' },
    mistral: { modelsKey: 'mistralTtsModels', modelKey: 'mistralTtsModel' },
    openai: { modelsKey: 'openaiTtsModels', modelKey: 'openaiTtsModel' },
    gemini: { modelsKey: 'geminiTtsModels', modelKey: 'geminiTtsModel' },
    deepgram: { modelsKey: 'deepgramTtsModels', modelKey: 'deepgramTtsModel' },
    speechify: { modelsKey: 'speechifyTtsModels', modelKey: 'speechifyTtsModel' },
    hume: { modelsKey: 'humeTtsModels', modelKey: 'humeTtsModel' },
    cartesia: { modelsKey: 'cartesiaTtsModels', modelKey: 'cartesiaTtsModel' },
    fish: { modelsKey: 'fishTtsModels', modelKey: 'fishTtsModel' },
    inworld: { modelsKey: 'inworldTtsModels', modelKey: 'inworldTtsModel' },
    deepinfra: { modelsKey: 'deepinfraTtsModels', modelKey: 'deepinfraTtsModel' },
    replicate: { modelsKey: 'replicateTtsModels', modelKey: 'replicateTtsModel' },
    fal: { modelsKey: 'falTtsModels', modelKey: 'falTtsModel' }
  }
)

export const IMAGE_GENERATION_SELECTION = defineGenerationSelectionDescriptor(
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  {
    gemini: { modelsKey: 'geminiImageModels', modelKey: 'geminiImageModel' },
    openai: { modelsKey: 'openaiImageModels', modelKey: 'openaiImageModel' },
    grok: { modelsKey: 'grokImageModels', modelKey: 'grokImageModel' },
    bfl: { modelsKey: 'bflImageModels', modelKey: 'bflImageModel' },
    recraft: { modelsKey: 'recraftImageModels', modelKey: 'recraftImageModel' },
    replicate: { modelsKey: 'replicateImageModels', modelKey: 'replicateImageModel' },
    lumalabs: { modelsKey: 'lumalabsImageModels', modelKey: 'lumalabsImageModel' },
    fal: { modelsKey: 'falImageModels', modelKey: 'falImageModel' }
  }
)

export const VIDEO_GENERATION_SELECTION = defineGenerationSelectionDescriptor(
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  {
    gemini: { modelsKey: 'geminiVideoModels', modelKey: 'geminiVideoModel' },
    minimax: { modelsKey: 'minimaxVideoModels', modelKey: 'minimaxVideoModel' },
    glm: { modelsKey: 'glmVideoModels', modelKey: 'glmVideoModel' },
    grok: { modelsKey: 'grokVideoModels', modelKey: 'grokVideoModel' },
    runway: { modelsKey: 'runwayVideoModels', modelKey: 'runwayVideoModel' },
    ltx: { modelsKey: 'ltxVideoModels', modelKey: 'ltxVideoModel' },
    replicate: { modelsKey: 'replicateVideoModels', modelKey: 'replicateVideoModel' },
    lumalabs: { modelsKey: 'lumalabsVideoModels', modelKey: 'lumalabsVideoModel' },
    fal: { modelsKey: 'falVideoModels', modelKey: 'falVideoModel' }
  }
)

export const MUSIC_GENERATION_SELECTION = defineGenerationSelectionDescriptor(
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  {
    elevenlabs: { modelsKey: 'elevenlabsMusicModels', modelKey: 'elevenlabsMusicModel' },
    minimax: { modelsKey: 'minimaxMusicModels', modelKey: 'minimaxMusicModel' },
    gemini: { modelsKey: 'geminiMusicModels', modelKey: 'geminiMusicModel' }
  }
)

export const WRITE_STT_PROVIDER_TARGETS = {
  reverb: 'reverb-stt',
  deepinfra: 'deepinfra-stt',
  deepgram: 'deepgram-stt',
  soniox: 'soniox-stt',
  speechmatics: 'speechmatics-stt',
  rev: 'rev-stt',
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
  deepinfra: 'deepinfra-ocr',
  replicate: 'replicate-ocr',
  fal: 'fal-ocr'
} as const satisfies Record<string, string>

export const WRITE_LLM_PROVIDER_TARGETS = {
  llama: 'llama',
  llamafile: 'llamafile',
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
    llama: { modelsKey: 'llamaModels', modelKey: 'llamaModel' },
    llamafile: { modelsKey: 'llamafileModels', modelKey: 'llamafileModel' },
    openai: { modelsKey: 'openaiModels', modelKey: 'openaiModel' },
    groq: { modelsKey: 'groqModels', modelKey: 'groqModel' },
    gemini: { modelsKey: 'geminiModels', modelKey: 'geminiModel' },
    anthropic: { modelsKey: 'anthropicModels', modelKey: 'anthropicModel' },
    minimax: { modelsKey: 'minimaxModels', modelKey: 'minimaxModel' },
    grok: { modelsKey: 'grokModels', modelKey: 'grokModel' },
    glm: { modelsKey: 'glmModels', modelKey: 'glmModel' },
    kimi: { modelsKey: 'kimiModels', modelKey: 'kimiModel' },
    together: { modelsKey: 'togetherModels', modelKey: 'togetherModel' },
    cerebras: { modelsKey: 'cerebrasModels', modelKey: 'cerebrasModel' }
  }
)

export const BOOLEAN_PROVIDER_TARGETS = new Set<string>([
  'reverb-stt',
  'tesseract-ocr'
])
