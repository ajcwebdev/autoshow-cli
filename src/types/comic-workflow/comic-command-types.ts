import type { DirectoryEntry } from '../runtime-core/filesystem-types'
import type { ComicImagePurchaseUsage, HostedConcurrencyRuntimeOptions, PanelBundleData, GeneratedImageResponse, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, LlmModel, StructuredScriptData } from '~/types'


export type ComicSceneCommandOptionsBase = HostedConcurrencyRuntimeOptions & {
  sceneSlug: string
}

type ComicScriptSceneCommandOptionsBase = ComicSceneCommandOptionsBase & {
  scriptPath: string
}

export type ComicLlmCommandOptionsBase = HostedConcurrencyRuntimeOptions & {
  llmModel?: LlmModel
}

type ComicImageCommandOptionsBase = HostedConcurrencyRuntimeOptions & {
  imageModels?: ImageGenerationModel[]
  size?: ImageGenerationSize
  quality?: ImageGenerationQuality
  force?: boolean
}

// Character and reference sketches keep their existing selector shape; final images and scene sketches select exactly one model per run.
type ComicImageAccountingOptions = {
  checkpointPurchase?: ((usage: ComicImagePurchaseUsage) => Promise<void>) | undefined
}

type ComicSingleModelImageCommandOptionsBase = Omit<ComicImageCommandOptionsBase, 'imageModels'> & ComicImageAccountingOptions & {
  imageModel?: ImageGenerationModel
}

type ComicImageRunOptionsBase = HostedConcurrencyRuntimeOptions & ComicImageAccountingOptions & {
  model: ImageGenerationModel
  size: ImageGenerationSize
  quality: ImageGenerationQuality
  force: boolean
  runId: string
  concurrency: number
}

export type ComicPanelSelection = 'all' | number[]

type ComicPanelGenerationOptionsBase = {
  panels?: ComicPanelSelection
  panelsPerImage?: number
  stopOnProviderError?: boolean
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
  concurrency?: number
}

export type ParsedReferenceSketchArgs = ReferenceSketchCommandOptions & { showHelp: boolean; price?: boolean }

export type DraftScenesStage = 'prepare' | 'scene' | 'panel-prompts'

export type DraftScenesCommandOptions = ComicScriptSceneCommandOptionsBase & ComicLlmCommandOptionsBase & {
  only?: DraftScenesStage
  concurrency?: number
  panelCount?: number
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
  & ComicSingleModelImageCommandOptionsBase
  & ComicPanelGenerationOptionsBase
  & {
    target?: GenerateImagesTarget
    recoveryRunId?: string
    grid?: ComicGridSpec
    concurrency?: number
  }

export type GeneratePanelImagesOptions = ComicImageRunOptionsBase
  & Pick<ComicPanelGenerationOptionsBase, 'panels' | 'stopOnProviderError'>

export type ParsedGenerateImagesArgs = GenerateImagesCommandOptions & { showHelp: boolean; price?: boolean }

export type GenerateComicPagesOptions = ComicImageRunOptionsBase & {
  panels: ComicPanelSelection
  panelsPerImage: number
  stopOnProviderError?: boolean
}

export type GenerateComicGridPagesOptions = Pick<ComicImageRunOptionsBase, 'model' | 'force' | 'runId' | 'concurrency' | 'concurrencyMode' | 'hostedConcurrencyCoordinator'> & {
  panels: ComicPanelSelection
  grid: ComicGridSpec
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

export type GenerateSketchesCommandOptions = ComicSceneCommandOptionsBase & ComicSingleModelImageCommandOptionsBase & {
  sketchPanels?: GenerateSceneSketchesOptions['sketchPanels']
  panelsPerImage?: GenerateSceneSketchesOptions['panelsPerImage']
  runId?: string
  concurrency?: number
}

export type PanelPromptsCommandOptions = ComicSceneCommandOptionsBase & {
  force?: boolean
  concurrency?: number
}

export type CharacterSketchView = (typeof import('~/cli/commands/visuals/comic/comic-commands/process-scenes/character-utils').CHARACTER_SKETCH_VIEWS)[number]

export type CharacterMention = StructuredScriptData['beats'][number]['rawMentions'][number]

export type StructuredScriptBeat = StructuredScriptData['beats'][number]

export type StructuredScriptRunStats = {
  filesProcessed: number
  totalDurationMs: number
}

export type ComicPanelSelectionRecord = {
  panelNumber: number
  /** Repository-relative or workspace-relative candidate path inside the scene workspace. */
  candidatePath: string
  sha256: string
  width: number
  height: number
  runId: string
  service: string
  model: ImageGenerationModel
  selectedAt: string
  /** 'first-generation' when an empty slot was filled automatically, 'review-use' for explicit adoption, 'legacy' for a pre-existing canonical panel with no recorded origin. */
  origin: 'first-generation' | 'review-use' | 'legacy'
}

export type ComicImageRunCandidate = {
  panelNumber: number
  candidatePath: string
  sha256: string
  width: number
  height: number
}

export type ComicImageRunRecord = {
  runId: string
  service: string
  model: ImageGenerationModel
  /** Individual final panels written by this run (the only outputs eligible for selection). */
  panels: ComicImageRunCandidate[]
  /** Provider-generated grouped pages and locally composed grids, recorded for preview only. */
  pages?: Array<{ pageNumber: number, panelNumbers: number[], candidatePath: string, kind: 'provider-page' | 'local-grid' }>
  createdAt: string
}

export type ReviewSheetCommandSelectionOptions = {
  run?: string
  use?: boolean
  panels?: ComicPanelSelection
}

export type ComicFinalImageLocation = {
  /** Omit for the canonical selected slot (`panels/panel-NN.png`); set for a run-scoped candidate (`panels/<run-id>/panel-NN.png`). */
  runId?: string
}

export type LegacyComicFinalImageLocation = {
  runId?: string
  model: ImageGenerationModel
  /** Historical `--variation` preset directory name, e.g. `canonical` or `cinematic-depth`. Read-only compatibility. */
  variation?: string
}
