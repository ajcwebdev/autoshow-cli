import { existsSync } from 'node:fs'
import type { CharacterSketchCommandOptions, ImageGenerationQuality, ImageGenerationSize, LocationReferenceEntry, LocationSketchRegistration, LocationSketchViewRegistration, LocationView, ReferenceSketchCommandOptions } from '~/types'
import { CHARACTER_SKETCH_VIEWS, requireCurrentCharacterSketch } from '../comic-commands/process-scenes/character-utils'
import { collectLocationSourceScripts } from '../comic-commands/reference-sketch/location-reference-command'
import { estimateImageOutputCost, formatCost } from '../comic-image-services/image-costs'
import { UsageError } from '~/utils/error-handler'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from './image-size'
import { loadCharacterCatalog } from './character-reference-config'
import { validateReferenceImageCount } from './reference-capabilities'
import { describeMixedLocationLineage, LOCATION_VIEWS, readLocationReferenceCatalog, readLocationSketchManifest, requireCurrentLocationReference } from './location-reference'
import { DEFAULT_LLM_MODEL } from './cli-args'
import { priceDetails, priceLine, priceNotice } from './price-estimate-logging'
import { printImageEstimateTable } from './comic-price-output'
import { ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL, estimateTokens } from './comic-price-llm-estimates'
import { estimateLlmCostFromRegistry } from './structured-script-utils/llm-cost'

export const estimateCharacterSketchPrice = async (
  options: CharacterSketchCommandOptions
): Promise<void> => {
  if (!options.character) throw UsageError('--character is required')
  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  if (models.length !== 1) throw UsageError('comic reference-sketch accepts exactly one --provider')
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

type LocationPricePlan = {
  model: string
  size: ImageGenerationSize
  quality: ImageGenerationQuality
  view: LocationView
}

const resolveLocationPricePlan = (options: ReferenceSketchCommandOptions): LocationPricePlan => ({
  model: options.imageModels?.[0] ?? DEFAULT_IMAGE_MODEL,
  size: options.size ?? '1536x1024',
  quality: options.quality ?? 'high',
  view: options.view ?? 'establishing',
})

const assertLocationPriceTarget = (options: ReferenceSketchCommandOptions, view: LocationView, registered: { entry: LocationReferenceEntry | undefined; registration: LocationSketchRegistration | undefined; target: LocationSketchViewRegistration | undefined }): void => {
  if (!LOCATION_VIEWS.includes(view)) throw UsageError(`--view must be one of: ${LOCATION_VIEWS.join(', ')}`)
  if (view !== 'establishing' && !registered.registration?.views.some(item => item.view === 'establishing')) throw UsageError(`Cannot generate ${view} view before the establishing view`)
  if (options.revise && (!registered.entry || !registered.target)) throw UsageError(`Cannot revise unregistered ${view} view for location "${options.location}"`)
}

export const estimateLocationReferencePrice = async (
  options: ReferenceSketchCommandOptions
): Promise<void> => {
  const { model, size, quality, view } = resolveLocationPricePlan(options)
  if ((options.imageModels?.length ?? 1) !== 1) throw UsageError('reference-sketch accepts exactly one --provider')
  validateImageSizeForModels(size, [model])
  const catalog = await readLocationReferenceCatalog()
  const manifest = await readLocationSketchManifest()
  const entry = catalog.locations.find(item => item.key === options.location)
  const registration = manifest.sketches.find(item => item.locationKey === options.location)
  const target = registration?.views.find(item => item.view === view)
  assertLocationPriceTarget(options, view, { entry, registration, target })
  if (!options.revise && target) {
    await requireCurrentLocationReference(options.location!)
    priceLine('Comic - Price Estimate: reference-sketch --location: existing validated view, no provider calls.', {
      command: 'reference-sketch',
      location: options.location,
      view,
      imageCalls: 0,
      aggregationCalls: 0,
      totalCost: 0,
      dryRun: true
    })
    return
  }
  const imageCalls = 1
  const aggregationCalls = entry ? 0 : 1
  const aggregationModel = options.llmModel ?? DEFAULT_LLM_MODEL
  const lineageWarning = describeMixedLocationLineage(options.location!, view, registration?.views.find(item => item.view === 'establishing'))
  if (lineageWarning) priceNotice(lineageWarning, { command: 'reference-sketch', location: options.location, view, lineage: 'mixed' })
  const aggregationInputUnits = aggregationCalls > 0 ? (await collectLocationSourceScripts(options.location!)).reduce((total, script) => total + estimateTokens(script.content), 0) : 0
  const aggregationOutputUnits = aggregationCalls * ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL
  const aggregationCost = aggregationCalls > 0 ? estimateLlmCostFromRegistry(aggregationModel, aggregationInputUnits, aggregationOutputUnits) : 0
  priceDetails(
    'Comic - Price Estimate: reference-sketch --location',
    [
      ['Location', options.location],
      ['View', view],
      ['Mode', options.revise ? 'revision' : 'new view'],
      ['Image model', model],
      ['Image calls', imageCalls],
      ['Location-spec aggregation model', aggregationModel],
      ['Location-spec aggregation calls', aggregationCalls],
      ['Location-spec aggregation cost', formatCost(aggregationCost)]
    ],
    {
      command: 'reference-sketch',
      location: options.location,
      view,
      revise: options.revise ?? false,
      model,
      imageCalls,
      aggregationModel,
      aggregationCalls,
      aggregationInputUnits,
      aggregationOutputUnits,
      aggregationCost,
      ...(lineageWarning ? { lineage: 'mixed' } : {})
    }
  )
  printImageEstimateTable([model], quality, size, imageCalls, 'location view')
  const imageCostPerCall = estimateImageOutputCost(model, quality, size)
  if (imageCostPerCall === null) {
    priceLine(`Modeled total: ~${formatCost(aggregationCost)} + n/a (${model} has no per-image estimate)`, { imageCalls, aggregationCost, hasUnknownPricing: true })
  } else {
    const imageCost = imageCostPerCall * imageCalls
    const totalCost = imageCost + aggregationCost
    priceLine(`Modeled total: ~${formatCost(totalCost)} (${imageCalls} image call${aggregationCalls > 0 ? ' plus location-spec drafting' : ''})`, { imageCalls, imageCost, aggregationCost, totalCost, hasUnknownPricing: false })
  }
  priceLine('Dry run: no provider calls and no files written.', { dryRun: true })
}
