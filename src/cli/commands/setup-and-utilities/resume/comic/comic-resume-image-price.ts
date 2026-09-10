import { existsSync } from 'node:fs'
import type { FinalImageEstimateResult, GenerateImagesCommandOptions, ImageProvider, StepEstimate } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { findRegistryServiceForModel, getModelRegistry } from '../../models/model-loader/registry'
import { buildFinalPanelImageEstimate } from '../../../process-steps/step-8-comic/comic-utils/comic-price-final-image-estimates'
import { estimateGenerateSketchesPrice } from '../../../process-steps/step-8-comic/comic-utils/comic-price-sketch-estimates'
import { estimateImageOutputCost } from '../../../process-steps/step-8-comic/comic-image-services/image-costs'
import { panelSelectionToSketchRange } from '../../../process-steps/step-8-comic/comic-commands/generate-images/comic-page-utils'
import { assertPanelPromptSourceCoverage } from '../../../process-steps/step-8-comic/comic-utils/source-coverage-utils'
import { estimateFinalImagePricing, estimatePageMode, estimatePanelMode, estimateQaWork } from '../../../process-steps/step-8-comic/comic-utils/final-image-price-estimate'
import { resolveFinalImageOutputPathParts } from '../../../process-steps/step-8-comic/comic-utils/final-image-price-inventory'
import { getPanelComicImagePath } from '../../../process-steps/step-8-comic/comic-utils/scene-utils'
import { estimateOpenAIImageInputUnits } from '../../../process-steps/step-5-image/image-utils/image-pricing'
import { assertRequiredImageModel } from '~/utils/required-image-model'
import { readReusablePageQaEntry } from '../../../process-steps/step-8-comic/comic-commands/generate-images/comic-page-qa'

const remainingModelEstimates = async (estimate: Extract<FinalImageEstimateResult, { status: 'ready' }>) => {
  const original = estimate.request
  const originalInventory = estimate.inventory
  const reusableQa = async (path: string): Promise<boolean> => {
    if (!original.qa.enabled) return true
    if (!existsSync(path)) return false
    const entry = await readReusablePageQaEntry(path, original.qa.judgeModel)
    return entry !== undefined && !entry.hardFailure
  }
  return await Promise.all(original.models.map(async model => {
    if (original.mode === 'page' && originalInventory.mode === 'page') {
      const request = { ...original, models: [model] }
      const pages = await Promise.all(originalInventory.pages.map(async page => ({ ...page, outputs: await Promise.all(page.outputs.filter(output => output.model === model).map(async output => ({ ...output, qaReportReusable: await reusableQa(output.outputPath) }))) })))
      const inventory = { ...originalInventory, pages }
      const modeEstimate = estimatePageMode(request, inventory)
      const pendingQa = pages.flatMap(page => page.outputs).filter(output => !output.qaReportReusable).length
      const qaWork = estimateQaWork(request, { ...modeEstimate, totalOutputs: pendingQa }, inventory)
      return { pricing: estimateFinalImagePricing(request, modeEstimate, qaWork, inventory), qaWork }
    }
    if (original.mode === 'page' || originalInventory.mode === 'page') throw UsageError('Comic image price inventory does not match its recorded layout.')
    // Preserve original model/variation paths while counting each model's unfinished panels and QA.
    const request = { ...original, models: [model] }
    let pendingQa = 0
    const panels = await Promise.all(originalInventory.panels.map(async panel => ({ ...panel, variations: await Promise.all(panel.variations.map(async variation => {
      const parts = resolveFinalImageOutputPathParts(original, model, variation.variation)
      const path = getPanelComicImagePath(original.sceneSlug, panel.panelNumber, parts.model, parts.variation, original.runId)
      const qaReusable = await reusableQa(path)
      if (!qaReusable) pendingQa++
      return { ...variation, allModelsExist: existsSync(path), qaReusable }
    })) })))
    const inventory = { ...originalInventory, panels, gridPages: originalInventory.gridPages.map(page => ({ ...page, outputs: page.outputs.filter(output => output.model === model) })) }
    const modeEstimate = estimatePanelMode(request, inventory)
    const qaWork = estimateQaWork(request, { ...modeEstimate, totalOutputs: pendingQa }, inventory)
    // Missing QA may require repairs even when initial images exist. Model those input costs conservatively.
    const pricingInventory = { ...inventory, panels: panels.map(panel => ({ ...panel, variations: panel.variations.map(variation => ({ ...variation, allModelsExist: variation.allModelsExist && variation.qaReusable })) })) }
    return { pricing: estimateFinalImagePricing(request, modeEstimate, qaWork, pricingInventory), qaWork }
  }))
}

export const priceComicImageRecovery = async (options: GenerateImagesCommandOptions): Promise<StepEstimate[]> => {
  await assertPanelPromptSourceCoverage(options.sceneSlug, { writeReport: false })
  for (const model of options.imageModels ?? []) assertRequiredImageModel(model)
  const steps: StepEstimate[] = []
  if (options.target !== 'images') {
    const sketch = await estimateGenerateSketchesPrice({ ...options, sketchPanels: panelSelectionToSketchRange(options.panels) }, options.recoveryRunId)
    if (!sketch) throw UsageError('Comic recovery requires existing reviewed panel prompt bundles.')
    for (const { model, outputs, referenceInputs } of sketch.outputsByModel) {
      const price = estimateImageOutputCost(model, sketch.quality, sketch.size)
      const provider = findRegistryServiceForModel('image', model) as ImageProvider
      const inputPrice = provider === 'openai' && referenceInputs > 0 ? estimateOpenAIImageInputUnits(model, referenceInputs) : undefined
      if ((outputs > 0 && price === null) || inputPrice?.priced === false) throw UsageError(`Comic sketch recovery price is unknown for ${model}.`)
      steps.push({ step: 'image', provider, model, imageCount: outputs, totalCost: (price ?? 0) * outputs * 100 + (inputPrice?.costCents ?? 0) })
    }
  }
  if (options.target === 'sketches') return steps
  const estimate = await buildFinalPanelImageEstimate(options)
  if (estimate.status !== 'ready') throw UsageError(`Comic image recovery is blocked: ${estimate.status}. Run the explicit drafting stage to prepare reviewed inputs.`)
  for (const { pricing, qaWork } of await remainingModelEstimates(estimate)) {
    if (pricing.primary.hasUnknown || pricing.repair?.hasUnknown || pricing.imageInput?.priced === false) throw UsageError('Comic image recovery has unpriced provider work; inspect the explicit image command estimate.')
    for (const row of pricing.primary.rows) {
      const repair = pricing.repair?.rows.find(item => item.model === row.model)
      const inputCents = pricing.imageInput?.models[0] === row.model ? pricing.imageInput.costCents ?? 0 : 0
      steps.push({ step: 'image', provider: findRegistryServiceForModel('image', row.model) as ImageProvider, model: row.model, imageCount: row.outputs + (repair?.outputs ?? 0), totalCost: ((row.subtotal ?? 0) + (repair?.subtotal ?? 0)) * 100 + inputCents })
    }
    if (qaWork) {
      const provider = findRegistryServiceForModel('llm', qaWork.judgeModel)
      const config = provider ? getModelRegistry().llm[provider]?.models[qaWork.judgeModel] : undefined
      if (!provider || !config) throw UsageError(`The recorded QA model ${qaWork.judgeModel} is unavailable.`)
      steps.push({ step: 'llm', provider, model: qaWork.judgeModel, totalCost: (pricing.judgeCost ?? 0) * 100, inputCostPer1MCents: config.inputCostPer1MCents, outputCostPer1MCents: config.outputCostPer1MCents, estimatedInputTokens: qaWork.estimatedInputTokens, estimatedOutputTokens: qaWork.estimatedOutputTokens })
    }
  }
  return steps
}
