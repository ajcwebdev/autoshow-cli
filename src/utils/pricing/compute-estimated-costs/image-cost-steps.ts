import { getImageCost, getImageEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import type { ComputeEstimatedCostsInput, CostStepsResult, Step5Metadata } from '~/types'
import { pushGenerationEstimates } from './cost-steps-shared'

const estimateImageTargetCost = (
  target: NonNullable<ComputeEstimatedCostsInput['imageTargets']>[number],
  input: Pick<ComputeEstimatedCostsInput, 'imageSize' | 'imageQuality'>
): { provider: Step5Metadata['imageService'], model: string, imageCount: number, totalCost: number } => {
  const imageCount = Math.max(1, target.count)
  const imageSize = target.imageSize ?? input.imageSize
  const imageQuality = target.imageQuality ?? input.imageQuality
  const sharedOptions = { imageSize, imageQuality, imageCount }
  const estimate = (() => {
    switch (target.service) {
      case 'gemini':
        return estimateImageCosts({ ...sharedOptions, geminiImageModel: target.model })[0]
      case 'openai':
        return estimateImageCosts({ ...sharedOptions, openaiImageModel: target.model })[0]
      case 'grok':
        return estimateImageCosts({ ...sharedOptions, grokImageModel: target.model })[0]
      case 'bfl':
        return estimateImageCosts({ ...sharedOptions, bflImageModel: target.model })[0]
      case 'recraft':
        return estimateImageCosts({ ...sharedOptions, recraftImageModel: target.model })[0]
      case 'replicate':
        return estimateImageCosts({ ...sharedOptions, replicateImageModel: target.model })[0]
      case 'lumalabs':
        return estimateImageCosts({ ...sharedOptions, lumalabsImageModel: target.model })[0]
      case 'fal':
        return estimateImageCosts({ ...sharedOptions, falImageModel: target.model })[0]
      default:
        return undefined
    }
  })()
  const costPerImageCents = estimate?.costPerImageCents ?? getImageCost(target.service, target.model)
  return {
    provider: target.service,
    model: target.model,
    imageCount,
    totalCost: costPerImageCents * imageCount
  }
}

export const buildImageCostSteps = (input: ComputeEstimatedCostsInput): CostStepsResult => {
  const imageEstimates = input.imageTargets && input.imageTargets.length > 0
    ? input.imageTargets.map((target) => estimateImageTargetCost(target, input))
    : estimateImageCosts({
        geminiImageModel: input.geminiImageModel,
        openaiImageModel: input.openaiImageModel,
        grokImageModel: input.grokImageModel,
        bflImageModel: input.bflImageModel,
        recraftImageModel: input.recraftImageModel,
        replicateImageModel: input.replicateImageModel,
        lumalabsImageModel: input.lumalabsImageModel,
        falImageModel: input.falImageModel,
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
