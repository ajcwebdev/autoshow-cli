import type {
  ComicGridSpec,
  FinalImageEstimateRequest,
  FinalImageEstimateRequestBase,
  FinalImageInputEstimate,
  FinalImageModeEstimate,
  FinalImagePageInventory,
  FinalImagePanelInventory,
  FinalImagePricingEstimate,
  GenerateImagesCommandOptions,
  ImagePricingEstimate,
  PageModeEstimate,
  PanelModeEstimate,
} from '~/types'
import { estimateOpenAIImageInputUnits } from '~/cli/commands/visuals/image/image-utils/image-pricing'
import {
  COMIC_GRID_PANEL_SIZE,
  DEFAULT_FINAL_PANELS_PER_IMAGE,
} from '../comic-commands/generate-images/comic-page-utils'
import { estimateImageOutputCost } from '../comic-image-services/image-costs'
import { isGeminiImageModel, resolveImageService } from './image-service'
import { DEFAULT_IMAGE_MODEL } from './image-size'

const selectFinalImageEstimateMode = (
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
    ...(options.recoveryRunId ? { runId: options.recoveryRunId } : {}),
    model: options.imageModel ?? DEFAULT_IMAGE_MODEL,
    size: options.size ?? COMIC_GRID_PANEL_SIZE,
    quality: options.quality ?? 'high',
    force: options.force ?? false,
    selection: Array.isArray(options.panels) ? [...options.panels] : options.panels ?? 'all',
    selectionSpecified: options.panels !== undefined,
  }

  if (mode === 'page') return { ...base, mode, panelsPerImage }
  if (mode === 'grid' && options.grid) return { ...base, mode, grid: options.grid, panelsPerImage }
  return { ...base, mode: 'panel' }
}

export const estimatePageMode = (inventory: FinalImagePageInventory): PageModeEstimate => {
  const totalOutputs = inventory.pages.filter(page => page.pending).length
  return { mode: 'page', totalOutputs, skipped: inventory.pages.length - totalOutputs }
}

export const estimatePanelMode = (
  request: Extract<FinalImageEstimateRequest, { mode: 'panel' | 'grid' }>,
  inventory: FinalImagePanelInventory,
): PanelModeEstimate => {
  const totalOutputs = inventory.panels.filter(panel => panel.pending).length
  const gridSkipped = request.force ? 0 : inventory.gridPages.filter(page => page.output.exists).length

  return {
    mode: request.mode,
    totalOutputs,
    skipped: inventory.panels.length - totalOutputs,
    grid: request.mode === 'grid'
      ? {
          totalOutputs: inventory.gridPages.length - gridSkipped,
          skipped: gridSkipped,
          columns: request.grid.columns,
          rows: request.grid.rows,
          capacity: request.grid.columns * request.grid.rows,
        }
      : null,
  }
}

const estimateImagePricing = (
  request: FinalImageEstimateRequest,
  outputLabel: string,
  outputs: number,
): ImagePricingEstimate => {
  const pricePerImage = estimateImageOutputCost(request.model, request.quality, request.size)
  return {
    outputLabel,
    model: request.model,
    modelLabel: `${request.model} (${isGeminiImageModel(request.model) ? 'ignored' : request.quality})`,
    outputs,
    pricePerImage,
    subtotal: pricePerImage === null ? null : pricePerImage * outputs,
  }
}

export const estimateFinalImageInputUnits = (
  request: FinalImageEstimateRequest,
  inventory: FinalImagePageInventory | FinalImagePanelInventory,
): FinalImageInputEstimate | null => {
  if (resolveImageService(request.model) !== 'openai') return null
  const pendingItems = inventory.mode === 'page'
    ? inventory.pages.filter(page => page.pending)
    : inventory.panels.filter(panel => panel.pending)
  const referenceInputs = pendingItems.reduce((total, item) => total + item.referenceCount, 0)
  return {
    ...estimateOpenAIImageInputUnits(request.model, referenceInputs),
    model: request.model,
    calls: pendingItems.length,
  }
}

export const estimateFinalImagePricing = (
  request: FinalImageEstimateRequest,
  estimate: FinalImageModeEstimate,
  inventory: FinalImagePageInventory | FinalImagePanelInventory,
): FinalImagePricingEstimate => {
  const primary = estimateImagePricing(request, estimate.mode === 'page' ? 'page' : 'panel', estimate.totalOutputs)
  const imageInput = estimateFinalImageInputUnits(request, inventory)
  const estimatedTotal = primary.subtotal === null || (imageInput !== null && imageInput.costCents === null && imageInput.referenceInputs > 0)
    ? null
    : primary.subtotal + (imageInput?.costCents ?? 0) / 100
  return { primary, imageInput, estimatedTotal }
}
