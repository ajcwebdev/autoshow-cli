import type * as v from 'valibot'
import type { JsonObject, LLMModelOptionKey, ProcessingOptions, RateEstimateBase, Step3Metadata } from '~/types'
export type LLMOptions = Pick<ProcessingOptions,
  | 'outputDir'
  | 'prompts'
  | 'promptFile'
  | 'promptMd'
  | LLMModelOptionKey
  | 'llmProviderConcurrency'
  | 'llmLocalConcurrency'
  | 'reasoningEffort'
> & {
  concurrencyMode?: import('~/types').HostedConcurrencyMode | undefined
  hostedConcurrencyCoordinator?: import('~/types').HostedConcurrencyCoordinator | undefined
  promptBuilder?: ((instruction: string) => string) | undefined
  structuredContext?: {
    songLyricsTitle?: string | undefined
  } | undefined
}


export type DownloadInfo = {
  sourceUrl: string
  destinationPath: string
}

export type StructuredStrategy = 'native' | 'schema-guided'

export type StructuredRequestOptions = {
  schemaName: string
  schema: JsonObject
  strict: boolean
  strategy: StructuredStrategy
  requestedReasoningEffort?: import('~/cli/commands/setup-and-utilities/models/reasoning-resolver').NormalizedReasoningEffort | undefined
  effectiveReasoningEffort?: import('~/cli/commands/setup-and-utilities/models/reasoning-resolver').NormalizedReasoningEffort | undefined
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
