import type { BatchOrder, HostedTtsChunkScheduler, HtmlArticleBackend, OcrConcurrencyMode, ResourceGate } from '~/types'

const PROCESS_COMMANDS = ['metadata', 'download', 'extract', 'write', 'tts', 'image', 'video', 'music'] as const

export type ProcessCommand = typeof PROCESS_COMMANDS[number]

export const OUTPUT_FORMATS = ['text', 'json', 'tsv', 'hocr'] as const
export type OutputFormat = typeof OUTPUT_FORMATS[number]

export type Step2ProviderSelectionOrigin = 'default' | 'explicit' | 'all-shortcut'

export type RuntimeOptions = {
  outputRootDir: string
  configPath: string | undefined
  useReverb: boolean
  youtubeCaptions: boolean
  whisperExplicit: boolean
  step2SelectionOrigins: Partial<Record<string, Step2ProviderSelectionOrigin>>
  llamaModels: string[] | undefined
  llamaModel: string | undefined
  llamafileModels: string[] | undefined
  llamafileModel: string | undefined
  openaiModels: string[] | undefined
  openaiModel: string | undefined
  groqModels: string[] | undefined
  groqModel: string | undefined
  geminiModels: string[] | undefined
  geminiModel: string | undefined
  anthropicModels: string[] | undefined
  anthropicModel: string | undefined
  minimaxModels: string[] | undefined
  minimaxModel: string | undefined
  grokModels: string[] | undefined
  grokModel: string | undefined
  glmModels: string[] | undefined
  glmModel: string | undefined
  kimiModels: string[] | undefined
  kimiModel: string | undefined
  togetherModels: string[] | undefined
  togetherModel: string | undefined
  cerebrasModels: string[] | undefined
  cerebrasModel: string | undefined
  whisperModels: string[] | undefined
  whisperModel: string
  whisperfileModels: string[] | undefined
  whisperfileModel: string | undefined
  deepinfraSttModels: string[] | undefined
  deepinfraSttModel: string | undefined
  groqSttModels: string[] | undefined
  groqSttModel: string | undefined
  grokSttModels: string[] | undefined
  grokSttModel: string | undefined
  sonioxSttModels: string[] | undefined
  sonioxSttModel: string | undefined
  revSttModels: string[] | undefined
  revSttModel: string | undefined
  mistralSttModels: string[] | undefined
  mistralSttModel: string | undefined
  assemblyaiSttModels: string[] | undefined
  assemblyaiSttModel: string | undefined
  gladiaSttModels: string[] | undefined
  gladiaSttModel: string | undefined
  happyscribeSttModels: string[] | undefined
  happyscribeSttModel: string | undefined
  happyscribeOrganizationId: string | undefined
  supadataSttModels: string[] | undefined
  supadataSttModel: string | undefined
  scrapecreatorsSttModels: string[] | undefined
  scrapecreatorsSttModel: string | undefined
  geminiSttModels: string[] | undefined
  geminiSttModel: string | undefined
  togetherSttModels: string[] | undefined
  togetherSttModel: string | undefined
  supadataLang: string | undefined
  scrapecreatorsLang: string | undefined
  speechmaticsSttModels: string[] | undefined
  speechmaticsSttModel: string | undefined
  deepgramSttModels: string[] | undefined
  deepgramSttModel: string | undefined
  diarizationSpeakerCount: number | undefined
  sttProviderConcurrency: number
  sttLocalConcurrency: number
  sttSegmentConcurrency: number
  sttPreflightConcurrency: number
  ocrConcurrency: number | undefined
  ocrConcurrencyMode: OcrConcurrencyMode
  ocrProviderConcurrency: number
  ocrLocalConcurrency: number
  keepOcrPageInputs: boolean
  llmProviderConcurrency: number
  llmLocalConcurrency: number
  ttsProviderConcurrency: number
  ttsLocalConcurrency: number
  ttsChunkConcurrency: number
  generationResourceGate?: ResourceGate | undefined
  hostedTtsChunkScheduler?: HostedTtsChunkScheduler | undefined
  imageProviderConcurrency: number
  imageLocalConcurrency: number
  videoProviderConcurrency: number
  videoLocalConcurrency: number
  musicProviderConcurrency: number
  musicLocalConcurrency: number
  price: boolean
  allowOverBudget: boolean
  reverbVerbatimicity: number
  split: boolean
  skipLLM: boolean
  dpi: number
  lang: string
  out: OutputFormat
  password: string | undefined
  useTesseract: boolean
  mistralOcrModels: string[] | undefined
  mistralOcrModel: string | undefined
  glmOcrModels: string[] | undefined
  glmOcrModel: string | undefined
  kimiOcrModels: string[] | undefined
  kimiOcrModel: string | undefined
  openaiOcrModels: string[] | undefined
  openaiOcrModel: string | undefined
  grokOcrModels: string[] | undefined
  grokOcrModel: string | undefined
  anthropicOcrModels: string[] | undefined
  anthropicOcrModel: string | undefined
  geminiOcrModels: string[] | undefined
  geminiOcrModel: string | undefined
  deepinfraOcrModels: string[] | undefined
  deepinfraOcrModel: string | undefined
  primaryOcr: string | undefined
  chapterFiles: boolean | undefined
  chapterChunkLimitChars: number | undefined
  pdfChapterMode: 'local' | 'auto' | 'llm'
  useEpubBun: boolean
  urlBackend: HtmlArticleBackend
  urlBackendExplicit: boolean
  urlBackends: HtmlArticleBackend[] | undefined
  urlProviderConcurrency: number
  urlRequestTimeoutMs: number
  urlRequestAttempts: number

  batchLimit: number
  batchAll: boolean
  batchOrder: BatchOrder
  batchConcurrency: number
  keepOriginalMedia: boolean
  bestQuality: boolean
  flatBatch: boolean
  ytDlpPassthroughArgs: string[] | undefined

  ttsSpeaker: string

  prompts: string[]
  promptFile: string | undefined
  textInput: boolean
  renderedText: boolean
  renderedOutDir: string | undefined
  trackList: string | undefined
  promptMd: boolean

  kittenTtsModels: string[] | undefined
  kittenTtsModel: string | undefined
  groqTtsModels: string[] | undefined
  groqTtsModel: string | undefined
  groqVoiceId: string | undefined
  grokTtsModels: string[] | undefined
  grokTtsModel: string | undefined
  grokTtsVoice: string | undefined
  grokTtsLanguage: string | undefined
  grokTtsTextNormalization: boolean
  mistralTtsModels: string[] | undefined
  mistralTtsModel: string | undefined
  mistralTtsVoice: string | undefined
  mistralTtsRefAudio: string | undefined
  mistralTtsVoiceName: string | undefined
  ttsDialogueFormat: 'screenplay' | 'labeled' | undefined
  ttsSpeakers: string[] | undefined
  openaiTtsModels: string[] | undefined
  openaiTtsModel: string | undefined
  openaiVoiceId: string | undefined
  openaiTtsInstructions: string | undefined
  openaiTtsSpeed: number | undefined
  geminiTtsModels: string[] | undefined
  geminiTtsModel: string | undefined
  geminiVoiceId: string | undefined
  elevenlabsTtsModels: string[] | undefined
  elevenlabsTtsModel: string | undefined
  elevenlabsVoiceId: string | undefined
  elevenlabsTtsRefAudio: string | undefined
  elevenlabsTtsVoiceName: string | undefined
  elevenlabsTtsCloneRemoveBackgroundNoise: boolean
  elevenlabsTtsOutputFormat: string | undefined
  elevenlabsTtsLanguageCode: string | undefined
  elevenlabsTtsStability: number | undefined
  elevenlabsTtsSimilarityBoost: number | undefined
  elevenlabsTtsStyle: number | undefined
  elevenlabsTtsUseSpeakerBoost: boolean
  elevenlabsTtsSpeed: number | undefined
  elevenlabsTtsSeed: number | undefined
  elevenlabsTtsTextNormalization: string | undefined
  elevenlabsTtsPronunciationDictionaryLocators: string[] | undefined
  elevenlabsTtsOptimizeStreamingLatency: number | undefined
  deepgramTtsModels: string[] | undefined
  deepgramTtsModel: string | undefined
  deepgramVoiceId: string | undefined
  deepgramTtsEncoding: string | undefined
  deepgramTtsContainer: string | undefined
  deepgramTtsBitRate: number | undefined
  deepgramTtsSampleRate: number | undefined
  deepgramTtsSpeed: number | undefined
  speechifyTtsModels: string[] | undefined
  speechifyTtsModel: string | undefined
  speechifyVoice: string | undefined
  speechifyTtsAudioFormat: string | undefined
  speechifyTtsLanguage: string | undefined
  speechifyTtsRefAudio: string | undefined
  speechifyTtsVoiceName: string | undefined
  speechifyTtsConsentName: string | undefined
  speechifyTtsConsentEmail: string | undefined
  speechifyTtsVoiceLocale: string | undefined
  speechifyTtsVoiceGender: string | undefined
  humeTtsModels: string[] | undefined
  humeTtsModel: string | undefined
  humeTtsVoice: string | undefined
  humeTtsVoiceProvider: string | undefined
  cartesiaTtsModels: string[] | undefined
  cartesiaTtsModel: string | undefined
  cartesiaTtsVoice: string | undefined
  cartesiaTtsLanguage: string | undefined
  minimaxTtsModels: string[] | undefined
  minimaxTtsModel: string | undefined
  minimaxTtsVoice: string | undefined
  minimaxTtsLanguageBoost: string | undefined
  minimaxTtsSpeed: number | undefined
  minimaxTtsVolume: number | undefined
  minimaxTtsPitch: number | undefined
  minimaxTtsEmotion: string | undefined
  minimaxTtsEnglishNormalization: boolean
  minimaxTtsPronunciations: string[] | undefined
  geminiImageModels: string[] | undefined
  geminiImageModel: string | undefined
  openaiImageModels: string[] | undefined
  openaiImageModel: string | undefined
  grokImageModels: string[] | undefined
  grokImageModel: string | undefined
  bflImageModels: string[] | undefined
  bflImageModel: string | undefined
  recraftImageModels: string[] | undefined
  recraftImageModel: string | undefined
  replicateImageModels: string[] | undefined
  replicateImageModel: string | undefined
  lumalabsImageModels: string[] | undefined
  lumalabsImageModel: string | undefined
  falImageModels: string[] | undefined
  falImageModel: string | undefined
  imageAspectRatio: string | undefined
  imageSize: string | undefined
  imageQuality: string | undefined
  imageFormat: string | undefined
  imageBackground: string | undefined
  imageCount: number | undefined
  imageInputs: string[] | undefined
  imageMask: string | undefined
  imageResponseMode: string | undefined
  geminiSearchGrounding: boolean | undefined
  imageCompression: number | undefined

  elevenlabsMusicModels: string[] | undefined
  elevenlabsMusicModel: string | undefined
  minimaxMusicModels: string[] | undefined
  minimaxMusicModel: string | undefined
  geminiMusicModels: string[] | undefined
  geminiMusicModel: string | undefined
  musicDuration: number | undefined
  musicLyricsFile: string | undefined
  musicInstrumental: boolean | undefined

  geminiVideoModels: string[] | undefined
  geminiVideoModel: string | undefined
  minimaxVideoModels: string[] | undefined
  minimaxVideoModel: string | undefined
  glmVideoModels: string[] | undefined
  glmVideoModel: string | undefined
  grokVideoModels: string[] | undefined
  grokVideoModel: string | undefined
  runwayVideoModels: string[] | undefined
  runwayVideoModel: string | undefined
  ltxVideoModels: string[] | undefined
  ltxVideoModel: string | undefined
  replicateVideoModels: string[] | undefined
  replicateVideoModel: string | undefined
  lumalabsVideoModels: string[] | undefined
  lumalabsVideoModel: string | undefined
  falVideoModels: string[] | undefined
  falVideoModel: string | undefined
  allVideo: boolean | undefined
  videoDuration: number | undefined
  videoSize: string | undefined
  videoAspectRatio: string | undefined
  videoResolution: string | undefined
  videoMode: string | undefined
  videoInputImage: string | undefined
  videoLastFrame: string | undefined
  videoReferenceImages: string[] | undefined
  videoInputVideo: string | undefined
  replicateVideoSeed: number | undefined
  replicateVideoGenerateAudio: boolean | undefined
  replicateVideoReferenceVideos: string[] | undefined
  replicateVideoReferenceAudios: string[] | undefined
  replicateVideoNegativePrompt: string | undefined
  replicateVideoAudio: string | undefined
  replicateVideoPromptExpansion: boolean | undefined
  replicateVideoMultiPrompt: string | undefined
  replicateVideoMultiClip: boolean | undefined
  falVideoGenerateAudio: boolean | undefined
  falVideoReferenceVideos: string[] | undefined
  falVideoReferenceAudios: string[] | undefined
  grokVideoStorageFilename: string | undefined
  grokVideoStorageExpiresAfter: number | undefined

  markdown: boolean
  save: boolean
}
