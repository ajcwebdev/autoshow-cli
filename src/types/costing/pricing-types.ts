import type { CostEstimateBase, ExtractionMetadata, HtmlArticleBackend, ImageProvider, MusicProvider, PartialExtractionMetadata, ProviderIdentityBase, ProviderModelBase, Step1Metadata, Step2Metadata, Step3Metadata, Step4Metadata, Step5Metadata, Step6VideoMetadata, Step7MusicMetadata, TimingStepEntry, VideoProvider } from '~/types'

export type SttStepEstimate = CostEstimateBase & {
  step: 'stt'
  durationSeconds: number
  estimateType?: 'heuristic' | 'exact'
}

export type LlmStepEstimate = ProviderModelBase & {
  step: 'llm'
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  estimatedInputTokens?: number
  estimatedOutputTokens?: number
  totalCost: number
  costMultiplier?: number
  pricingBand?: string
  pricingNote?: string
}

export type TtsStepEstimate = ProviderModelBase & {
  step: 'tts'
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
  characterCount?: number
  chunkConcurrency?: number
  totalCost: number
  costMultiplier?: number
  estimateType?: 'heuristic' | 'exact'
  note?: string
  setupCostCents?: number
  setupTimeMs?: number
}

export type ImageStepEstimate = CostEstimateBase<ImageProvider> & {
  step: 'image'
  imageCount: number
}

export type VideoStepEstimate = CostEstimateBase<VideoProvider> & {
  step: 'video'
  durationSeconds: number
}

export type MusicStepEstimate = ProviderModelBase<MusicProvider> & {
  step: 'music'
  totalCost: number
  costMultiplier?: number
  durationSeconds: number
  lyricsSource: 'provided' | 'generated' | 'none'
  note?: string
}

export type ExtractStepEstimate = ProviderModelBase<'tesseract' | 'mistral' | 'glm' | 'kimi' | 'openai' | 'grok' | 'anthropic' | 'gemini' | 'deepinfra' | HtmlArticleBackend> & {
  step: 'extract'
  costPer1kPagesCents?: number
  costPer1kOutputCharsCents?: number
  inputCostPer1MCents?: number
  outputCostPer1MCents?: number
  pricingBand?: string
  pricingNote?: string
  pageCount?: number
  rasterizedPages?: number
  singlePagePdfFallbackPages?: number
  estimatedOutputChars?: number
  promptTokens?: number
  completionTokens?: number
  ocrMode?: string
  tokenEstimateSource?: 'exact' | 'profile' | 'blended-profile' | 'registry'
  tokenEstimateConfidence?: 'none' | 'sparse' | 'healthy'
  tokenProfileSampleCount?: number
  tokenProfilePromptTokensPerPage?: number
  tokenProfileCompletionTokensPerPage?: number
  totalCost: number
  costMultiplier?: number
  estimateType?: 'heuristic' | 'exact'
  note?: string
}

export type StepEstimate =
  | SttStepEstimate
  | ExtractStepEstimate
  | LlmStepEstimate
  | TtsStepEstimate
  | ImageStepEstimate
  | VideoStepEstimate
  | MusicStepEstimate

export type AggregatedPriceEstimate = {
  steps: StepEstimate[]
  totalEstimatedCost: number
  timing?: StepTimingBreakdown | undefined
  notes?: string[]
}

type SttPricingTarget = ProviderIdentityBase<Step2Metadata['transcriptionService']>

type LlmPricingTarget = ProviderIdentityBase<Step3Metadata['llmService']> & {
  inputTokens?: number
  outputTokens?: number
}

type ImagePricingTarget = ProviderIdentityBase<Step5Metadata['imageService']> & {
  count: number
  imageSize?: string
  imageQuality?: string
}

type VideoPricingTarget = ProviderIdentityBase<Step6VideoMetadata['videoGenService']> & {
  durationSeconds?: number
}

type MusicPricingTarget = ProviderIdentityBase<Step7MusicMetadata['musicService']> & {
  durationSeconds?: number
}

export type ComputeActualCostsInput = {
  step1?: Step1Metadata | undefined
  step2?: Step2Metadata | Step2Metadata[] | ExtractionMetadata | ExtractionMetadata[] | undefined
  partialStep2?: PartialExtractionMetadata | PartialExtractionMetadata[] | undefined
  step3?: Step3Metadata | Step3Metadata[] | undefined
  step4?: Step4Metadata | Step4Metadata[] | undefined
  step5?: Step5Metadata | Step5Metadata[] | undefined
  step6?: Step6VideoMetadata | Step6VideoMetadata[] | undefined
  step7?: Step7MusicMetadata | Step7MusicMetadata[] | undefined
  ttsCharacterCount?: number | undefined
  audioDurationSeconds?: number | undefined
}

export type ComputeEstimatedCostsInput = {
  applyCostMultipliers?: boolean | undefined
  sourceUrl?: string | undefined
  sttTargets?: SttPricingTarget[] | undefined
  whisperModel?: string | undefined
  whisperfileModel?: string | undefined
  deepinfraSttModel?: string | undefined
  groqSttModel?: string | undefined
  grokSttModel?: string | undefined
  deepgramSttModel?: string | undefined
  sonioxSttModel?: string | undefined
  speechmaticsSttModel?: string | undefined
  revSttModel?: string | undefined
  mistralSttModel?: string | undefined
  assemblyaiSttModel?: string | undefined
  gladiaSttModel?: string | undefined
  happyscribeSttModel?: string | undefined
  supadataSttModel?: string | undefined
  scrapecreatorsSttModel?: string | undefined
  geminiSttModel?: string | undefined
  togetherSttModel?: string | undefined
  mistralOcrModel?: string | undefined
  glmOcrModel?: string | undefined
  kimiOcrModel?: string | undefined
  openaiOcrModel?: string | undefined
  grokOcrModel?: string | undefined
  anthropicOcrModel?: string | undefined
  geminiOcrModel?: string | undefined
  deepinfraOcrModel?: string | undefined
  extractTargets?: Array<{
    provider: 'tesseract' | 'mistral' | 'glm' | 'kimi' | 'openai' | 'grok' | 'anthropic' | 'gemini' | 'deepinfra' | HtmlArticleBackend
    model: string
    pageCount?: number
    rasterizedPages?: number
    singlePagePdfFallbackPages?: number
    promptTokens?: number
    completionTokens?: number
    ocrMode?: string
    tokenEstimateSource?: 'exact' | 'profile' | 'blended-profile' | 'registry'
    tokenEstimateConfidence?: 'none' | 'sparse' | 'healthy'
    tokenProfileSampleCount?: number
    tokenProfilePromptTokensPerPage?: number
    tokenProfileCompletionTokensPerPage?: number
    quotedCostCents?: number
    estimateType?: 'heuristic' | 'exact'
    note?: string
  }> | undefined
  hostedOcrTokenProfilePath?: string | undefined
  extractPageCount?: number | undefined
  useReverb?: boolean | undefined
  audioDurationSeconds?: number | undefined
  llmTargets?: LlmPricingTarget[] | undefined
  llmService?: string | undefined
  llmModel?: string | undefined
  llmInputTokenCount?: number | undefined
  llmOutputTokenCount?: number | undefined
  skipLLM?: boolean | undefined
  ttsTargets?: Array<ProviderIdentityBase & {
    setupCostCents?: number
    setupTimeMs?: number
    setupNote?: string
  }> | undefined
  ttsService?: string | undefined
  ttsModel?: string | undefined
  ttsCharacterCount?: number | undefined
  imageTargets?: ImagePricingTarget[] | undefined
  geminiImageModel?: string | undefined
  openaiImageModel?: string | undefined
  grokImageModel?: string | undefined
  bflImageModel?: string | undefined
  recraftImageModel?: string | undefined
  replicateImageModel?: string | undefined
  lumalabsImageModel?: string | undefined
  falImageModel?: string | undefined
  imageSize?: string | undefined
  imageQuality?: string | undefined
  imageCount?: number | undefined
  geminiVideoModel?: string | undefined
  minimaxVideoModel?: string | undefined
  glmVideoModel?: string | undefined
  grokVideoModel?: string | undefined
  runwayVideoModel?: string | undefined
  ltxVideoModel?: string | undefined
  replicateVideoModel?: string | undefined
  lumalabsVideoModel?: string | undefined
  falVideoModel?: string | undefined
  videoTargets?: VideoPricingTarget[] | undefined
  videoDuration?: number | undefined
  videoSize?: string | undefined
  videoAspectRatio?: string | undefined
  videoResolution?: string | undefined
  videoMode?: string | undefined
  grokInputImageCount?: number | undefined
  grokInputVideoDurationSeconds?: number | undefined
  replicateVideoReferenceVideoCount?: number | undefined
  elevenlabsMusicModel?: string | undefined
  minimaxMusicModel?: string | undefined
  geminiMusicModel?: string | undefined
  musicTargets?: MusicPricingTarget[] | undefined
  musicDuration?: number | undefined
  musicLyricsFile?: string | undefined
  musicInstrumental?: boolean | undefined
}

export type ComputeEstimatedProcessingTimesInput = {
  sttTargets?: SttPricingTarget[] | undefined
  transcriptionService?: Step2Metadata['transcriptionService'] | undefined
  transcriptionModel?: string | undefined
  audioDurationSeconds?: number | undefined
  mistralOcrModel?: string | undefined
  glmOcrModel?: string | undefined
  kimiOcrModel?: string | undefined
  openaiOcrModel?: string | undefined
  grokOcrModel?: string | undefined
  anthropicOcrModel?: string | undefined
  geminiOcrModel?: string | undefined
  deepinfraOcrModel?: string | undefined
  extractTargets?: Array<{ provider: 'tesseract' | 'mistral' | 'glm' | 'kimi' | 'openai' | 'grok' | 'anthropic' | 'gemini' | 'deepinfra' | HtmlArticleBackend, model: string, pageCount?: number, rasterizedPages?: number, singlePagePdfFallbackPages?: number }> | undefined
  extractPageCount?: number | undefined
  ocrConcurrency?: number | undefined
  ocrConcurrencyMode?: 'auto' | 'fixed' | undefined
  hostedOcrProfilePath?: string | undefined
  ocrProviderConcurrency?: number | undefined
  ocrLocalConcurrency?: number | undefined
  llmTargets?: LlmPricingTarget[] | undefined
  llmService?: Step3Metadata['llmService'] | undefined
  llmModel?: string | undefined
  llmInputTokenCount?: number | undefined
  llmOutputTokenCount?: number | undefined
  skipLLM?: boolean | undefined
  ttsTargets?: Array<ProviderIdentityBase<Step4Metadata['ttsService']> & {
    setupTimeMs?: number
    setupCostCents?: number
    setupNote?: string
    chunkConcurrency?: number
  }> | undefined
  ttsService?: Step4Metadata['ttsService'] | undefined
  ttsModel?: string | undefined
  ttsCharacterCount?: number | undefined
  ttsInputText?: string | undefined
  ttsChunkConcurrency?: number | undefined
  imageTargets?: ImagePricingTarget[] | undefined
  imageService?: Step5Metadata['imageService'] | undefined
  imageModel?: string | undefined
  imageCount?: number | undefined
  videoService?: Step6VideoMetadata['videoGenService'] | undefined
  videoModel?: string | undefined
  videoDurationSeconds?: number | undefined
  videoTargets?: VideoPricingTarget[] | undefined
  videoSize?: string | undefined
  videoAspectRatio?: string | undefined
  videoResolution?: string | undefined
  videoMode?: string | undefined
  musicTargets?: MusicPricingTarget[] | undefined
  musicService?: Step7MusicMetadata['musicService'] | undefined
  musicModel?: string | undefined
  musicDurationSeconds?: number | undefined
}


export type CostSource =
  | 'provider_usage'
  | 'provider_quote'
  | 'response_header'
  | 'computed_usage'
  | 'registry_fallback'
  | 'partial_provider_usage'
  | 'heuristic'
  | 'local_zero'

export type StepCostEntry = {
  step: 'stt' | 'extract' | 'llm' | 'tts' | 'image' | 'video' | 'music'
  provider: string
  model: string
  cost: number
  costSource: CostSource
  inputMetric?: string
  inputValue?: number
  promptTokens?: number
  completionTokens?: number
  ocrMode?: string
  tokenEstimateSource?: 'exact' | 'profile' | 'blended-profile' | 'registry'
  tokenEstimateConfidence?: 'none' | 'sparse' | 'healthy'
  tokenProfileSampleCount?: number
  tokenProfilePromptTokensPerPage?: number
  tokenProfileCompletionTokensPerPage?: number
  pricingBand?: string
  pricingNote?: string
}

export type CostBreakdown<TStep> = {
  totalCost: number
  steps: TStep[]
}

export type ActualCostBreakdown = CostBreakdown<StepCostEntry>

export type EstimatedStepEntry = {
  step: 'stt' | 'extract' | 'llm' | 'tts' | 'image' | 'video' | 'music'
  provider: string
  model: string
  cost: number
  costMultiplier?: number
  durationSeconds?: number
  imageCount?: number
  costPer1kPagesCents?: number
  costPer1kOutputCharsCents?: number
  pageCount?: number
  rasterizedPages?: number
  singlePagePdfFallbackPages?: number
  estimatedOutputChars?: number
  inputCostPer1MCents?: number
  outputCostPer1MCents?: number
  estimatedInputTokens?: number
  estimatedOutputTokens?: number
  promptTokens?: number
  completionTokens?: number
  ocrMode?: string
  tokenEstimateSource?: 'exact' | 'profile' | 'blended-profile' | 'registry'
  tokenEstimateConfidence?: 'none' | 'sparse' | 'healthy'
  tokenProfileSampleCount?: number
  tokenProfilePromptTokensPerPage?: number
  tokenProfileCompletionTokensPerPage?: number
  pricingBand?: string
  pricingNote?: string
  estimateType?: 'heuristic' | 'exact'
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
  setupCostCents?: number
  setupTimeMs?: number
}

export type EstimatedCostBreakdown = CostBreakdown<EstimatedStepEntry>

export type StepTimingBreakdown = {
  totalProcessingTimeMs: number
  sumOfStepProcessingTimeMs?: number | undefined
  steps: TimingStepEntry[]
  estimateConfidence?: 'registry' | 'profile' | 'blended' | undefined
  likelyGatingTargets?: Array<{
    step: TimingStepEntry['step']
    provider: string
    model: string
    processingTimeMs: number
  }> | undefined
}
