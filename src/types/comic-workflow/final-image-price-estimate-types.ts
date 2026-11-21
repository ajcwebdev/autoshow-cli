import type { ComicGridSpec, ComicPanelSelection, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, OpenAIImageInputEstimate } from '~/types'

export type FinalImageEstimateRequestBase = {
  sceneSlug: string
  /** Run whose candidate destinations are checked; omitted for a fresh run, which always receives a new run ID. */
  runId?: string
  model: ImageGenerationModel
  size: ImageGenerationSize
  quality: ImageGenerationQuality
  force: boolean
  selection: ComicPanelSelection
  selectionSpecified: boolean
}

export type FinalImageEstimateRequest =
  | (FinalImageEstimateRequestBase & { mode: 'page'; panelsPerImage: number })
  | (FinalImageEstimateRequestBase & { mode: 'panel' })
  | (FinalImageEstimateRequestBase & { mode: 'grid'; grid: ComicGridSpec; panelsPerImage: number })

export type FinalImageOutputInventory = {
  /** Run-scoped destination used by dispatch, or null when no run ID exists yet. */
  outputPath: string | null
  exists: boolean
}

export type FinalImagePageInventory = {
  mode: 'page'
  panelPromptsDir: string
  pages: ReadonlyArray<{
    pageNumber: number
    panelNumbers: readonly number[]
    referenceCount: number
    output: FinalImageOutputInventory
    pending: boolean
  }>
}

export type FinalImagePanelInventory = {
  mode: 'panel' | 'grid'
  panelPromptsDir: string
  panels: ReadonlyArray<{
    directoryName: string
    panelNumber: number
    referenceCount: number
    /** Run-scoped candidate written by dispatch. */
    candidate: FinalImageOutputInventory
    /** Canonical selected slot (`panels/panel-NN.png`). */
    selection: { path: string; exists: boolean }
    pending: boolean
  }>
  gridPages: ReadonlyArray<{
    pageNumber: number
    panelNumbers: readonly number[]
    output: FinalImageOutputInventory
  }>
}

export type FinalImageInventory =
  | { status: 'missing-prompts' }
  | { status: 'empty' }
  | { status: 'ready'; inventory: FinalImagePageInventory | FinalImagePanelInventory }

export type PageModeEstimate = {
  mode: 'page'
  totalOutputs: number
  skipped: number
}

export type PanelModeEstimate = {
  mode: 'panel' | 'grid'
  totalOutputs: number
  skipped: number
  grid: null | {
    totalOutputs: number
    skipped: number
    columns: number
    rows: number
    capacity: number
  }
}

export type FinalImageModeEstimate = PageModeEstimate | PanelModeEstimate

export type ImagePricingEstimate = {
  outputLabel: string
  model: ImageGenerationModel
  modelLabel: string
  outputs: number
  pricePerImage: number | null
  subtotal: number | null
}

export type FinalImageInputEstimate = OpenAIImageInputEstimate & {
  model: ImageGenerationModel
  calls: number
}

export type FinalImagePricingEstimate = {
  primary: ImagePricingEstimate
  imageInput: FinalImageInputEstimate | null
  /** Known image output plus modeled input cost, or null when any part is unpriced. */
  estimatedTotal: number | null
}

export type FinalImageEstimateResult =
  | {
    status: 'missing-prompts' | 'empty'
    request: FinalImageEstimateRequest
  }
  | {
    status: 'ready'
    request: FinalImageEstimateRequest
    inventory: FinalImagePageInventory | FinalImagePanelInventory
    modeEstimate: FinalImageModeEstimate
    pricing: FinalImagePricingEstimate
  }
