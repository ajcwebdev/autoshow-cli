import type { GenerateImagesCommandOptions } from '~/types'
import { DEFAULT_FINAL_PANELS_PER_IMAGE, validateComicGridOptions } from '../comic-commands/generate-images/comic-page-utils'
import { validateImageSizeForModels } from './image-size'
import { estimateFinalImagePricing, estimatePageMode, estimatePanelMode, estimateQaWork, normalizeFinalImageEstimateRequest } from './final-image-price-estimate'
import { loadFinalImageEstimateInventory } from './final-image-price-inventory'
import { printFinalImageEstimate } from './comic-price-output'

export const estimateFinalPanelImagesPrice = async (options: GenerateImagesCommandOptions): Promise<void> => {
  const request = normalizeFinalImageEstimateRequest(options)
  validateImageSizeForModels(request.size, request.models)
  validateComicGridOptions(request.mode === 'grid' ? request.grid : undefined, {
    target: 'images',
    size: request.size,
    panelsPerImage: request.mode === 'page' || request.mode === 'grid'
      ? request.panelsPerImage
      : DEFAULT_FINAL_PANELS_PER_IMAGE,
  })

  const loaded = await loadFinalImageEstimateInventory(request)
  if (loaded.status !== 'ready') {
    printFinalImageEstimate({ status: loaded.status, request })
    return
  }

  if (request.mode === 'page' && loaded.inventory.mode === 'page') {
    const modeEstimate = estimatePageMode(request, loaded.inventory)
    const qaWork = estimateQaWork(request, modeEstimate, loaded.inventory)
    printFinalImageEstimate({
      status: 'ready',
      request,
      inventory: loaded.inventory,
      modeEstimate,
      qaWork,
      pricing: estimateFinalImagePricing(request, modeEstimate, qaWork, loaded.inventory),
    })
    return
  }

  if (request.mode !== 'page' && loaded.inventory.mode !== 'page') {
    const modeEstimate = estimatePanelMode(request, loaded.inventory)
    const qaWork = estimateQaWork(request, modeEstimate, loaded.inventory)
    printFinalImageEstimate({
      status: 'ready',
      request,
      inventory: loaded.inventory,
      modeEstimate,
      qaWork,
      pricing: estimateFinalImagePricing(request, modeEstimate, qaWork, loaded.inventory),
    })
  }
}
