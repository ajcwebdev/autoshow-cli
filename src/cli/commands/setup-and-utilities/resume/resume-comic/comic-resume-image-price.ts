import type { FinalImagePricingEstimate, GenerateImagesCommandOptions, ImageProvider, StepEstimate } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { findRegistryServiceForModel } from '../../models/model-loader/registry'
import { buildFinalPanelImageEstimate } from '../../../visuals/comic/comic-utils/comic-price-final-image-estimates'
import { estimateGenerateSketchesPrice } from '../../../visuals/comic/comic-utils/comic-price-sketch-estimates'
import { estimateImageOutputCost } from '../../../visuals/comic/comic-image-services/image-costs'
import { panelSelectionToSketchRange } from '../../../visuals/comic/comic-commands/generate-images/comic-page-utils'
import { assertPanelPromptSourceCoverage } from '../../../visuals/comic/comic-utils/source-coverage-utils'
import { estimateOpenAIImageInputUnits } from '../../../visuals/image/image-utils/image-pricing'
import { assertRequiredImageModel } from '~/utils/required-image-model'

type SketchPriceEstimate = NonNullable<Awaited<ReturnType<typeof estimateGenerateSketchesPrice>>>

const pushSketchRecoveryStep = (steps: StepEstimate[], sketch: SketchPriceEstimate): void => {
  const { model, totalSketches, referenceInputs } = sketch
  const price = estimateImageOutputCost(model, sketch.quality, sketch.size)
  const provider = findRegistryServiceForModel('image', model) as ImageProvider
  const inputPrice = provider === 'openai' && referenceInputs > 0 ? estimateOpenAIImageInputUnits(model, referenceInputs) : undefined
  if ((totalSketches > 0 && price === null) || inputPrice?.priced === false) throw UsageError(`Comic sketch recovery price is unknown for ${model}.`)
  steps.push({ step: 'image', provider, model, imageCount: totalSketches, totalCost: (price ?? 0) * totalSketches * 100 + (inputPrice?.costCents ?? 0) })
}

const pushFinalImageRecoveryStep = (steps: StepEstimate[], pricing: FinalImagePricingEstimate): void => {
  const { primary, imageInput } = pricing
  if (primary.subtotal === null || imageInput?.priced === false) throw UsageError('Comic image recovery has unpriced provider work; inspect the explicit image command estimate.')
  steps.push({
    step: 'image',
    provider: findRegistryServiceForModel('image', primary.model) as ImageProvider,
    model: primary.model,
    imageCount: primary.outputs,
    totalCost: primary.subtotal * 100 + (imageInput?.costCents ?? 0),
  })
}

/**
 * Price the outstanding base images of one recorded single-model run at the destinations dispatch uses.
 * Completed candidates and filled canonical slots are reused; no judge, repair or comparison work is modeled,
 * and retained QA records (missing, old, malformed or failing) never add work.
 */
export const priceComicImageRecovery = async (options: GenerateImagesCommandOptions): Promise<StepEstimate[]> => {
  await assertPanelPromptSourceCoverage(options.sceneSlug, { writeReport: false })
  if (options.imageModel) assertRequiredImageModel(options.imageModel)
  const steps: StepEstimate[] = []
  if (options.target !== 'images') {
    const sketch = await estimateGenerateSketchesPrice({ ...options, sketchPanels: panelSelectionToSketchRange(options.panels) }, options.recoveryRunId)
    if (!sketch) throw UsageError('Comic recovery requires existing reviewed panel prompt bundles.')
    pushSketchRecoveryStep(steps, sketch)
  }
  if (options.target === 'sketches') return steps
  const estimate = await buildFinalPanelImageEstimate(options)
  if (estimate.status !== 'ready') throw UsageError(`Comic image recovery is blocked: ${estimate.status}. Run the explicit drafting stage to prepare reviewed inputs.`)
  pushFinalImageRecoveryStep(steps, estimate.pricing)
  return steps
}
