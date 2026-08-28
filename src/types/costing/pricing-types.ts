import type { ActualPipelineInputsBase, CostEstimateBase, CostSource, HostedOcrTokenReasoningPolicy, HtmlArticleBackend, ImageProvider, MusicProvider, NormalizedReasoningEffort, OcrModelOverrideOptions, ProviderIdentityBase, ProviderModelBase, Step1Metadata, Step2Metadata, Step3Metadata, Step4Metadata, Step5Metadata, Step6VideoMetadata, Step7MusicMetadata, SttRuntimeOptions, TimingStepEntry, VideoProvider } from '~/types'

type TokenProfileEstimateFields = {
  tokenEstimateSource?: 'exact' | 'profile' | 'blended-profile' | 'registry'
  tokenEstimateConfidence?: 'none' | 'sparse' | 'healthy'
  tokenProfileSampleCount?: number
  tokenProfilePromptTokensPerPage?: number
  tokenProfileCompletionTokensPerPage?: number
  tokenProfileEffectiveReasoningEffort?: HostedOcrTokenReasoningPolicy
}

type ReasoningEstimateFields = {
  requestedReasoningEffort?: NormalizedReasoningEffort
  effectiveReasoningEffort?: NormalizedReasoningEffort
}

type SttModelOverrides = Partial<Pick<SttRuntimeOptions,
  | 'whisperModels' | 'whisperfileModels' | 'deepinfraSttModels' | 'groqSttModels' | 'grokSttModels' | 'deepgramSttModels'
  | 'sonioxSttModels' | 'speechmaticsSttModels' | 'mistralSttModels' | 'assemblyaiSttModels'
  | 'gladiaSttModels' | 'happyscribeSttModels' | 'supadataSttModels' | 'scrapecreatorsSttModels'
  | 'geminiSttModels' | 'togetherSttModels'
>>

export type SttStepEstimate = CostEstimateBase & {
  step: 'stt'
  durationSeconds: number
  estimateType?: 'heuristic' | 'exact'
}

export type LlmStepEstimate = ProviderModelBase & ReasoningEstimateFields & {
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
  costPerRequestCents?: number
  requestCount?: number
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

export type ExtractStepEstimate = ProviderModelBase<'tesseract' | 'mistral' | 'glm' | 'kimi' | 'openai' | 'grok' | 'anthropic' | 'gemini' | 'deepinfra' | 'replicate' | 'fal' | HtmlArticleBackend> & TokenProfileEstimateFields & ReasoningEstimateFields & {
  step: 'extract'
  costPer1kPagesCents?: number
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
  ocrProviderMode?: 'fanout' | 'pool'
  allocationHeuristic?: boolean
  pageShare?: number
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

export type ComputeActualCostsInput = ActualPipelineInputsBase<Step1Metadata> & {
  audioDurationSeconds?: number | undefined
}

export type ComputeEstimatedCostsInput = SttModelOverrides & OcrModelOverrideOptions & {
  applyCostMultipliers?: boolean | undefined
  sourceUrl?: string | undefined
  sttTargets?: SttPricingTarget[] | undefined
  whisperModels?: string[] | undefined
  extractTargets?: Array<TokenProfileEstimateFields & {
    provider: 'tesseract' | 'mistral' | 'glm' | 'kimi' | 'openai' | 'grok' | 'anthropic' | 'gemini' | 'deepinfra' | 'replicate' | 'fal' | HtmlArticleBackend
    model: string
    pageCount?: number
    rasterizedPages?: number
    singlePagePdfFallbackPages?: number
    promptTokens?: number
    completionTokens?: number
    effectiveReasoningEffort?: NormalizedReasoningEffort
    ocrMode?: string
    ocrProviderMode?: 'fanout' | 'pool'
    quotedCostCents?: number
    estimateType?: 'heuristic' | 'exact'
    note?: string
  }> | undefined
  hostedOcrTokenProfilePath?: string | undefined
  extractPageCount?: number | undefined
  audioDurationSeconds?: number | undefined
  llmTargets?: LlmPricingTarget[] | undefined
  llmService?: string | undefined
  llmModel?: string | undefined
  llmInputTokenCount?: number | undefined
  llmOutputTokenCount?: number | undefined
  ttsTargets?: Array<ProviderIdentityBase & {
    setupCostCents?: number
    setupTimeMs?: number
    setupNote?: string
  }> | undefined
  ttsService?: string | undefined
  ttsModel?: string | undefined
  ttsCharacterCount?: number | undefined
  imageTargets?: ImagePricingTarget[] | undefined
  geminiImageModels?: string[] | undefined
  openaiImageModels?: string[] | undefined
  grokImageModels?: string[] | undefined
  bflImageModels?: string[] | undefined
  replicateImageModels?: string[] | undefined
  lumalabsImageModels?: string[] | undefined
  falImageModels?: string[] | undefined
  imageSize?: string | undefined
  imageQuality?: string | undefined
  imageCount?: number | undefined
  geminiVideoModels?: string[] | undefined
  grokVideoModels?: string[] | undefined
  ltxVideoModels?: string[] | undefined
  replicateVideoModels?: string[] | undefined
  lumalabsVideoModels?: string[] | undefined
  falVideoModels?: string[] | undefined
  videoTargets?: VideoPricingTarget[] | undefined
  videoDuration?: number | undefined
  videoAspectRatio?: string | undefined
  videoResolution?: string | undefined
  videoMode?: string | undefined
  grokInputImageCount?: number | undefined
  grokInputVideoDurationSeconds?: number | undefined
  replicateVideoReferenceVideoCount?: number | undefined
  elevenlabsMusicModels?: string[] | undefined
  minimaxMusicModels?: string[] | undefined
  geminiMusicModels?: string[] | undefined
  musicTargets?: MusicPricingTarget[] | undefined
  musicDuration?: number | undefined
  musicLyricsFile?: string | undefined
  musicInstrumental?: boolean | undefined
}

export type ComputeEstimatedProcessingTimesInput = OcrModelOverrideOptions & {
  concurrencyMode?: import('~/types').HostedConcurrencyMode | undefined
  sttTargets?: SttPricingTarget[] | undefined
  transcriptionService?: Step2Metadata['transcriptionService'] | undefined
  transcriptionModel?: string | undefined
  audioDurationSeconds?: number | undefined
  extractTargets?: Array<{ provider: 'tesseract' | 'mistral' | 'glm' | 'kimi' | 'openai' | 'grok' | 'anthropic' | 'gemini' | 'deepinfra' | 'replicate' | 'fal' | HtmlArticleBackend, model: string, pageCount?: number, rasterizedPages?: number, singlePagePdfFallbackPages?: number, ocrProviderMode?: 'fanout' | 'pool' }> | undefined
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
  ttsTargets?: Array<ProviderIdentityBase<Step4Metadata['ttsService']> & {
    setupTimeMs?: number
    setupCostCents?: number
    setupNote?: string
    chunkConcurrency?: number
    characterCount?: number
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
  videoAspectRatio?: string | undefined
  videoResolution?: string | undefined
  videoMode?: string | undefined
  musicTargets?: MusicPricingTarget[] | undefined
  musicService?: Step7MusicMetadata['musicService'] | undefined
  musicModel?: string | undefined
  musicDurationSeconds?: number | undefined
}

export type StepCostEntry = TokenProfileEstimateFields & {
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
  pricingBand?: string
  pricingNote?: string
}

type CostBreakdown<TStep> = {
  totalCost: number
  steps: TStep[]
}

export type ActualCostBreakdown = CostBreakdown<StepCostEntry>

export type EstimatedStepEntry = TokenProfileEstimateFields & ReasoningEstimateFields & {
  step: 'stt' | 'extract' | 'llm' | 'tts' | 'image' | 'video' | 'music'
  provider: string
  model: string
  cost: number
  costMultiplier?: number
  durationSeconds?: number
  imageCount?: number
  costPer1kPagesCents?: number
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
  pricingBand?: string
  pricingNote?: string
  estimateType?: 'heuristic' | 'exact'
  costPerRequestCents?: number
  requestCount?: number
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
