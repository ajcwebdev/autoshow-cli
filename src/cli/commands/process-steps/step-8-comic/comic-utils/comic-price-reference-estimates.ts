import { existsSync } from 'node:fs'
import type { CharacterSketchCommandOptions, ImageGenerationQuality, ImageGenerationSize, ReferenceSketchCommandOptions } from '~/types'
import { CHARACTER_SKETCH_VIEWS, requireCurrentCharacterSketch } from '../comic-commands/process-scenes/character-utils'
import { collectLocationSourceScripts } from '../comic-commands/reference-sketch/location-reference-command'
import { estimateImageOutputCost, formatCost } from '../comic-image-services/image-costs'
import { UsageError } from '~/utils/error-handler'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from './image-size'
import { loadCharacterCatalog } from './character-reference-config'
import { validateReferenceImageCount } from './reference-capabilities'
import { describeMixedLocationLineage, LOCATION_VIEWS, readLocationReferenceCatalog, readLocationSketchManifest, requireCurrentLocationReference } from './location-reference'
import { DEFAULT_LLM_MODEL, DEFAULT_QA_MODEL } from './cli-args'
import { priceDetails, priceLine, priceNotice } from './price-estimate-logging'
import { JUDGE_COST_BASIS_NOTE, printImageEstimateTable } from './comic-price-output'
import { ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL, estimateTokens } from './comic-price-llm-estimates'
import { estimateLlmCostFromRegistry } from './structured-script-utils/llm-cost'

export const LOCATION_JUDGE_ESTIMATED_INPUT_UNITS_PER_CALL = 5000
export const LOCATION_JUDGE_ESTIMATED_OUTPUT_UNITS_PER_CALL = 1200

export const estimateCharacterSketchPrice = async (
  options: CharacterSketchCommandOptions
): Promise<void> => {
  if (!options.character) throw UsageError('--character is required')
  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  if (models.length !== 1) throw UsageError('comic reference-sketch accepts exactly one --image-model')
  const size: ImageGenerationSize = options.size ?? '1024x1536'
  const quality: ImageGenerationQuality = options.quality ?? 'medium'
  const catalog = loadCharacterCatalog()
  const key = catalog.requireKey(options.character)
  const character = catalog.get(key)
  const sourcePath = existsSync(character.sourcePath)
    ? character.sourcePath
    : character.generationReferencePath
  if (!sourcePath) throw UsageError(`Character "${key}" has no source image or generationReference`)
  const referenceCount = options.revise && character.sourcePath !== character.outlineSheetPath ? 2 : 1
  validateImageSizeForModels(size, models)
  validateReferenceImageCount(models[0]!, referenceCount, `character-sketch ${options.revise ? 'revision' : 'generation'}`)
  if (options.revise) {
    await requireCurrentCharacterSketch(key, character)
  }

  priceDetails(
    'Comic - Price Estimate: reference-sketch --character',
    [
      ['Character', key],
      ['Source', sourcePath],
      ['Model', models[0]],
      ['Size', size],
      ['Quality', quality],
      ['References per view', referenceCount],
      ['Views', CHARACTER_SKETCH_VIEWS.join(', ')]
    ],
    {
      command: 'reference-sketch',
      character: key,
      sourcePath,
      model: models[0],
      size,
      quality,
      referencesPerView: referenceCount,
      views: [...CHARACTER_SKETCH_VIEWS]
    }
  )
  priceLine('The character sheet is composed locally after all views succeed.', { localComposition: true })
  printImageEstimateTable(models, quality, size, CHARACTER_SKETCH_VIEWS.length, 'view')
}

export const estimateLocationReferencePrice = async (
  options: ReferenceSketchCommandOptions
): Promise<void> => {
  const model = options.imageModels?.[0] ?? DEFAULT_IMAGE_MODEL
  const size: ImageGenerationSize = options.size ?? '1536x1024'
  const quality: ImageGenerationQuality = options.quality ?? 'high'
  const qaEnabled = options.qa ?? true
  const maxRepairs = options.maxRepairs ?? 2
  const view = options.view ?? 'establishing'
  validateImageSizeForModels(size, [model])
  const catalog = await readLocationReferenceCatalog()
  const manifest = await readLocationSketchManifest()
  const entry = catalog.locations.find(item => item.key === options.location)
  const registration = manifest.sketches.find(item => item.locationKey === options.location)
  const target = registration?.views.find(item => item.view === view)
  if (!LOCATION_VIEWS.includes(view)) throw UsageError(`--view must be one of: ${LOCATION_VIEWS.join(', ')}`)
  if (view !== 'establishing' && !registration?.views.some(item => item.view === 'establishing')) throw UsageError(`Cannot generate ${view} view before the establishing view`)
  if (options.revise && (!entry || !target)) throw UsageError(`Cannot revise unregistered ${view} view for location "${options.location}"`)
  if (!options.revise && target) {
    await requireCurrentLocationReference(options.location!)
    priceLine('Comic - Price Estimate: reference-sketch --location: existing validated view, no provider calls.', {
      command: 'reference-sketch',
      location: options.location,
      view,
      imageCalls: 0,
      judgeCalls: 0,
      totalCost: 0,
      dryRun: true
    })
    return
  }
  const aggregationCalls = entry ? 0 : 1
  const aggregationModel = options.llmModel ?? DEFAULT_LLM_MODEL
  const judgeModel = options.qaModel ?? DEFAULT_QA_MODEL
  const lineageWarning = describeMixedLocationLineage(options.location!, view, registration?.views.find(item => item.view === 'establishing'))
  if (lineageWarning) priceNotice(lineageWarning, { command: 'reference-sketch', location: options.location, view, lineage: 'mixed' })
  priceDetails(
    'Comic - Price Estimate: reference-sketch --location',
    [
      ['Location', options.location],
      ['View', view],
      ['Location-spec aggregation model', aggregationModel],
      ['Location-spec aggregation calls', aggregationCalls],
      ['Initial image calls', 1],
      ['Judge model', judgeModel],
      ['Initial judge calls', qaEnabled ? 1 : 0],
      ['Maximum additional image repairs', qaEnabled ? maxRepairs : 0],
      ['Maximum additional judge calls', qaEnabled ? maxRepairs : 0]
    ],
    {
      command: 'reference-sketch',
      location: options.location,
      view,
      aggregationModel,
      aggregationCalls,
      initialImageCalls: 1,
      judgeModel,
      initialJudgeCalls: qaEnabled ? 1 : 0,
      maximumAdditionalImageRepairs: qaEnabled ? maxRepairs : 0,
      maximumAdditionalJudgeCalls: qaEnabled ? maxRepairs : 0,
      ...(lineageWarning ? { lineage: 'mixed' } : {})
    }
  )
  printImageEstimateTable([model], quality, size, 1, 'initial location view')
  if (qaEnabled && maxRepairs > 0) printImageEstimateTable([model], quality, size, maxRepairs, 'maximum location retry')
  const maximumImageCalls = 1 + (qaEnabled ? maxRepairs : 0)
  const imageCostPerCall = estimateImageOutputCost(model, quality, size)
  const maximumJudgeCalls = qaEnabled ? 1 + maxRepairs : 0
  const judgeInputUnits = maximumJudgeCalls * LOCATION_JUDGE_ESTIMATED_INPUT_UNITS_PER_CALL
  const judgeOutputUnits = maximumJudgeCalls * LOCATION_JUDGE_ESTIMATED_OUTPUT_UNITS_PER_CALL
  const judgeCost = maximumJudgeCalls > 0 ? estimateLlmCostFromRegistry(judgeModel, judgeInputUnits, judgeOutputUnits) : 0
  const aggregationInputUnits = aggregationCalls > 0 ? (await collectLocationSourceScripts(options.location!)).reduce((total, script) => total + estimateTokens(script.content), 0) : 0
  const aggregationOutputUnits = aggregationCalls * ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL
  const aggregationCost = aggregationCalls > 0 ? estimateLlmCostFromRegistry(aggregationModel, aggregationInputUnits, aggregationOutputUnits) : 0
  priceDetails(
    'Comic Location QA Price Estimate',
    [
      ['Judge model', judgeModel],
      ['Maximum judge calls', maximumJudgeCalls],
      ['Heuristic judge input units', judgeInputUnits],
      ['Heuristic judge output units', judgeOutputUnits],
      ['Maximum judge cost', formatCost(judgeCost)],
      ['Location-spec aggregation cost', formatCost(aggregationCost)]
    ],
    {
      command: 'reference-sketch',
      location: options.location,
      view,
      judgeModel,
      maximumJudgeCalls,
      judgeInputUnits,
      judgeOutputUnits,
      judgeCost,
      aggregationModel,
      aggregationCalls,
      aggregationInputUnits,
      aggregationOutputUnits,
      aggregationCost
    }
  )
  priceLine(JUDGE_COST_BASIS_NOTE, { visionUsageModeled: false })
  if (imageCostPerCall === null) {
    priceLine(`Maximum modeled total: ~${formatCost(judgeCost + aggregationCost)} + n/a (${model} has no per-image estimate)`, { maximumImageCalls, maximumJudgeCalls, judgeCost, aggregationCost, hasUnknownPricing: true })
  } else {
    const imageCost = imageCostPerCall * maximumImageCalls
    const maximumModeledCost = imageCost + judgeCost + aggregationCost
    priceLine(`Maximum modeled total: ~${formatCost(maximumModeledCost)} (${maximumImageCalls} image call${maximumImageCalls === 1 ? '' : 's'} plus ${maximumJudgeCalls} judge call${maximumJudgeCalls === 1 ? '' : 's'})`, { maximumImageCalls, maximumJudgeCalls, imageCost, judgeCost, aggregationCost, maximumModeledCost, hasUnknownPricing: false })
  }
  priceLine('Dry run: no provider calls and no files written.', { dryRun: true })
}
