import * as v from 'valibot'

const ModelArraySchema = v.optional(v.array(v.string()), undefined)

const PricingConfigSchema = v.strictObject({
  maxCents: v.optional(v.pipe(v.number(), v.minValue(0)), undefined)
})

const AuthConfigSchema = v.strictObject({
  cookies: v.optional(v.string(), undefined),
  cookiesFromBrowser: v.optional(v.string(), undefined)
})

const ConcurrencyDefaultsSchema = v.strictObject({
  mode: v.optional(v.picklist(['ramp', 'immediate']), undefined)
})

const ExtractSttDefaultsSchema = v.strictObject({
  whisper: ModelArraySchema,
  youtubeCaptions: v.optional(v.boolean(), undefined),
  deepinfraStt: ModelArraySchema,
  groqStt: ModelArraySchema,
  grokStt: ModelArraySchema,
  deepgramStt: ModelArraySchema,
  sonioxStt: ModelArraySchema,
  mistralStt: ModelArraySchema,
  assemblyaiStt: ModelArraySchema,
  gladiaStt: ModelArraySchema,
  happyscribeStt: ModelArraySchema,
  happyscribeOrganizationId: v.optional(v.string(), undefined),
  supadataStt: ModelArraySchema,
  scrapecreatorsStt: ModelArraySchema,
  geminiStt: ModelArraySchema,
  togetherStt: ModelArraySchema,
  whisperfile: ModelArraySchema,
  supadataLang: v.optional(v.string(), undefined),
  scrapecreatorsLang: v.optional(v.string(), undefined),
  speechmaticsStt: ModelArraySchema,
  speakerCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  split: v.optional(v.boolean(), undefined),
  providerConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  localConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  segmentConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  preflightConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const LlmDefaultsSchema = v.strictObject({
  openai: ModelArraySchema,
  groq: ModelArraySchema,
  gemini: ModelArraySchema,
  anthropic: ModelArraySchema,
  minimax: ModelArraySchema,
  grok: ModelArraySchema,
  glm: ModelArraySchema,
  kimi: ModelArraySchema,
  together: ModelArraySchema,
  cerebras: ModelArraySchema,
  providerConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  localConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const StringOrStringListSchema = v.optional(v.union([v.string(), v.array(v.string())]), undefined)

const TtsDefaultsSchema = v.strictObject({
  elevenlabsTts: ModelArraySchema,
  minimaxTts: ModelArraySchema,
  grokTts: ModelArraySchema,
  mistralTts: ModelArraySchema,
  openaiTts: ModelArraySchema,
  speechifyTts: ModelArraySchema,
  humeTts: ModelArraySchema,
  cartesiaTts: ModelArraySchema,
  fishTts: ModelArraySchema,
  inworldTts: ModelArraySchema,
  deepinfraTts: ModelArraySchema,
  voice: StringOrStringListSchema,
  speed: v.optional(v.union([v.number(), v.string(), v.array(v.string())]), undefined),
  language: StringOrStringListSchema,
  textNormalization: v.optional(v.union([v.boolean(), v.string(), v.array(v.string())]), undefined),
  instructions: StringOrStringListSchema,
  ttsDialogueFormat: v.optional(v.picklist(['screenplay', 'labeled']), undefined),
  ttsSpeakers: v.optional(v.array(v.string()), undefined),
  elevenlabsTtsStability: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1)), undefined),
  elevenlabsTtsSimilarityBoost: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1)), undefined),
  elevenlabsTtsStyle: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1)), undefined),
  elevenlabsTtsUseSpeakerBoost: v.optional(v.boolean(), undefined),
  elevenlabsTtsSeed: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), undefined),
  elevenlabsTtsPronunciationDictionaryLocators: v.optional(v.array(v.string()), undefined),
  minimaxTtsVolume: v.optional(v.pipe(v.number(), v.check(value => value > 0, 'Expected a number greater than 0'), v.maxValue(10)), undefined),
  minimaxTtsPitch: v.optional(v.pipe(v.number(), v.integer(), v.minValue(-12), v.maxValue(12)), undefined),
  minimaxTtsEmotion: v.optional(v.string(), undefined),
  minimaxTtsPronunciations: v.optional(v.array(v.string()), undefined),
  providerConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  chunkConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const ImageDefaultsSchema = v.strictObject({
  geminiImage: ModelArraySchema,
  openaiImage: ModelArraySchema,
  grokImage: ModelArraySchema,
  bflImage: ModelArraySchema,
  replicateImage: ModelArraySchema,
  lumalabsImage: ModelArraySchema,
  falImage: ModelArraySchema,
  aspectRatio: v.optional(v.string(), undefined),
  size: v.optional(v.string(), undefined),
  quality: v.optional(v.string(), undefined),
  format: v.optional(v.string(), undefined),
  background: v.optional(v.string(), undefined),
  count: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  providerConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const VideoDefaultsSchema = v.strictObject({
  geminiVideo: ModelArraySchema,
  grokVideo: ModelArraySchema,
  ltxVideo: v.optional(ModelArraySchema, undefined),
  replicateVideo: v.optional(ModelArraySchema, undefined),
  lumalabsVideo: v.optional(ModelArraySchema, undefined),
  falVideo: v.optional(ModelArraySchema, undefined),
  duration: v.optional(v.pipe(v.number(), v.integer(), v.minValue(-1)), undefined),
  aspectRatio: v.optional(v.string(), undefined),
  resolution: v.optional(v.string(), undefined),
  mode: v.optional(v.string(), undefined),
  inputImage: v.optional(v.string(), undefined),
  lastFrame: v.optional(v.string(), undefined),
  referenceImages: v.optional(v.array(v.string()), undefined),
  inputVideo: v.optional(v.string(), undefined),
  replicateVideoSeed: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(2147483647)), undefined),
  generateAudio: v.optional(v.boolean(), undefined),
  referenceVideos: v.optional(v.array(v.string()), undefined),
  referenceAudios: v.optional(v.array(v.string()), undefined),
  replicateVideoNegativePrompt: v.optional(v.string(), undefined),
  providerConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const MusicDefaultsSchema = v.strictObject({
  elevenlabsMusic: ModelArraySchema,
  minimaxMusic: ModelArraySchema,
  geminiMusic: ModelArraySchema,
  duration: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  instrumental: v.optional(v.boolean(), undefined),
  providerConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const ExtractOcrDefaultsSchema = v.strictObject({
  ocrLanguage: v.optional(v.string(), undefined),
  format: v.optional(v.picklist(['text', 'json']), undefined),
  tesseract: v.optional(v.boolean(), undefined),
  dpi: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  ocrConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  providerConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  localConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  mistralOcr: ModelArraySchema,
  glmOcr: ModelArraySchema,
  kimiOcr: ModelArraySchema,
  openaiOcr: ModelArraySchema,
  grokOcr: ModelArraySchema,
  anthropicOcr: ModelArraySchema,
  geminiOcr: ModelArraySchema,
  deepinfraOcr: ModelArraySchema,
  chapters: v.optional(v.boolean(), undefined),
  length: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  pdfChapterMode: v.optional(v.picklist(['local', 'auto', 'llm']), undefined),
  providerMode: v.optional(v.picklist(['fanout', 'pool']), undefined)
})

const ExtractUrlDefaultsSchema = v.strictObject({
  provider: v.optional(v.picklist(['defuddle', 'firecrawl', 'glm-reader', 'spider', 'supadata', 'zyte']), undefined)
})

const ExtractDefaultsSchema = v.strictObject({
  stt: v.optional(ExtractSttDefaultsSchema, undefined),
  ocr: v.optional(ExtractOcrDefaultsSchema, undefined),
  url: v.optional(ExtractUrlDefaultsSchema, undefined)
})

const BatchDefaultsSchema = v.strictObject({
  limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  order: v.optional(v.picklist(['newest', 'oldest']), undefined),
  concurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const ConfigDefaultsSchema = v.strictObject({
  concurrency: v.optional(ConcurrencyDefaultsSchema, undefined),
  llm: v.optional(LlmDefaultsSchema, undefined),
  tts: v.optional(TtsDefaultsSchema, undefined),
  image: v.optional(ImageDefaultsSchema, undefined),
  video: v.optional(VideoDefaultsSchema, undefined),
  music: v.optional(MusicDefaultsSchema, undefined),
  extract: v.optional(ExtractDefaultsSchema, undefined),
  batch: v.optional(BatchDefaultsSchema, undefined),
  prompts: v.optional(v.array(v.string()), undefined)
})

export const AutoshowConfigSchema = v.strictObject({
  defaults: v.optional(ConfigDefaultsSchema, undefined),
  pricing: v.optional(PricingConfigSchema, undefined),
  auth: v.optional(AuthConfigSchema, undefined)
})
