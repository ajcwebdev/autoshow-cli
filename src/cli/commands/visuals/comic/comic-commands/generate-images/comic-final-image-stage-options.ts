import type { FinalPanelImageStageOptions, GenerateComicPagesOptions, GeneratePanelImagesOptions, ImageGenerationQuality, ImageGenerationSize } from '~/types'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from '../../comic-utils/image-size'
import { DEFAULT_IMAGE_QUALITY, DEFAULT_IMAGE_SIZE } from './comic-image-run-defaults'
import { DEFAULT_FINAL_PANELS_PER_IMAGE, validateComicGridOptions } from './comic-page-utils'
import type { generateComicGridPages } from './generate-comic-grid-pages'

export const prepareFinalPanelStage = (options: FinalPanelImageStageOptions) => {
  const panelsPerImage = options.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE
  const usePageMode = !options.grid && panelsPerImage > 1
  const stageLabel = options.grid ? 'Grid' : usePageMode ? 'Page' : 'Image'

  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  const size: ImageGenerationSize = options.size ?? DEFAULT_IMAGE_SIZE
  const quality: ImageGenerationQuality = options.quality ?? DEFAULT_IMAGE_QUALITY
  const force = options.force ?? false
  validateImageSizeForModels(size, models)
  validateComicGridOptions(options.grid, {
    target: 'images',
    size,
    panelsPerImage,
  })

  return { panelsPerImage, usePageMode, stageLabel, models, size, quality, force }
}

export const createFinalPanelOptions = (options: FinalPanelImageStageOptions, prepared: ReturnType<typeof prepareFinalPanelStage>): GeneratePanelImagesOptions => {
  const { runId, concurrency } = options
  const { models, size, quality, force } = prepared
  return {
    models,
    size,
    quality,
    force,
    runId,
    concurrency,
    hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator,
    concurrencyMode: options.concurrencyMode,
    ...(options.panels !== undefined ? { panels: options.panels } : {}),
    ...(options.variations !== undefined ? { variations: options.variations } : {}),
    qa: options.qa ?? true,
    ...(options.qaModel ? { qaModel: options.qaModel } : {}),
    maxRepairs: options.maxRepairs ?? 2,
    ...(options.blockingHardKeys?.length ? { blockingHardKeys: options.blockingHardKeys } : {}),
    ...(options.blockingLayoutGuide === true ? { blockingLayoutGuide: true } : {}),
    ...(options.stopOnProviderError === true ? { stopOnProviderError: true } : {}),
    ...(options.bloopers === true ? { bloopers: true } : {}),
  }
}

export const createFinalPageOptions = (options: FinalPanelImageStageOptions, prepared: ReturnType<typeof prepareFinalPanelStage>): GenerateComicPagesOptions => {
  const { runId, concurrency } = options
  const { models, size, quality, force, panelsPerImage } = prepared
  return {
    models,
    size,
    quality,
    force,
    runId,
    concurrency,
    hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator,
    concurrencyMode: options.concurrencyMode,
    panels: options.panels ?? 'all',
    panelsPerImage,
    ...(options.variations !== undefined ? { variations: options.variations } : {}),
    qa: options.qa ?? true,
    ...(options.qaModel ? { qaModel: options.qaModel } : {}),
    maxRepairs: options.maxRepairs ?? 2,
  }
}

export const createFinalGridOptions = (options: FinalPanelImageStageOptions, prepared: ReturnType<typeof prepareFinalPanelStage>): Parameters<typeof generateComicGridPages>[1] => {
  const { runId, concurrency } = options
  const { models, force } = prepared
  return {
    models,
    force,
    runId,
    concurrency,
    panels: options.panels ?? 'all',
    grid: options.grid,
    ...(options.variations !== undefined ? { variations: options.variations } : {}),
  } as Parameters<typeof generateComicGridPages>[1]
}
