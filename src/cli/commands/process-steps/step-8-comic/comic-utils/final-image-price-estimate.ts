import type {
  ComicGridSpec,
  ComicPanelSelection,
  GenerateImagesCommandOptions,
  ImageGenerationModel,
  ImageGenerationQuality,
  ImageGenerationSize,
  ImagePromptVariation,
  LlmModel,
} from '~/types'
import {
  COMIC_GRID_PANEL_SIZE,
  DEFAULT_FINAL_PANELS_PER_IMAGE,
} from '../comic-commands/generate-images/comic-page-utils'
import { estimateImageOutputCost } from '../comic-image-services/image-costs'
import { DEFAULT_QA_MODEL } from './cli-args'
import { isGeminiImageModel } from './image-service'
import { DEFAULT_IMAGE_MODEL } from './image-size'
import { estimateLlmCostFromRegistry } from './structured-script-utils/llm-cost'

type FinalImageQaRequest =
  | { enabled: false }
  | { enabled: true; judgeModel: LlmModel; maxRepairs: number }

type FinalImageEstimateRequestBase = {
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

export const selectFinalImageEstimateMode = (
  grid: ComicGridSpec | undefined,
  panelsPerImage: number,
): FinalImageEstimateRequest['mode'] => {
  if (grid) return 'grid'
  return panelsPerImage > 1 ? 'page' : 'panel'
}

export const normalizeFinalImageEstimateRequest = (
  options: GenerateImagesCommandOptions,
): FinalImageEstimateRequest => {
  const panelsPerImage = options.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE
  const mode = selectFinalImageEstimateMode(options.grid, panelsPerImage)
  const base: FinalImageEstimateRequestBase = {
    sceneSlug: options.sceneSlug,
    models: options.imageModels ? [...options.imageModels] : [DEFAULT_IMAGE_MODEL],
    size: options.size ?? COMIC_GRID_PANEL_SIZE,
    quality: options.quality ?? 'high',
    force: options.force ?? false,
    selection: Array.isArray(options.panels) ? [...options.panels] : options.panels ?? 'all',
    selectionSpecified: options.panels !== undefined,
    variations: options.variations ? [...options.variations] : ['canonical'],
    variationsSpecified: options.variations !== undefined,
    qa: options.qa === false
      ? { enabled: false }
      : {
          enabled: true,
          judgeModel: options.qaModel ?? DEFAULT_QA_MODEL,
          maxRepairs: options.maxRepairs ?? 2,
        },
  }

  if (mode === 'page') return { ...base, mode, panelsPerImage }
  if (mode === 'grid' && options.grid) return { ...base, mode, grid: options.grid, panelsPerImage }
  return { ...base, mode: 'panel' }
}

export const estimatePageMode = (
  request: Extract<FinalImageEstimateRequest, { mode: 'page' }>,
  inventory: FinalImagePageInventory,
): PageModeEstimate => {
  const outputsByModel = request.models.map(model => ({
    model,
    outputs: inventory.pages.reduce((total, page) => (
      total + page.outputs.filter(output => output.model === model && (request.force || !output.exists)).length
    ), 0),
  }))
  const totalOutputs = outputsByModel.reduce((total, item) => total + item.outputs, 0)
  const totalCandidates = inventory.pages.length * request.models.length * request.variations.length

  return {
    mode: 'page',
    totalOutputs,
    skipped: totalCandidates - totalOutputs,
    outputsByModel,
  }
}

export const estimatePanelMode = (
  request: Extract<FinalImageEstimateRequest, { mode: 'panel' | 'grid' }>,
  inventory: FinalImagePanelInventory,
): PanelModeEstimate => {
  const skipped = request.force
    ? 0
    : inventory.panels.reduce((total, panel) => (
        total + panel.variations.filter(variation => variation.allModelsExist).length
      ), 0)
  const totalOutputs = inventory.panels.length * request.variations.length - skipped
  const gridSkipped = request.force
    ? 0
    : inventory.gridPages.reduce((total, page) => (
        total + page.outputs.filter(output => output.exists).length
      ), 0)
  const gridCandidates = inventory.gridPages.length * request.models.length * request.variations.length

  return {
    mode: request.mode,
    totalOutputs,
    skipped,
    grid: request.mode === 'grid'
      ? {
          totalOutputs: gridCandidates - gridSkipped,
          skipped: gridSkipped,
          columns: request.grid.columns,
          rows: request.grid.rows,
          capacity: request.grid.columns * request.grid.rows,
        }
      : null,
  }
}

export function estimateQaWork(
  request: Extract<FinalImageEstimateRequest, { mode: 'page' }>,
  estimate: PageModeEstimate,
  inventory: FinalImagePageInventory,
): FinalImageQaWork | null
export function estimateQaWork(
  request: Extract<FinalImageEstimateRequest, { mode: 'panel' | 'grid' }>,
  estimate: PanelModeEstimate,
  inventory: FinalImagePanelInventory,
): FinalImageQaWork | null
export function estimateQaWork(
  request: FinalImageEstimateRequest,
  estimate: FinalImageModeEstimate,
  inventory: FinalImagePageInventory | FinalImagePanelInventory,
): FinalImageQaWork | null {
  if (!request.qa.enabled || estimate.totalOutputs === 0) return null

  if (request.mode === 'page' && estimate.mode === 'page' && inventory.mode === 'page') {
    const outputs = inventory.pages.flatMap(page => page.outputs)
    const reusedReports = request.force ? 0 : outputs.filter(output => output.qaReportReusable).length
    const initialJudgeCalls = outputs.length - reusedReports
    return {
      mode: 'page',
      judgeModel: request.qa.judgeModel,
      initialJudgeCalls,
      reusedReports,
      maximumAdditionalImageEdits: initialJudgeCalls * request.qa.maxRepairs,
      maximumAdditionalJudgeCalls: initialJudgeCalls * request.qa.maxRepairs,
      estimatedInputTokens: initialJudgeCalls * 5000,
      estimatedOutputTokens: initialJudgeCalls * 1200,
    }
  }

  const initialJudgeCalls = estimate.totalOutputs
  const maximumAdditionalJudgeCalls = initialJudgeCalls * request.qa.maxRepairs
  const maximumTotalJudgeCalls = initialJudgeCalls + maximumAdditionalJudgeCalls
  return {
    mode: 'panel',
    judgeModel: request.qa.judgeModel,
    initialJudgeCalls,
    maximumAdditionalImageEdits: maximumAdditionalJudgeCalls,
    maximumAdditionalJudgeCalls,
    maximumTotalJudgeCalls,
    estimatedInputTokens: maximumTotalJudgeCalls * 5000,
    estimatedOutputTokens: maximumTotalJudgeCalls * 1200,
  }
}

const estimateImagePricing = (
  request: FinalImageEstimateRequest,
  outputLabel: string,
  outputsForModel: (model: ImageGenerationModel) => number,
): ImagePricingEstimate => {
  const rows = request.models.map(model => {
    const outputs = outputsForModel(model)
    const pricePerImage = estimateImageOutputCost(model, request.quality, request.size)
    return {
      model,
      modelLabel: `${model} (${isGeminiImageModel(model) ? 'ignored' : request.quality})`,
      outputs,
      pricePerImage,
      subtotal: pricePerImage === null ? null : pricePerImage * outputs,
    }
  })
  return {
    outputLabel,
    rows,
    knownTotal: rows.reduce((total, row) => total + (row.subtotal ?? 0), 0),
    hasUnknown: rows.some(row => row.subtotal === null),
  }
}

export const estimateFinalImagePricing = (
  request: FinalImageEstimateRequest,
  estimate: FinalImageModeEstimate,
  qaWork: FinalImageQaWork | null,
): FinalImagePricingEstimate => {
  const primary = estimateImagePricing(
    request,
    estimate.mode === 'page' ? 'page' : 'panel',
    model => estimate.mode === 'page'
      ? estimate.outputsByModel.find(item => item.model === model)?.outputs ?? 0
      : estimate.totalOutputs,
  )
  const repairOutputs = qaWork?.maximumAdditionalImageEdits ?? 0
  const repair = repairOutputs > 0
    ? estimateImagePricing(
        { ...request, models: [DEFAULT_IMAGE_MODEL] },
        'maximum repair',
        () => repairOutputs,
      )
    : null
  const judgeCost = qaWork
    ? estimateLlmCostFromRegistry(
        qaWork.judgeModel,
        qaWork.estimatedInputTokens,
        qaWork.estimatedOutputTokens,
      )
    : null
  const maximumModeledCost = qaWork?.mode === 'panel'
    ? primary.hasUnknown || repair?.hasUnknown === true
      ? null
      : primary.knownTotal + (repair?.knownTotal ?? 0) + (judgeCost ?? 0)
    : null

  return { primary, repair, judgeCost, maximumModeledCost }
}
