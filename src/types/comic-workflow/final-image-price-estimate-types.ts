import type { ComicGridSpec, ComicPanelSelection, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, ImagePromptVariation, LlmModel } from '~/types'

export type FinalImageQaRequest =
  | { enabled: false }
  | { enabled: true; judgeModel: LlmModel; maxRepairs: number }

export type FinalImageEstimateRequestBase = {
  sceneSlug: string
  models: readonly ImageGenerationModel[]
  size: ImageGenerationSize
  quality: ImageGenerationQuality
  force: boolean
  selection: ComicPanelSelection
  selectionSpecified: boolean
  variations: readonly ImagePromptVariation[]
  variationsSpecified: boolean
  qa: FinalImageQaRequest
}

export type FinalImageEstimateRequest =
  | (FinalImageEstimateRequestBase & { mode: 'page'; panelsPerImage: number })
  | (FinalImageEstimateRequestBase & { mode: 'panel' })
  | (FinalImageEstimateRequestBase & { mode: 'grid'; grid: ComicGridSpec; panelsPerImage: number })

export type FinalImageOutputInventory = {
  model: ImageGenerationModel
  variation: ImagePromptVariation
  outputPath: string
  exists: boolean
  qaReportReusable: boolean
}

export type FinalImagePageInventory = {
  mode: 'page'
  panelPromptsDir: string
  pages: ReadonlyArray<{
    pageNumber: number
    panelNumbers: readonly number[]
    referenceCount: number
    outputs: readonly FinalImageOutputInventory[]
  }>
}

export type FinalImagePanelInventory = {
  mode: 'panel' | 'grid'
  panelPromptsDir: string
  panels: ReadonlyArray<{
    directoryName: string
    panelNumber: number
    referenceCount: number
    variations: ReadonlyArray<{
      variation: ImagePromptVariation
      allModelsExist: boolean
    }>
  }>
  gridPages: ReadonlyArray<{
    pageNumber: number
    panelNumbers: readonly number[]
    outputs: readonly FinalImageOutputInventory[]
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
  outputsByModel: ReadonlyArray<{ model: ImageGenerationModel; outputs: number }>
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

export type FinalImageQaWork =
  | {
    mode: 'page'
    judgeModel: LlmModel
    initialJudgeCalls: number
    reusedReports: number
    maximumAdditionalImageEdits: number
    maximumAdditionalJudgeCalls: number
    estimatedInputTokens: number
    estimatedOutputTokens: number
  }
  | {
    mode: 'panel'
    judgeModel: LlmModel
    initialJudgeCalls: number
    maximumAdditionalImageEdits: number
    maximumAdditionalJudgeCalls: number
    maximumTotalJudgeCalls: number
    estimatedInputTokens: number
    estimatedOutputTokens: number
  }

export type ImagePricingEstimate = {
  outputLabel: string
  rows: ReadonlyArray<{
    model: ImageGenerationModel
    modelLabel: string
    outputs: number
    pricePerImage: number | null
    subtotal: number | null
  }>
  knownTotal: number
  hasUnknown: boolean
}

export type FinalImagePricingEstimate = {
  primary: ImagePricingEstimate
  repair: ImagePricingEstimate | null
  judgeCost: number | null
  maximumModeledCost: number | null
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
    qaWork: FinalImageQaWork | null
    pricing: FinalImagePricingEstimate
  }
