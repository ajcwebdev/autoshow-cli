import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import * as v from 'valibot'
import type { CharacterSketchCommandOptions, ComicPriceModelRow, DraftScenesCommandOptions, FinalImageEstimateResult, GenerateImagesCommandOptions, GenerateSketchesCommandOptions, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, ImagePricingEstimate, SceneSketchCount, StructureScriptsCommandOptions } from '~/types'
import {
COMIC_GRID_PANEL_SIZE,
DEFAULT_SKETCH_PANELS_PER_IMAGE,
DEFAULT_FINAL_PANELS_PER_IMAGE,
panelSelectionToSketchRange,
validateComicGridOptions,
} from '../comic-commands/generate-images/comic-page-utils'
import {
resolveSketchChunks,
} from '../comic-commands/generate-sketches/generate-scene-sketches'
import { getImagePromptVariationLabel } from '../comic-commands/generate-images/prompt-variations'
import {
CHARACTER_SKETCH_VIEWS,
requireCurrentCharacterSketch,
} from '../comic-commands/process-scenes/character-utils'
import { estimateImageOutputCost, formatCost } from '../comic-image-services/image-costs'
import { estimateLlmCostFromRegistry } from './structured-script-utils/llm-cost'
import { isGeminiImageModel } from './image-service'
import { DEFAULT_LLM_MODEL, DEFAULT_QA_MODEL } from './cli-args'
import { CLIUsageError } from '~/utils/error-handler'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from './image-size'
import { ScenePromptDataSchema } from '../schemas/schemas'
import { comicWrite } from './comic-logger'
import { loadCharacterCatalog } from './character-reference-config'
import { validateReferenceImageCount } from './reference-capabilities'
import { LOCATION_VIEWS, readLocationReferenceCatalog, readLocationSketchManifest, requireCurrentLocationReference } from './location-reference'
import {
PANEL_DIRECTORY_PATTERN,
getPanelNumberFromName,
} from './panel-prompt-utils'
import {
getDraftPromptPath,
getPanelPromptsDirectory,
getSceneJsonPath,
} from './project-paths'
import {
getSketchComicImagePath,
} from './scene-utils'
import { estimateFinalImagePricing, estimatePageMode, estimatePanelMode, estimateQaWork, normalizeFinalImageEstimateRequest } from './final-image-price-estimate'
import {
loadFinalImageEstimateInventory,
validatePriceReferenceGroup,
} from './final-image-price-inventory'

const ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL = 800

const estimateTokens = (content: string): number => {
  return Math.ceil(content.length / 4)
}

const estimateLlmCost = (model: DraftScenesCommandOptions['llmModel'], inputTokens: number, outputTokens: number): number =>
  estimateLlmCostFromRegistry(model ?? DEFAULT_LLM_MODEL, inputTokens, outputTokens)

const estimateSceneDraftPrice = async (options: DraftScenesCommandOptions): Promise<void> => {
  const model = options.llmModel ?? DEFAULT_LLM_MODEL
  const { sceneSlug } = options

  comicWrite(`${'Comic'} - Price Estimate: draft-scenes --only scene`)
  comicWrite(`  Model: ${model}`)
  comicWrite('')

  const draftPromptPath = getDraftPromptPath(sceneSlug)

  if (!existsSync(draftPromptPath)) {
    comicWrite('  No draft prompt file found. Run "bun autoshow comic draft-scenes --only prompt" first.')
    return
  }

  const content = await Bun.file(draftPromptPath).text()
  const tokens = estimateTokens(content)

  comicWrite('  Prompt files:')
  comicWrite(`    ${sceneSlug}/metadata/draft-prompt.md`.padEnd(50, ' ') + `  ~${tokens.toLocaleString()} tokens`)
  comicWrite('')

  const totalInputTokens = tokens
  const totalCalls = 1
  const totalOutputTokens = ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL * totalCalls

  comicWrite(`  Estimated totals:`)
  comicWrite(`    Input:  ~${totalInputTokens.toLocaleString()} tokens (${totalCalls} call)`)
  comicWrite(`    Output: ~${totalOutputTokens.toLocaleString()} tokens (~${ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL} tokens per call)`)
  comicWrite('')

  const totalCost = estimateLlmCost(model, totalInputTokens, totalOutputTokens)
  const inputCost = estimateLlmCost(model, totalInputTokens, 0)
  const outputCost = estimateLlmCost(model, 0, totalOutputTokens)

  comicWrite(`  ${model}:`)
  comicWrite(`    Input cost:   ~${formatCost(inputCost)}`)
  comicWrite(`    Output cost:  ~${formatCost(outputCost)}`)
  comicWrite(`    Total:        ~${formatCost(totalCost)}`)
  comicWrite('')
  comicWrite('  Estimates: tokens ~ chars / 4, no cache discount, output ~800 tokens/call')
}

const estimatePanelPromptsPrice = (): void => {
  comicWrite(`${'Comic'} - Price Estimate: draft-scenes --only panel-prompts`)
  comicWrite('  The panel-prompt stage makes no LLM or image generation API calls.')
  comicWrite('')
}

export const estimateDraftScenesPrice = async (options: DraftScenesCommandOptions): Promise<void> => {
  const stages = options.only ? [options.only] : ['structure', 'prompt', 'scene', 'panel-prompts'] as const

  if (stages.includes('structure')) {
    await estimateStructureScriptsPrice({
      scriptPath: options.scriptPath,
      sceneSlug: options.sceneSlug,
      ...(options.llmModel ? { llmModel: options.llmModel } : {}),
    })
  }

  if (stages.includes('prompt')) {
    comicWrite(`${'Comic'} - Price Estimate: draft-scenes --only prompt`)
    comicWrite('  The prompt-bundle stage makes no LLM or image generation API calls.')
    comicWrite('')
  }

  if (stages.includes('scene')) {
    await estimateSceneDraftPrice(options)
  }

  if (stages.includes('panel-prompts')) {
    estimatePanelPromptsPrice()
  }
}

const estimateStructureScriptsPrice = async (options: StructureScriptsCommandOptions): Promise<void> => {
  comicWrite(`${'Comic'} - Price Estimate: draft-scenes --only structure`)

  if (!options.llmModel) {
    comicWrite('  No --llm-model specified. The structure stage makes no API calls without --llm-model.')
    return
  }

  const model = options.llmModel
  const { scriptPath, sceneSlug } = options
  comicWrite(`  Model: ${model}`)
  comicWrite('')

  if (!existsSync(scriptPath)) {
    comicWrite(`  Script file not found: ${scriptPath}`)
    return
  }

  const content = await Bun.file(scriptPath).text()
  const tokens = estimateTokens(content)

  comicWrite('  Script files:')
  comicWrite(`    ${sceneSlug}`.padEnd(50, ' ') + `  ~${tokens.toLocaleString()} tokens`)
  comicWrite('')

  const totalInputTokens = tokens
  const totalCalls = 1
  const totalOutputTokens = ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL * totalCalls

  comicWrite(`  Estimated totals:`)
  comicWrite(`    Input:  ~${totalInputTokens.toLocaleString()} tokens (${totalCalls} call)`)
  comicWrite(`    Output: ~${totalOutputTokens.toLocaleString()} tokens (~${ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL} tokens per call)`)
  comicWrite('')

  const totalCost = estimateLlmCost(model, totalInputTokens, totalOutputTokens)
  const inputCost = estimateLlmCost(model, totalInputTokens, 0)
  const outputCost = estimateLlmCost(model, 0, totalOutputTokens)

  comicWrite(`  ${model}:`)
  comicWrite(`    Input cost:   ~${formatCost(inputCost)}`)
  comicWrite(`    Output cost:  ~${formatCost(outputCost)}`)
  comicWrite(`    Total:        ~${formatCost(totalCost)}`)
  comicWrite('')
  comicWrite('  Estimates: tokens ~ chars / 4, no cache discount, output ~800 tokens/call')
}

const printImageEstimateTable = (
  models: ImageGenerationModel[],
  quality: ImageGenerationQuality,
  size: ImageGenerationSize,
  totalOutputs: number,
  outputLabel: string
): void => {
  const colWidths = { model: 0 }
  const rows: ComicPriceModelRow[] = []

  for (const model of models) {
    const qualityLabel = isGeminiImageModel(model) ? 'ignored' : quality
    const modelLabel = `${model} (${qualityLabel})`
    colWidths.model = Math.max(colWidths.model, modelLabel.length)

    const pricePerImage = estimateImageOutputCost(model, quality, size)
    const subtotal = pricePerImage !== null ? pricePerImage * totalOutputs : null
    rows.push({ modelLabel, pricePerImage, subtotal })
  }

  const headerPer = 'per image'
  const headerOutputs = `x ${totalOutputs} ${outputLabel}${totalOutputs !== 1 ? 's' : ''}`
  const headerSubtotal = 'subtotal'

  comicWrite(`  ${''.padEnd(colWidths.model + 2)}  ${headerPer.padEnd(12)}  ${headerOutputs.padEnd(14)}  ${headerSubtotal}`)

  let grandTotal = 0
  let hasNullCost = false

  for (const { modelLabel, pricePerImage, subtotal } of rows) {
    const perImageStr = pricePerImage !== null ? formatCost(pricePerImage) : 'n/a'
    const subtotalStr = subtotal !== null ? formatCost(subtotal) : 'n/a'
    comicWrite(`  ${modelLabel.padEnd(colWidths.model + 2)}  ${perImageStr.padEnd(12)}               ${subtotalStr}`)
    if (subtotal !== null) {
      grandTotal += subtotal
    } else {
      hasNullCost = true
    }
  }

  comicWrite('')
  if (hasNullCost) {
    comicWrite(`  Total: ~${formatCost(grandTotal)} + n/a (some models have no per-image estimate)`)
  } else {
    comicWrite(`  Total: ~${formatCost(grandTotal)}`)
  }
  comicWrite('')
  comicWrite('  Per-image output cost only. Token-based input costs are not estimated.')
  if (models.some(isGeminiImageModel)) {
    comicWrite('  Gemini costs use estimated1KImage (~$0.067/image) -- actual token costs vary.')
  }
}

export const estimateCharacterSketchPrice = async (
  options: CharacterSketchCommandOptions
): Promise<void> => {
  if (!options.character) throw CLIUsageError('--character is required')
  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  if (models.length !== 1) throw CLIUsageError('comic reference-sketch accepts exactly one --image-model')
  const size: ImageGenerationSize = options.size ?? '1024x1536'
  const quality: ImageGenerationQuality = options.quality ?? 'medium'
  const catalog = loadCharacterCatalog()
  const key = catalog.requireKey(options.character)
  const character = catalog.get(key)
  const sourcePath = existsSync(character.sourcePath)
    ? character.sourcePath
    : character.generationReferencePath
  if (!sourcePath) throw CLIUsageError(`Character "${key}" has no source image or generationReference`)
  const referenceCount = options.revise && character.sourcePath !== character.outlineSheetPath ? 2 : 1
  validateImageSizeForModels(size, models)
  validateReferenceImageCount(models[0]!, referenceCount, `character-sketch ${options.revise ? 'revision' : 'generation'}`)
  if (options.revise) {
    await requireCurrentCharacterSketch(key, character)
  }

  comicWrite(`${'Comic'} - Price Estimate: reference-sketch --character`)
  comicWrite(`  Character: ${key}`)
  comicWrite(`  Source:    ${sourcePath}`)
  comicWrite(`  Model:     ${models[0]}`)
  comicWrite(`  Size:    ${size}  Quality: ${quality}`)
  comicWrite(`  References per view: ${referenceCount}`)
  comicWrite('')
  comicWrite(`  Views: ${CHARACTER_SKETCH_VIEWS.join(', ')}; the sheet is composed locally after all succeed.`)
  printImageEstimateTable(models, quality, size, CHARACTER_SKETCH_VIEWS.length, 'view')
}

export const estimateLocationReferencePrice = async (
  options: import('~/types').ReferenceSketchCommandOptions
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
  if (!LOCATION_VIEWS.includes(view)) throw CLIUsageError(`--view must be one of: ${LOCATION_VIEWS.join(', ')}`)
  if (view !== 'establishing' && !registration?.views.some(item => item.view === 'establishing')) throw CLIUsageError(`Cannot generate ${view} view before the establishing view`)
  if (options.revise && (!entry || !target)) throw CLIUsageError(`Cannot revise unregistered ${view} view for location "${options.location}"`)
  comicWrite(`${'Comic'} - Price Estimate: reference-sketch --location`)
  comicWrite(`  Location: ${options.location}  View: ${view}`)
  if (!options.revise && target) {
    await requireCurrentLocationReference(options.location!)
    comicWrite('  Existing validated view: no provider calls.')
    comicWrite('  Dry run: no provider calls and no files written.')
    return
  }
  const aggregationCalls = entry ? 0 : 1
  comicWrite(`  Location-spec aggregation (${options.llmModel ?? DEFAULT_LLM_MODEL}): ${aggregationCalls} call${aggregationCalls === 1 ? '' : 's'}`)
  comicWrite('  Initial location-reference image calls: 1')
  printImageEstimateTable([model], quality, size, 1, 'initial location view')
  comicWrite(`  Initial judge calls (${options.qaModel ?? DEFAULT_QA_MODEL}): ${qaEnabled ? 1 : 0}`)
  comicWrite(`  Maximum additional image repairs or fresh camera retries: ${qaEnabled ? maxRepairs : 0}`)
  comicWrite(`  Maximum additional judge calls: ${qaEnabled ? maxRepairs : 0}`)
  if (qaEnabled && maxRepairs > 0) printImageEstimateTable([DEFAULT_IMAGE_MODEL], quality, size, maxRepairs, 'maximum location retry')
  comicWrite('  Dry run: no provider calls and no files written.')
}

const printFinalImageHeader = (result: FinalImageEstimateResult): void => {
  const { request } = result
  const modeLabel = request.mode === 'grid' ? ' (grid mode)' : request.mode === 'page' ? ' (page mode)' : ''
  comicWrite(`${'Comic'} - Price Estimate: generate-images${modeLabel}`)
  comicWrite(`  Models:  ${request.models.join(', ')}`)
  if (request.variationsSpecified) {
    comicWrite(`  Variations: ${request.variations.map(getImagePromptVariationLabel).join(', ')}`)
  }
  comicWrite(`  Size:    ${request.size}  Quality: ${request.quality}`)
  if (request.mode === 'page') comicWrite(`  Panels per image: ${request.panelsPerImage}`)
  if (request.mode === 'grid') {
    comicWrite(`  Grid:    ${request.grid.columns}x${request.grid.rows} local composites from individual panels`)
  }
  comicWrite('')
}

const printImagePricingEstimate = (pricing: ImagePricingEstimate): void => {
  const modelWidth = pricing.rows.reduce((width, row) => Math.max(width, row.modelLabel.length), 0)
  const outputs = pricing.rows[0]?.outputs ?? 0
  const headerOutputs = `x ${outputs} ${pricing.outputLabel}${outputs !== 1 ? 's' : ''}`
  comicWrite(`  ${''.padEnd(modelWidth + 2)}  ${'per image'.padEnd(12)}  ${headerOutputs.padEnd(14)}  subtotal`)

  for (const row of pricing.rows) {
    const perImage = row.pricePerImage === null ? 'n/a' : formatCost(row.pricePerImage)
    const subtotal = row.subtotal === null ? 'n/a' : formatCost(row.subtotal)
    comicWrite(`  ${row.modelLabel.padEnd(modelWidth + 2)}  ${perImage.padEnd(12)}               ${subtotal}`)
  }

  comicWrite('')
  comicWrite(pricing.hasUnknown
    ? `  Total: ~${formatCost(pricing.knownTotal)} + n/a (some models have no per-image estimate)`
    : `  Total: ~${formatCost(pricing.knownTotal)}`)
  comicWrite('')
  comicWrite('  Per-image output cost only. Token-based input costs are not estimated.')
  if (pricing.rows.some(row => isGeminiImageModel(row.model))) {
    comicWrite('  Gemini costs use estimated1KImage (~$0.067/image) -- actual token costs vary.')
  }
}

const printPagePricingEstimate = (pricing: ImagePricingEstimate): void => {
  for (const row of pricing.rows) {
    const perImage = row.pricePerImage === null ? 'n/a' : formatCost(row.pricePerImage)
    const subtotal = row.subtotal === null ? 'n/a' : formatCost(row.subtotal)
    comicWrite(`    ${row.modelLabel}: ${row.outputs} page${row.outputs === 1 ? '' : 's'} x ${perImage} = ${subtotal}`)
  }
  comicWrite(`    Subtotal: ~${formatCost(pricing.knownTotal)}${pricing.hasUnknown ? ' + n/a' : ''}`)
  comicWrite('')
}

const printPageQaEstimate = (
  result: Extract<FinalImageEstimateResult, { status: 'ready' }>,
): void => {
  const qa = result.qaWork
  if (qa?.mode !== 'page') return

  comicWrite('  Page QA judge calls:')
  const reuseNote = qa.reusedReports > 0 ? ` (${qa.reusedReports} reused reports)` : ''
  comicWrite(`    Initial judge calls (${qa.judgeModel}): ${qa.initialJudgeCalls}${reuseNote}`)
  comicWrite(`    Maximum additional image edits: ${qa.maximumAdditionalImageEdits}`)
  comicWrite(`    Maximum additional judge calls: ${qa.maximumAdditionalJudgeCalls}`)
  if (result.pricing.repair) printImagePricingEstimate(result.pricing.repair)
  comicWrite(`    Heuristic judge tokens: ${qa.estimatedInputTokens.toLocaleString()} input + ${qa.estimatedOutputTokens.toLocaleString()} output = ~${formatCost(result.pricing.judgeCost ?? 0)}`)
  comicWrite('    Judge cost is separate from image-generation cost; actual vision token usage may vary.')
  comicWrite('')
}

const printPanelQaEstimate = (
  result: Extract<FinalImageEstimateResult, { status: 'ready' }>,
): void => {
  const qa = result.qaWork
  if (qa?.mode !== 'panel') return

  comicWrite(`  Initial judge calls (${qa.judgeModel}): ${qa.initialJudgeCalls}`)
  comicWrite(`  Maximum additional image edits: ${qa.maximumAdditionalImageEdits}`)
  comicWrite(`  Maximum additional judge calls: ${qa.maximumAdditionalJudgeCalls}`)
  if (result.pricing.repair) printImagePricingEstimate(result.pricing.repair)
  comicWrite(`  Maximum total judge calls: ${qa.maximumTotalJudgeCalls}`)
  comicWrite(`  Maximum heuristic judge tokens: ${qa.estimatedInputTokens.toLocaleString()} input + ${qa.estimatedOutputTokens.toLocaleString()} output = ~${formatCost(result.pricing.judgeCost ?? 0)}`)
  if (result.pricing.maximumModeledCost === null) {
    comicWrite(`  Maximum modeled cost: n/a image output pricing + ~${formatCost(result.pricing.judgeCost ?? 0)} heuristic QA`)
  } else {
    comicWrite(`  Maximum modeled cost (image outputs + heuristic QA): ~${formatCost(result.pricing.maximumModeledCost)}`)
  }
  comicWrite('  Image input tokens and actual vision-token usage are not modeled, so provider charges may vary.')
}

const printGridEstimate = (
  result: Extract<FinalImageEstimateResult, { status: 'ready' }>,
): void => {
  const grid = result.modeEstimate.mode === 'grid' ? result.modeEstimate.grid : null
  if (!grid) return
  const skipNote = grid.skipped > 0 ? ` (${grid.skipped} skipped -- already exist)` : ''

  comicWrite('  Grid pages:')
  comicWrite(
    `    ${result.request.sceneSlug.padEnd(40, ' ')}  ` +
    `${grid.totalOutputs} composite${grid.totalOutputs !== 1 ? 's' : ''} ` +
    `(${grid.columns}x${grid.rows}, ${grid.capacity} cells)${skipNote}`
  )
  comicWrite('')
  comicWrite('  Grid pages are local ImageMagick composites and add no API cost.')
  comicWrite('')
}

const printReadyFinalImageEstimate = (
  result: Extract<FinalImageEstimateResult, { status: 'ready' }>,
): void => {
  if (
    result.request.mode === 'page'
    && result.inventory.mode === 'page'
    && result.modeEstimate.mode === 'page'
  ) {
    comicWrite('  Reference preflight: canonical character references followed by distinct immutable location references in first-panel order')
    for (const page of result.inventory.pages) {
      comicWrite(`  Reference preflight page ${page.pageNumber}: ${page.referenceCount} required`)
    }
    comicWrite('  Pages:')
    const skipNote = result.modeEstimate.skipped > 0 ? ` (${result.modeEstimate.skipped} skipped -- already exist)` : ''
    comicWrite(`    ${result.request.sceneSlug.padEnd(40, ' ')}  ${result.modeEstimate.totalOutputs} page${result.modeEstimate.totalOutputs !== 1 ? 's' : ''}${skipNote}`)
    comicWrite('')
    if (result.modeEstimate.totalOutputs === 0) {
      comicWrite('  All page images already exist. Nothing to generate.')
      return
    }
    printPagePricingEstimate(result.pricing.primary)
    comicWrite('  Grouped pages use canonical character references followed by each distinct immutable location reference.')
    printPageQaEstimate(result)
    return
  }

  if (result.inventory.mode === 'page' || result.modeEstimate.mode === 'page') return
  for (const panel of result.inventory.panels) {
    comicWrite(`  Reference preflight panel ${panel.panelNumber}: ${panel.referenceCount} required`)
  }
  comicWrite('  Panels:')
  const skipNote = result.modeEstimate.skipped > 0 ? ` (${result.modeEstimate.skipped} skipped -- already exist)` : ''
  comicWrite(`    ${result.request.sceneSlug.padEnd(40, ' ')}  ${result.modeEstimate.totalOutputs} panel${result.modeEstimate.totalOutputs !== 1 ? 's' : ''}${skipNote}`)
  comicWrite('')
  if (result.modeEstimate.totalOutputs === 0) {
    comicWrite('  All panels already exist. Nothing to generate.')
    printGridEstimate(result)
    return
  }
  printImagePricingEstimate(result.pricing.primary)
  comicWrite(`  Initial image calls: ${result.modeEstimate.totalOutputs}`)
  printPanelQaEstimate(result)
  printGridEstimate(result)
}

const printFinalImageEstimate = (result: FinalImageEstimateResult): void => {
  printFinalImageHeader(result)
  if (result.status !== 'ready') {
    comicWrite(result.status === 'missing-prompts'
      ? '  No stable panel prompt bundles found. Run "bun autoshow comic draft-scenes <script-path> --only panel-prompts" first.'
      : '  No panel prompt bundles found.')
    return
  }
  printReadyFinalImageEstimate(result)
}

const estimateFinalPanelImagesPrice = async (options: GenerateImagesCommandOptions): Promise<void> => {
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
      pricing: estimateFinalImagePricing(request, modeEstimate, qaWork),
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
      pricing: estimateFinalImagePricing(request, modeEstimate, qaWork),
    })
  }
}

const estimateGenerateSketchesPrice = async (
  options: GenerateSketchesCommandOptions
): Promise<void> => {
  const { sceneSlug } = options
  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  const size: ImageGenerationSize = options.size ?? '1536x1024'
  const quality: ImageGenerationQuality = options.quality ?? 'high'
  const force = options.force ?? false
  const panelsPerImage = options.panelsPerImage ?? DEFAULT_SKETCH_PANELS_PER_IMAGE
  const useModelSpecificFilenames = models.length > 1
  validateImageSizeForModels(size, models)

  comicWrite(`${'Comic'} - Price Estimate: generate-images --target sketches`)
  comicWrite(`  Models:  ${models.join(', ')}`)
  comicWrite(`  Size:    ${size}  Quality: ${quality}`)
  comicWrite(`  Panels per sketch: ${panelsPerImage}`)
  comicWrite('')

  const panelPromptsDir = getPanelPromptsDirectory(sceneSlug)

  if (!existsSync(panelPromptsDir)) {
    comicWrite('  No stable panel prompt bundles found. Run "bun autoshow comic draft-scenes <script-path> --only panel-prompts" first.')
    return
  }

  const entries = await readdir(panelPromptsDir, { withFileTypes: true })
  const panelNumbers = entries
    .filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name))
    .map(entry => getPanelNumberFromName(entry.name))
    .filter((panelNumber): panelNumber is number => panelNumber !== null)
    .sort((left, right) => left - right)

  if (panelNumbers.length === 0) {
    comicWrite('  No panel prompt bundles found.')
    return
  }

  const { selectedChunks: selectedSketchChunks } = resolveSketchChunks(
    panelNumbers.map(panelNumber => ({ panelNumber })),
    {
      ...(options.sketchPanels !== undefined ? { sketchPanels: options.sketchPanels } : {}),
      panelsPerImage,
    },
    sceneSlug,
  )
  for (const chunk of selectedSketchChunks) {
    const chunkPanelNumbers: number[] = []
    for (let panelNumber = chunk.startPanelNumber; panelNumber <= chunk.endPanelNumber; panelNumber++) chunkPanelNumbers.push(panelNumber)
    const count = await validatePriceReferenceGroup(panelPromptsDir, chunkPanelNumbers, models)
    comicWrite(`  Reference preflight panels ${chunk.startPanelNumber}-${chunk.endPanelNumber}: ${count} required`)
  }

  let skipped = 0
  if (!force) {
    for (const sketchChunk of selectedSketchChunks) {
      const allExist = models.every(model => {
        const outputPath = getSketchComicImagePath(
          sceneSlug,
          sketchChunk.startPanelNumber,
          sketchChunk.endPanelNumber,
          useModelSpecificFilenames ? model : undefined
        )
        return existsSync(outputPath)
      })
      if (allExist) {
        skipped++
      }
    }
  }

  const totalSketches = selectedSketchChunks.length - skipped
  const firstSelectedSketchChunk = selectedSketchChunks[0]
  const lastSelectedSketchChunk = selectedSketchChunks.at(-1)
  let label = sceneSlug
  if (
    options.sketchPanels !== undefined
    && options.sketchPanels !== 'all'
    && firstSelectedSketchChunk
    && lastSelectedSketchChunk
  ) {
    label = `${sceneSlug}/panels-${String(firstSelectedSketchChunk.startPanelNumber).padStart(2, '0')}-${String(lastSelectedSketchChunk.endPanelNumber).padStart(2, '0')}`
  } else if (options.sketchPanels === 'all') {
    label = `${sceneSlug}/all-panels`
  }
  const sceneSketchCount: SceneSketchCount = { label, sketches: totalSketches, skipped }

  comicWrite('  Sketch chunks:')
  const skipNote = sceneSketchCount.skipped > 0 ? ` (${sceneSketchCount.skipped} skipped -- already exist)` : ''
  comicWrite(`    ${sceneSketchCount.label.padEnd(40, ' ')}  ${sceneSketchCount.sketches} sketch${sceneSketchCount.sketches !== 1 ? 'es' : ''}${skipNote}`)
  comicWrite('')

  if (totalSketches === 0) {
    comicWrite('  All sketch chunks already exist. Nothing to generate.')
    return
  }

  printImageEstimateTable(models, quality, size, totalSketches, 'sketch')
}

export const estimateGenerateImagesPrice = async (
  options: GenerateImagesCommandOptions
): Promise<void> => {
  const { sceneSlug } = options
  const sceneJsonExists = existsSync(getSceneJsonPath(sceneSlug))
  const target = options.target ?? 'images'

  validateComicGridOptions(options.grid, {
    target,
    size: options.size ?? COMIC_GRID_PANEL_SIZE,
    panelsPerImage: options.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE,
  })

  if (target === 'sketches') {
    const sketchPanels = panelSelectionToSketchRange(options.panels)
    await estimateGenerateSketchesPrice({
      sceneSlug: options.sceneSlug,
      ...(options.imageModels ? { imageModels: options.imageModels } : {}),
      ...(options.size ? { size: options.size } : {}),
      ...(options.quality ? { quality: options.quality } : {}),
      ...(options.force !== undefined ? { force: options.force } : {}),
      ...(sketchPanels !== undefined ? { sketchPanels } : {}),
      ...(options.panelsPerImage !== undefined ? { panelsPerImage: options.panelsPerImage } : {}),
    })
    return
  }

  if (!sceneJsonExists) {
    comicWrite(`${'Comic'} - Price Estimate: generate-images`)
    comicWrite('  Reviewed schemaVersion 4 scene and panel bundles are required. Run draft-scenes explicitly; generate-images price mode never drafts or upgrades artifacts.')
    return
  }
  try {
    v.parse(ScenePromptDataSchema, JSON.parse(readFileSync(getSceneJsonPath(sceneSlug), 'utf8')))
  } catch {
    comicWrite(`${'Comic'} - Price Estimate: generate-images`)
    comicWrite('  The scene is not reviewed schemaVersion 4. Run draft-scenes explicitly; older scene artifacts cannot enter controlled image generation.')
    return
  }

  if (target === 'both') {
    const sketchPanels = panelSelectionToSketchRange(options.panels)
    await estimateGenerateSketchesPrice({
      sceneSlug: options.sceneSlug,
      ...(options.imageModels ? { imageModels: options.imageModels } : {}),
      ...(options.size ? { size: options.size } : {}),
      ...(options.quality ? { quality: options.quality } : {}),
      ...(options.force !== undefined ? { force: options.force } : {}),
      ...(sketchPanels !== undefined ? { sketchPanels } : {}),
      ...(options.panelsPerImage !== undefined ? { panelsPerImage: options.panelsPerImage } : {}),
    })
  }

  if (target === 'images' || target === 'both') {
    await estimateFinalPanelImagesPrice(options)
  }
}
