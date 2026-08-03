import type { Dirent } from 'node:fs'
import type { PanelBundleData, GeneratedImageResponse, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, LlmModel, StructuredScriptData } from '~/types'

export type ComicSceneCommandOptionsBase = {
  sceneSlug: string
}

type ComicScriptSceneCommandOptionsBase = ComicSceneCommandOptionsBase & {
  scriptPath: string
}

export type ComicLlmCommandOptionsBase = {
  llmModel?: LlmModel
}

type ComicImageCommandOptionsBase = {
  imageModels?: ImageGenerationModel[]
  size?: ImageGenerationSize
  quality?: ImageGenerationQuality
  force?: boolean
}

type ComicImageRunOptionsBase = {
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
  /** @deprecated Use qa. */
  pageQa?: boolean
  /** @deprecated Use qaModel. */
  pageQaModel?: LlmModel
}

export type CharacterSketchCommandOptions = Omit<ComicImageCommandOptionsBase, 'force'> & {
  character?: string
  revise?: boolean
  notes?: string
  concurrency?: number
}

export type ParsedCharacterSketchArgs = CharacterSketchCommandOptions & { showHelp: boolean; price?: boolean }

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
  & ComicLlmCommandOptionsBase
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
  pageQa?: boolean
  pageQaModel?: LlmModel
  qa?: boolean
  qaModel?: LlmModel
  maxRepairs?: number
}

export type GenerateComicGridPagesOptions = Pick<ComicImageRunOptionsBase, 'models' | 'force' | 'runId' | 'concurrency'> & {
  panels: ComicPanelSelection
  grid: ComicGridSpec
  variations?: ImagePromptVariation[]
}

export type ComicPanelSource = {
  panelDirectory: string
  panelEntries: Dirent[]
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
  judgePage?: (input: import('~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-qa').PageQaRequest) => Promise<import('~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-qa').PageQaEntry>
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

export type CharacterDetails = {
  name: string
  image: string
  description: string
  sketchImages?: string[]
}


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
