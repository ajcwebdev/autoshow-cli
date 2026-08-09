import { getImageCost, getImageEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { estimateImageCosts, IMAGE_PRICING_PROVIDERS } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import type { ComputeEstimatedCostsInput, CostStepsResult, Step5Metadata } from '~/types'
import { optionsForService } from '~/utils/pricing/model-selection'
import { pushGenerationEstimates } from './cost-steps-shared'

const estimateImageTargetCost = (
  target: NonNullable<ComputeEstimatedCostsInput['imageTargets']>[number],
  input: Pick<ComputeEstimatedCostsInput, 'imageSize' | 'imageQuality'>
): { provider: Step5Metadata['imageService'], model: string, imageCount: number, totalCost: number } => {
  const imageCount = Math.max(1, target.count)
  const imageSize = target.imageSize ?? input.imageSize
  const imageQuality = target.imageQuality ?? input.imageQuality
  const sharedOptions = { imageSize, imageQuality, imageCount }
  const estimate = estimateImageCosts({
    ...sharedOptions,
    ...optionsForService(IMAGE_PRICING_PROVIDERS, target.service, target.model)
  })[0]
  const costPerImageCents = estimate?.costPerImageCents ?? getImageCost(target.service, target.model)
  return {
    provider: target.service,
    model: target.model,
    imageCount,
    totalCost: costPerImageCents * imageCount
  }
}

export const buildImageCostSteps = (input: ComputeEstimatedCostsInput): CostStepsResult => {
  const selectionOptions = Object.assign({}, ...IMAGE_PRICING_PROVIDERS.map((provider) => {
    const model = input[provider.modelKey]
    return model ? optionsForService(IMAGE_PRICING_PROVIDERS, provider.service, model) : {}
  }))
  const imageEstimates = input.imageTargets && input.imageTargets.length > 0
    ? input.imageTargets.map((target) => estimateImageTargetCost(target, input))
    : estimateImageCosts({
        ...selectionOptions,
        imageSize: input.imageSize,
        imageQuality: input.imageQuality,
        imageCount: input.imageCount
      })

  return pushGenerationEstimates(
    imageEstimates,
    input,
    (estimate) => getImageEstimation(estimate.provider, estimate.model).costMultiplier,
    'image',
    (estimate) => ({ imageCount: estimate.imageCount })
  )
}
