import type { FinalPanelImageStageOptions, GenerateComicGridPagesOptions, GenerateComicPagesOptions, GeneratePanelImagesOptions, ImageGenerationQuality, ImageGenerationSize } from '~/types'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from '../../comic-utils/image-size'
import { DEFAULT_IMAGE_QUALITY, DEFAULT_IMAGE_SIZE } from './comic-image-run-defaults'
import { DEFAULT_FINAL_PANELS_PER_IMAGE, validateComicGridOptions } from './comic-page-utils'

export const prepareFinalPanelStage = (options: FinalPanelImageStageOptions) => {
  const panelsPerImage = options.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE
  const usePageMode = !options.grid && panelsPerImage > 1
  const stageLabel = options.grid ? 'Grid' : usePageMode ? 'Page' : 'Image'

  const model = options.imageModel ?? DEFAULT_IMAGE_MODEL
  const size: ImageGenerationSize = options.size ?? DEFAULT_IMAGE_SIZE
  const quality: ImageGenerationQuality = options.quality ?? DEFAULT_IMAGE_QUALITY
  const force = options.force ?? false
  validateImageSizeForModels(size, [model])
  validateComicGridOptions(options.grid, {
    target: 'images',
    size,
    panelsPerImage,
  })

  return { panelsPerImage, usePageMode, stageLabel, model, size, quality, force }
}

type PreparedFinalPanelStage = ReturnType<typeof prepareFinalPanelStage>

export const createFinalPanelOptions = (options: FinalPanelImageStageOptions, prepared: PreparedFinalPanelStage): GeneratePanelImagesOptions => {
  const { runId, concurrency } = options
  const { model, size, quality, force } = prepared
  return {
    model,
    size,
    quality,
    force,
    runId,
    concurrency,
    checkpointPurchase: options.checkpointPurchase,
    hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator,
    concurrencyMode: options.concurrencyMode,
    ...(options.panels !== undefined ? { panels: options.panels } : {}),
    ...(options.stopOnProviderError === true ? { stopOnProviderError: true } : {}),
  }
}

export const createFinalPageOptions = (options: FinalPanelImageStageOptions, prepared: PreparedFinalPanelStage): GenerateComicPagesOptions => {
  const { runId, concurrency } = options
  const { model, size, quality, force, panelsPerImage } = prepared
  return {
    model,
    size,
    quality,
    force,
    runId,
    concurrency,
    checkpointPurchase: options.checkpointPurchase,
    hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator,
    concurrencyMode: options.concurrencyMode,
    panels: options.panels ?? 'all',
    panelsPerImage,
    ...(options.stopOnProviderError === true ? { stopOnProviderError: true } : {}),
  }
}

export const createFinalGridOptions = (options: FinalPanelImageStageOptions & { grid: NonNullable<FinalPanelImageStageOptions['grid']> }, prepared: PreparedFinalPanelStage): GenerateComicGridPagesOptions => {
  const { runId, concurrency } = options
  const { model, force } = prepared
  return {
    model,
    force,
    runId,
    concurrency,
    hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator,
    concurrencyMode: options.concurrencyMode,
    panels: options.panels ?? 'all',
    grid: options.grid,
  }
}
