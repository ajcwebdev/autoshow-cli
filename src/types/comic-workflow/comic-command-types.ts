import type { DirectoryEntry } from '../runtime-core/filesystem-types'
import type { HostedConcurrencyCoordinator, HostedConcurrencyMode, PageQaEntry, PageQaRequest, PanelBundleData, GeneratedImageResponse, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, LlmModel, StructuredScriptData } from '~/types'

type ComicHostedConcurrencyOptions = {
  concurrencyMode?: HostedConcurrencyMode | undefined
  hostedConcurrencyCoordinator?: HostedConcurrencyCoordinator | undefined
}

export type ComicSceneCommandOptionsBase = ComicHostedConcurrencyOptions & {
  sceneSlug: string
}

type ComicScriptSceneCommandOptionsBase = ComicSceneCommandOptionsBase & {
  scriptPath: string
}

export type ComicLlmCommandOptionsBase = ComicHostedConcurrencyOptions & {
  llmModel?: LlmModel
}

type ComicImageCommandOptionsBase = ComicHostedConcurrencyOptions & {
  imageModels?: ImageGenerationModel[]
  size?: ImageGenerationSize
  quality?: ImageGenerationQuality
  force?: boolean
}

type ComicImageRunOptionsBase = ComicHostedConcurrencyOptions & {
  models: ImageGenerationModel[]
  size: ImageGenerationSize
  quality: ImageGenerationQuality
  force: boolean
  // Per-run timestamp folder that generated images nest under, and the number of
  // image requests to run concurrently within a stage.
  runId: string
  concurrency: number
}

export type ComicPanelSelection = 'all' | number[]

type ComicPanelGenerationOptionsBase = {
  panels?: ComicPanelSelection
  panelsPerImage?: number
  variations?: ImagePromptVariation[]
  qa?: boolean
  qaModel?: LlmModel
  maxRepairs?: number
}

export type CharacterSketchCommandOptions = Omit<ComicImageCommandOptionsBase, 'force'> & {
  character?: string
  revise?: boolean
  notes?: string
  concurrency?: number
}

export type ReferenceSketchCommandOptions = Omit<ComicImageCommandOptionsBase, 'force'> & ComicLlmCommandOptionsBase & {
  character?: string
  location?: string
  view?: 'establishing' | 'reverse' | 'side'
  revise?: boolean
  notes?: string
  qa?: boolean
  qaModel?: LlmModel
  maxRepairs?: number
  concurrency?: number
}

export type ParsedReferenceSketchArgs = ReferenceSketchCommandOptions & { showHelp: boolean; price?: boolean }


export type DraftScenesStage = 'structure' | 'prompt' | 'scene' | 'panel-prompts'

export type DraftScenesCommandOptions = ComicScriptSceneCommandOptionsBase & ComicLlmCommandOptionsBase & {
  only?: DraftScenesStage
  concurrency?: number
}

export type ComicLlmResponseUsage = {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  input_tokens_details?: { cached_tokens?: number } | null
  output_tokens_details?: { reasoning_tokens?: number } | null
}

export type DraftSceneRunStats = {
  filesProcessed: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCachedTokens: number
  totalCost: number
  totalDurationMs: number
}

export type GenerateImagesTarget = 'images' | 'sketches' | 'both'

export type ImagePromptVariation = 'canonical' | 'animation-polish' | 'cinematic-depth'

export type ComicGridSpec = {
  columns: number
  rows: number
}

export type SketchPanelRange =
  | 'all'
  | {
    startPanelNumber: number
    endPanelNumber: number
  }

export type GenerateImagesCommandOptions = ComicScriptSceneCommandOptionsBase
  & ComicImageCommandOptionsBase
  & ComicPanelGenerationOptionsBase
  & {
    target?: GenerateImagesTarget
    grid?: ComicGridSpec
    concurrency?: number
  }

export type GeneratePanelImagesOptions = ComicImageRunOptionsBase
  & Pick<ComicPanelGenerationOptionsBase, 'panels' | 'variations' | 'qa' | 'qaModel' | 'maxRepairs'>

export type ParsedGenerateImagesArgs = GenerateImagesCommandOptions & { showHelp: boolean; price?: boolean }

export type GenerateComicPagesOptions = ComicImageRunOptionsBase & {
  panels: ComicPanelSelection
  panelsPerImage: number
  variations?: ImagePromptVariation[]
  qa?: boolean
  qaModel?: LlmModel
  maxRepairs?: number
}

export type GenerateComicGridPagesOptions = Pick<ComicImageRunOptionsBase, 'models' | 'force' | 'runId' | 'concurrency' | 'concurrencyMode' | 'hostedConcurrencyCoordinator'> & {
  panels: ComicPanelSelection
  grid: ComicGridSpec
  variations?: ImagePromptVariation[]
}

export type ComicPanelSource = {
  panelDirectory: string
  panelEntries: DirectoryEntry[]
  panelNumber: number
  bundleData: PanelBundleData
}

export type ComicImageRequestInput = {
  normalizedPrompt: string
  referenceImages: string[]
  model: ImageGenerationModel
  size: ImageGenerationSize
  quality: ImageGenerationQuality
}

export type ComicImageGenerationDependencies = {
  requestImage?: (input: ComicImageRequestInput) => Promise<GeneratedImageResponse>
  writeImage?: (outputPath: string, imageBase64: string, mimeType?: string) => Promise<void>
  judgePage?: (input: PageQaRequest) => Promise<PageQaEntry>
}

export type ComicPageChunk<T> = {
  pageNumber: number
  panelNumbers: number[]
  panels: T[]
}


export type SketchPanelChunk<T> = {
  startPanelNumber: number
  endPanelNumber: number
  panels: T[]
}

export type GenerateSceneSketchesOptions = ComicImageRunOptionsBase & {
  sketchPanels?: SketchPanelRange
  panelsPerImage?: number
}


export type GenerateSketchesCommandOptions = ComicSceneCommandOptionsBase & ComicImageCommandOptionsBase & {
  sketchPanels?: GenerateSceneSketchesOptions['sketchPanels']
  panelsPerImage?: GenerateSceneSketchesOptions['panelsPerImage']
  runId?: string
  concurrency?: number
}


export type PanelPromptsCommandOptions = ComicSceneCommandOptionsBase & {
  force?: boolean
  concurrency?: number
}

export type CharacterSketchView = (typeof import('~/cli/commands/process-steps/step-8-comic/comic-commands/process-scenes/character-utils').CHARACTER_SKETCH_VIEWS)[number]

export type StructureScriptsCommandOptions = ComicScriptSceneCommandOptionsBase & ComicLlmCommandOptionsBase

export type CharacterMention = StructuredScriptData['beats'][number]['rawMentions'][number]

export type StructuredScriptBeat = StructuredScriptData['beats'][number]


export type StructuredScriptReviewResponse = {
  model: string
  text: string
  usage?: ComicLlmResponseUsage
  requestId?: string
  status?: string
}

export type StructuredScriptRunStats = {
  filesProcessed: number
  llmReviews: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCachedTokens: number
  totalCost: number
  totalDurationMs: number
}
