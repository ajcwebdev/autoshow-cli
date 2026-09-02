import type * as v from 'valibot'
import type { ComicPanelSelection, DraftScenesCommandOptions, GenerateImagesCommandOptions, LocationView } from '~/types'

export type ImageGenerationSize =
  | (typeof import('../image-workflow/image-services-image-types').IMAGE_GENERATION_SIZES)[number]
  | `${number}x${number}`

export type ImageGenerationQuality = (typeof import('../image-workflow/image-services-image-types').IMAGE_GENERATION_QUALITIES)[number]

export type GeneratedImageUsage = {
  imageInputUnits?: number | undefined
  textInputUnits?: number | undefined
  totalInputUnits?: number | undefined
  outputUnits?: number | undefined
  totalUnits?: number | undefined
}

export type GeneratedImageResponse = {
  mode: 'edit' | 'generate'
  result: {
    imageBase64: string
    mimeType?: string
  }
  usage?: GeneratedImageUsage | undefined
}

export type ImageRunStats = {
  imagesGenerated: number
  imagesSkipped: number
  totalInputTokens: number
  totalInputTextTokens: number
  totalInputImageTokens: number
  totalInputUnattributedTokens: number
  totalOutputTokens: number
  totalOutputTextTokens: number
  totalOutputImageTokens: number
  totalOutputUnattributedTokens: number
  totalCost: number
  totalDurationMs: number
}

export type LlmModel = string

export type ImageGenerationModel = string

export type PromptsConfig = v.InferOutput<typeof import('~/cli/commands/process-steps/step-8-comic/schemas/schemas').PromptsConfigSchema>

export type StructuredScriptData = v.InferOutput<typeof import('~/cli/commands/process-steps/step-8-comic/schemas/schemas').StructuredScriptDataSchema>

export type StructuredScriptSourceSegment = StructuredScriptData['sourceSegments'][number]

export type ScenePromptData = v.InferOutput<typeof import('~/cli/commands/process-steps/step-8-comic/schemas/schemas').ScenePromptDataSchema>

export type ParsedGenerateBaseArgs = {
  showHelp: boolean
  price?: boolean
  scriptPath: string
  panels?: ComicPanelSelection
  panelsPerImage?: number
  grid?: GenerateImagesCommandOptions['grid']
  variations?: GenerateImagesCommandOptions['variations']
  target?: NonNullable<GenerateImagesCommandOptions['target']>
  imageModels?: ParsedImageModel[]
  size?: ParsedImageSize
  quality?: ParsedImageQuality
  force?: boolean
  concurrency?: number
  qa?: boolean
  qaOnly?: boolean
  revisionPlan?: string
  comparisonPasses?: number
  promote?: 'clear-winners'
  qaModel?: ParsedLlmModel
  maxRepairs?: number
  continuityQa?: boolean
  continuityOnly?: boolean
  labels?: string
  trustedAnchorPanel?: number
  blockingHardKeys?: NonNullable<GenerateImagesCommandOptions['blockingHardKeys']>
  blockingLayoutGuide?: boolean
  stopOnProviderError?: boolean
  creditPreflight?: boolean
  bloopers?: boolean
  concurrencyMode?: import('~/types').HostedConcurrencyMode
}

export type ParsedImageSize = NonNullable<GenerateImagesCommandOptions['size']>

export type ParsedImageQuality = NonNullable<GenerateImagesCommandOptions['quality']>

export type ParsedImageModel = NonNullable<GenerateImagesCommandOptions['imageModels']>[number]

export type ParsedLlmModel = NonNullable<DraftScenesCommandOptions['llmModel']>

export type ParsedDraftCommandArgs = {
  scriptPath: string
  llmModel?: ParsedLlmModel
  only?: NonNullable<DraftScenesCommandOptions['only']>
  showHelp: boolean
  price?: boolean
  concurrency?: number
  concurrencyMode?: import('~/types').HostedConcurrencyMode
  blocking?: boolean
  blockingPlan?: string
  rebind?: boolean
  reconcileFromDirectives?: boolean
}

export type PanelBundleData = v.InferOutput<typeof import('~/cli/commands/process-steps/step-8-comic/schemas/schemas').PanelBundleDataSchema>

export type ResolvedReferenceImages = {
  all: string[]
  primaryCharacterRefs: string[]
  priorPanelRefs: string[]
  secondaryRefs: string[]
  missingPrimaryCharacterRefs: string[]
  characterReferences?: Array<{
    key: string
    name: string
    description: string
    referenceIndex: number
    path: string
  }>
  locationReferences?: Array<{
    key: string
    snapshotId: string
    specification: string
    referenceIndex: number
    path: string
    view?: LocationView | undefined
    supplementalViews?: Array<{ view: LocationView; referenceIndex: number; path: string; label: string }> | undefined
  }>
  designReferences?: Array<{
    key: string
    usage: string
    referenceIndex: number
    path: string
  }>
  rosterCharacterReferences?: Array<{
    key: string
    name: string
    path: string
  }>
}

export type PrimaryCharacterReferenceState = Pick<
  ResolvedReferenceImages,
  'primaryCharacterRefs' | 'missingPrimaryCharacterRefs' | 'characterReferences' | 'rosterCharacterReferences'
>
