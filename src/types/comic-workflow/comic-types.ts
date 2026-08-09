import type * as v from 'valibot'
import type { ComicPanelSelection, DraftScenesCommandOptions, GenerateImagesCommandOptions } from '~/types'


export type ImageGenerationSize =
  | (typeof import('../image-workflow/image-services-image-types').IMAGE_GENERATION_SIZES)[number]
  | `${number}x${number}`

export type ImageGenerationQuality = (typeof import('../image-workflow/image-services-image-types').IMAGE_GENERATION_QUALITIES)[number]


export type GeneratedImageResponse = {
  mode: 'edit' | 'generate'
  result: {
    imageBase64: string
    mimeType?: string
  }
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

// Comic resolves text models against the central LLM registry (llm-config.json) at
// runtime, so the static type is a model id string rather than a comic-local union.
export type LlmModel = string

// Comic resolves image models against the central image registry (image-config.json)
// at runtime, so the static type is a model id string rather than a comic-local union.
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
  qaModel?: ParsedLlmModel
  maxRepairs?: number
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
  }>
  designReferences?: Array<{
    key: string
    usage: string
    referenceIndex: number
    path: string
  }>
}

export type PrimaryCharacterReferenceState = Pick<
  ResolvedReferenceImages,
  'primaryCharacterRefs' | 'missingPrimaryCharacterRefs' | 'characterReferences'
>
