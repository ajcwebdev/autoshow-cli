import type * as v from 'valibot'
import type { JsonObject, NormalizedReasoningEffort, RateEstimateBase, ResolvedLLMModelOptions, Step3Metadata } from '~/types'
export type LLMOptions = Partial<ResolvedLLMModelOptions> & {
  outputDir: string
  prompts?: string[] | undefined
  promptFile?: string | undefined
  promptMd?: boolean | undefined
  llmProviderConcurrency?: number | undefined
  llmLocalConcurrency?: number | undefined
  reasoningEffort?: NormalizedReasoningEffort | undefined
  concurrencyMode?: import('~/types').HostedConcurrencyMode | undefined
  hostedConcurrencyCoordinator?: import('~/types').HostedConcurrencyCoordinator | undefined
  promptBuilder?: ((instruction: string) => string) | undefined
  modelCostFilterExcludedTargetKeys?: string[] | undefined
  structuredContext?: {
    songLyricsTitle?: string | undefined
  } | undefined
}


export type StructuredStrategy = 'native' | 'schema-guided'

export type StructuredRequestOptions = {
  schemaName: string
  schema: JsonObject
  strict: boolean
  strategy: StructuredStrategy
  requestedReasoningEffort?: NormalizedReasoningEffort | undefined
  effectiveReasoningEffort?: NormalizedReasoningEffort | undefined
}

export type StructuredValidationContext = {
  leafPromptNames: string[]
  presetNames: string[]
  songLyricsTitle?: string | undefined
}

export type StructuredRunResult = {
  metadata: Step3Metadata
  renderedText: string
  parsedJson: unknown
}

export type ValibotSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>

export type ResolvedStructuredSchema = {
  schemaName: string
  leafPromptNames: string[]
  presetNames: string[]
  schema: ValibotSchema
  jsonSchema: JsonObject
}


export type StructuredValidationResult = {
  success: boolean
  value?: unknown
  issue?: string
}

export type LLMService = Step3Metadata['llmService']

export type StructuredPresetName =
  | 'shortSummary'
  | 'longSummary'
  | 'bulletPoints'
  | 'takeaways'
  | 'quotes'
  | 'titles'
  | 'metadata'
  | 'faq'
  | 'questions'
  | 'chapterTitles'
  | 'chapterTitlesAndQuotes'
  | 'shortChapters'
  | 'mediumChapters'
  | 'longChapters'
  | 'keyMoments'
  | 'blog'
  | 'youtubeDescription'
  | 'seoArticle'
  | 'contentStrategy'
  | 'emailNewsletter'
  | 'pdfChapterBoundaries'
  | 'x'
  | 'tiktok'
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'standardSongLyrics'
  | 'rapSongLyrics'
  | 'rapSongLongLyrics'
  | 'rapSongChapterLyrics'
  | 'poetryCollection'
  | 'screenplay'
  | 'shortStory'


export type LlmRateEstimate = RateEstimateBase & {
  inputCostPer1MCents: number
  outputCostPer1MCents: number
}
