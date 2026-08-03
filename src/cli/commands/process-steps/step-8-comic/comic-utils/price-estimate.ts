import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import * as v from 'valibot'
import type { CharacterSketchCommandOptions, ComicPriceModelRow, DraftScenesCommandOptions, GenerateImagesCommandOptions, GenerateSketchesCommandOptions, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, ImagePromptVariation, ScenePanelCount, SceneSketchCount, StructureScriptsCommandOptions } from '~/types'
import {
COMIC_GRID_PANEL_SIZE,
DEFAULT_PANELS_PER_IMAGE,
DEFAULT_FINAL_PANELS_PER_IMAGE,
chunkComicGridPanels,
chunkComicPagePanels,
getComicGridCapacity,
panelSelectionToSketchRange,
selectComicPanels,
validateComicGridOptions,
} from '../comic-commands/generate-images/comic-page-utils'
import {
getImagePromptVariationLabel,
} from '../comic-commands/generate-images/prompt-variations'
import {
resolveSketchChunks,
} from '../comic-commands/generate-sketches/generate-scene-sketches'
import {
CHARACTER_SKETCH_VIEWS,
requireCurrentCharacterSketch,
} from '../comic-commands/process-scenes/character-utils'
import { estimateImageOutputCost, formatCost } from '../comic-image-services/image-costs'
import { estimateLlmCostFromRegistry } from './structured-script-utils/llm-cost'
import { DEFAULT_PAGE_QA_MODEL } from '../comic-commands/generate-images/comic-page-qa'
import { isGeminiImageModel } from './image-service'
import { DEFAULT_LLM_MODEL } from './cli-args'
import { CLIUsageError } from '~/utils/error-handler'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from './image-size'
import { ScenePromptDataSchema } from '../schemas/schemas'
import { bold, cyan, l } from './comic-logger'
import { loadCharacterCatalog } from './character-reference-config'
import { validateReferenceImageCount } from './reference-capabilities'
import { LOCATION_VIEWS, readLocationReferenceCatalog, readLocationSketchManifest, requireCurrentLocationReference } from './location-reference'
import {
PANEL_DIRECTORY_PATTERN,
applyReferenceImageLimits,
extractPanelBundleData,
getPanelNumberFromName,
getPromptBundleFilename,
resolvePrimaryCharacterReferencesAcrossPanels,
resolveLocationReferencesAcrossPanels,
} from './panel-prompt-utils'
import {
getDraftPromptPath,
getPanelPromptsDirectory,
getSceneJsonPath,
} from './project-paths'
import {
getPageComicImagePath,
getPanelComicImagePath,
getSketchComicImagePath,
} from './scene-utils'

const ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL = 800

const estimateTokens = (content: string): number => {
  return Math.ceil(content.length / 4)
}

const estimateLlmCost = (model: DraftScenesCommandOptions['llmModel'], inputTokens: number, outputTokens: number): number =>
  estimateLlmCostFromRegistry(model ?? DEFAULT_LLM_MODEL, inputTokens, outputTokens)

const estimateSceneDraftPrice = async (options: DraftScenesCommandOptions): Promise<void> => {
  const model = options.llmModel ?? DEFAULT_LLM_MODEL
  const { sceneSlug } = options

  l(`${bold('Comic')} - Price Estimate: draft-scenes --only scene`)
  l(`${cyan('='.repeat(50))}\n`)
  l(`  Model: ${model}`)
  l('')

  const draftPromptPath = getDraftPromptPath(sceneSlug)

  if (!existsSync(draftPromptPath)) {
    l('  No draft prompt file found. Run "bun autoshow comic draft-scenes --only prompt" first.')
    return
  }

  const content = await Bun.file(draftPromptPath).text()
  const tokens = estimateTokens(content)

  l('  Prompt files:')
  l(`    ${sceneSlug}/draft-prompt.md`.padEnd(50, ' ') + `  ~${tokens.toLocaleString()} tokens`)
  l('')

  const totalInputTokens = tokens
  const totalCalls = 1
  const totalOutputTokens = ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL * totalCalls

  l(`  Estimated totals:`)
  l(`    Input:  ~${totalInputTokens.toLocaleString()} tokens (${totalCalls} call)`)
  l(`    Output: ~${totalOutputTokens.toLocaleString()} tokens (~${ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL} tokens per call)`)
  l('')

  const totalCost = estimateLlmCost(model, totalInputTokens, totalOutputTokens)
  const inputCost = estimateLlmCost(model, totalInputTokens, 0)
  const outputCost = estimateLlmCost(model, 0, totalOutputTokens)

  l(`  ${model}:`)
  l(`    Input cost:   ~${formatCost(inputCost)}`)
  l(`    Output cost:  ~${formatCost(outputCost)}`)
  l(`    Total:        ~${formatCost(totalCost)}`)
  l('')
  l.dim('  Estimates: tokens ~ chars / 4, no cache discount, output ~800 tokens/call')
}

const estimatePanelPromptsPrice = (): void => {
  l(`${bold('Comic')} - Price Estimate: draft-scenes --only panel-prompts`)
  l(`${cyan('='.repeat(50))}\n`)
  l('  The panel-prompt stage makes no LLM or image generation API calls.')
  l('')
}

const printGridCompositeEstimate = (
  sceneSlug: string,
  selectedPanelNumbers: number[],
  options: {
    grid: NonNullable<GenerateImagesCommandOptions['grid']>
    models: ImageGenerationModel[]
    variations: ImagePromptVariation[]
    useVariationOutputPaths: boolean
    useModelSpecificFilenames: boolean
    force: boolean
  }
): void => {
  const gridChunks = chunkComicGridPanels(
    selectedPanelNumbers.map(panelNumber => ({ panelNumber })),
    options.grid,
  )
  const capacity = getComicGridCapacity(options.grid)
  let skipped = 0

  if (!options.force) {
    for (const gridChunk of gridChunks) {
      for (const variation of options.variations) {
        for (const model of options.models) {
          const outputPath = getPageComicImagePath(
            sceneSlug,
            gridChunk.pageNumber,
            gridChunk.panelNumbers,
            options.useVariationOutputPaths ? model : options.useModelSpecificFilenames ? model : undefined,
            options.useVariationOutputPaths ? variation : undefined
          )
          if (existsSync(outputPath)) {
            skipped++
          }
        }
      }
    }
  }

  const totalCompositeOutputs = (
    gridChunks.length *
    options.variations.length *
    options.models.length
  ) - skipped
  const skipNote = skipped > 0 ? ` (${skipped} skipped -- already exist)` : ''

  l('  Grid pages:')
  l(
    `    ${sceneSlug.padEnd(40, ' ')}  ` +
    `${totalCompositeOutputs} composite${totalCompositeOutputs !== 1 ? 's' : ''} ` +
    `(${options.grid.columns}x${options.grid.rows}, ${capacity} cells)${skipNote}`
  )
  l('')
  l.dim('  Grid pages are local ImageMagick composites and add no API cost.')
  l('')
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
    l(`${bold('Comic')} - Price Estimate: draft-scenes --only prompt`)
    l(`${cyan('='.repeat(50))}\n`)
    l('  The prompt-bundle stage makes no LLM or image generation API calls.')
    l('')
  }

  if (stages.includes('scene')) {
    await estimateSceneDraftPrice(options)
  }

  if (stages.includes('panel-prompts')) {
    estimatePanelPromptsPrice()
  }
}

const estimateStructureScriptsPrice = async (options: StructureScriptsCommandOptions): Promise<void> => {
  l(`${bold('Comic')} - Price Estimate: draft-scenes --only structure`)
  l(`${cyan('='.repeat(50))}\n`)

  if (!options.llmModel) {
    l('  No --llm-model specified. The structure stage makes no API calls without --llm-model.')
    return
  }

  const model = options.llmModel
  const { scriptPath, sceneSlug } = options
  l(`  Model: ${model}`)
  l('')

  if (!existsSync(scriptPath)) {
    l(`  Script file not found: ${scriptPath}`)
    return
  }

  const content = await Bun.file(scriptPath).text()
  const tokens = estimateTokens(content)

  l('  Script files:')
  l(`    ${sceneSlug}`.padEnd(50, ' ') + `  ~${tokens.toLocaleString()} tokens`)
  l('')

  const totalInputTokens = tokens
  const totalCalls = 1
  const totalOutputTokens = ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL * totalCalls

  l(`  Estimated totals:`)
  l(`    Input:  ~${totalInputTokens.toLocaleString()} tokens (${totalCalls} call)`)
  l(`    Output: ~${totalOutputTokens.toLocaleString()} tokens (~${ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL} tokens per call)`)
  l('')

  const totalCost = estimateLlmCost(model, totalInputTokens, totalOutputTokens)
  const inputCost = estimateLlmCost(model, totalInputTokens, 0)
  const outputCost = estimateLlmCost(model, 0, totalOutputTokens)

  l(`  ${model}:`)
  l(`    Input cost:   ~${formatCost(inputCost)}`)
  l(`    Output cost:  ~${formatCost(outputCost)}`)
  l(`    Total:        ~${formatCost(totalCost)}`)
  l('')
  l.dim('  Estimates: tokens ~ chars / 4, no cache discount, output ~800 tokens/call')
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

  l(`  ${''.padEnd(colWidths.model + 2)}  ${headerPer.padEnd(12)}  ${headerOutputs.padEnd(14)}  ${headerSubtotal}`)

  let grandTotal = 0
  let hasNullCost = false

  for (const { modelLabel, pricePerImage, subtotal } of rows) {
    const perImageStr = pricePerImage !== null ? formatCost(pricePerImage) : 'n/a'
    const subtotalStr = subtotal !== null ? formatCost(subtotal) : 'n/a'
    l(`  ${modelLabel.padEnd(colWidths.model + 2)}  ${perImageStr.padEnd(12)}               ${subtotalStr}`)
    if (subtotal !== null) {
      grandTotal += subtotal
    } else {
      hasNullCost = true
    }
  }

  l('')
  if (hasNullCost) {
    l(`  Total: ~${formatCost(grandTotal)} + n/a (some models have no per-image estimate)`)
  } else {
    l(`  Total: ~${formatCost(grandTotal)}`)
  }
  l('')
  l.dim('  Per-image output cost only. Token-based input costs are not estimated.')
  if (models.some(isGeminiImageModel)) {
    l.dim('  Gemini costs use estimated1KImage (~$0.067/image) -- actual token costs vary.')
  }
}

const printImageEstimateTableByModel = (
  models: ImageGenerationModel[],
  quality: ImageGenerationQuality,
  size: ImageGenerationSize,
  outputsByModel: ReadonlyMap<ImageGenerationModel, number>,
  outputLabel: string,
): void => {
  let grandTotal = 0
  let hasNullCost = false

  for (const model of models) {
    const outputs = outputsByModel.get(model) ?? 0
    const pricePerImage = estimateImageOutputCost(model, quality, size)
    const subtotal = pricePerImage === null ? null : pricePerImage * outputs
    const qualityLabel = isGeminiImageModel(model) ? 'ignored' : quality
    l(
      `    ${model} (${qualityLabel}): ${outputs} ${outputLabel}${outputs === 1 ? '' : 's'} x ` +
      `${pricePerImage === null ? 'n/a' : formatCost(pricePerImage)} = ${subtotal === null ? 'n/a' : formatCost(subtotal)}`
    )
    if (subtotal === null) hasNullCost = true
    else grandTotal += subtotal
  }

  l(`    Subtotal: ~${formatCost(grandTotal)}${hasNullCost ? ' + n/a' : ''}`)
  l('')
}

export const estimateCharacterSketchPrice = async (
  options: CharacterSketchCommandOptions
): Promise<void> => {
  if (!options.character) throw CLIUsageError('--character is required')
  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  if (models.length !== 1) throw CLIUsageError('character-sketch accepts exactly one --image-model')
  const size: ImageGenerationSize = options.size ?? '1024x1536'
  const quality: ImageGenerationQuality = options.quality ?? 'medium'
  const catalog = loadCharacterCatalog()
  const key = catalog.requireKey(options.character)
  const character = catalog.get(key)
  validateImageSizeForModels(size, models)
  validateReferenceImageCount(models[0]!, options.revise ? 2 : 1, `character-sketch ${options.revise ? 'revision' : 'generation'}`)
  if (options.revise) {
    await requireCurrentCharacterSketch(key, character)
  }

  l(`${bold('Comic')} - Price Estimate: character-sketch`)
  l(`${cyan('='.repeat(50))}\n`)
  l(`  Character: ${key}`)
  l(`  Source:    ${character.sourcePath}`)
  l(`  Model:     ${models[0]}`)
  l(`  Size:    ${size}  Quality: ${quality}`)
  l(`  References per view: ${options.revise ? 2 : 1}`)
  l('')
  l(`  Views: ${CHARACTER_SKETCH_VIEWS.join(', ')}; the sheet is composed locally after all succeed.`)
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
  l(`${bold('Comic')} - Price Estimate: reference-sketch --location`)
  l(`${cyan('='.repeat(50))}\n`)
  l(`  Location: ${options.location}  View: ${view}`)
  if (!options.revise && target) {
    await requireCurrentLocationReference(options.location!)
    l('  Existing validated view: no provider calls.')
    l.dim('  Dry run: no provider calls and no files written.')
    return
  }
  const aggregationCalls = entry ? 0 : 1
  l(`  Location-spec aggregation (${options.llmModel ?? DEFAULT_LLM_MODEL}): ${aggregationCalls} call${aggregationCalls === 1 ? '' : 's'}`)
  l('  Initial location-reference image calls: 1')
  printImageEstimateTable([model], quality, size, 1, 'initial location view')
  l(`  Initial judge calls (${options.qaModel ?? DEFAULT_PAGE_QA_MODEL}): ${qaEnabled ? 1 : 0}`)
  l(`  Maximum additional image repairs or fresh camera retries: ${qaEnabled ? maxRepairs : 0}`)
  l(`  Maximum additional judge calls: ${qaEnabled ? maxRepairs : 0}`)
  if (qaEnabled && maxRepairs > 0) printImageEstimateTable([DEFAULT_IMAGE_MODEL], quality, size, maxRepairs, 'maximum location retry')
  l.dim('  Dry run: no provider calls and no files written.')
}

const readPricePanelInput = async (panelPromptsDir: string, panelNumber: number) => {
  const panelDirectory = join(panelPromptsDir, `panel-${String(panelNumber).padStart(2, '0')}`)
  const entries = await readdir(panelDirectory, { withFileTypes: true })
  const promptFilename = getPromptBundleFilename(panelDirectory, entries)
  const bundleData = extractPanelBundleData(await Bun.file(join(panelDirectory, promptFilename)).text())
  return { panelDirectory, entries, bundleData }
}

const validatePriceReferenceGroup = async (panelPromptsDir: string, panelNumbers: number[], models: ImageGenerationModel[]): Promise<number> => {
  const panels = await Promise.all(panelNumbers.map(number => readPricePanelInput(panelPromptsDir, number)))
  const primary = resolvePrimaryCharacterReferencesAcrossPanels(panels, { composeDerived: false })
  const locations = resolveLocationReferencesAcrossPanels(panels)
  const locationPlaceholders = locations.map((_, index) => `__location-${index + 1}__`)
  for (const model of models) {
    applyReferenceImageLimits([...primary.primaryCharacterRefs, ...locationPlaceholders], [...primary.primaryCharacterRefs, ...locationPlaceholders], primary.sketchCharacterRefs, primary.canonicalCharacterRefs, [], locationPlaceholders, primary.missingPrimaryCharacterRefs, model)
  }
  return primary.primaryCharacterRefs.length + locations.length
}

const estimateFinalPanelImagesPrice = async (options: GenerateImagesCommandOptions): Promise<void> => {
  const { sceneSlug } = options
  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  const size: ImageGenerationSize = options.size ?? COMIC_GRID_PANEL_SIZE
  const quality: ImageGenerationQuality = options.quality ?? 'high'
  const force = options.force ?? false
  const panelsPerImage = options.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE
  const useGridMode = options.grid !== undefined
  const usePageMode = !useGridMode && panelsPerImage > 1
  const useModelSpecificFilenames = models.length > 1
  const variations: ImagePromptVariation[] = options.variations ?? ['canonical']
  const useVariationOutputPaths = options.variations !== undefined
  validateImageSizeForModels(size, models)
  validateComicGridOptions(options.grid, {
    target: 'images',
    size,
    panelsPerImage,
  })

  l(`${bold('Comic')} - Price Estimate: generate-images${useGridMode ? ' (grid mode)' : usePageMode ? ' (page mode)' : ''}`)
  l(`${cyan('='.repeat(50))}\n`)
  l(`  Models:  ${models.join(', ')}`)
  if (options.variations !== undefined) {
    l(`  Variations: ${options.variations.map(getImagePromptVariationLabel).join(', ')}`)
  }
  l(`  Size:    ${size}  Quality: ${quality}`)
  if (usePageMode) {
    l(`  Panels per image: ${panelsPerImage}`)
  }
  if (options.grid) {
    l(`  Grid:    ${options.grid.columns}x${options.grid.rows} local composites from individual panels`)
  }
  l('')

  const panelPromptsDir = getPanelPromptsDirectory(sceneSlug)

  if (!existsSync(panelPromptsDir)) {
    l('  No stable panel prompt bundles found. Run "bun autoshow comic draft-scenes <script-path> --only panel-prompts" first.')
    return
  }

  const entries = await readdir(panelPromptsDir, { withFileTypes: true })
  const panelNumbers = entries
    .filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name))
    .map(entry => getPanelNumberFromName(entry.name))
    .filter((panelNumber): panelNumber is number => panelNumber !== null)
    .sort((left, right) => left - right)

  if (panelNumbers.length === 0) {
    l('  No panel prompt bundles found.')
    return
  }

  if (usePageMode) {
    const selectedPanels = selectComicPanels(
      panelNumbers.map(panelNumber => ({ panelNumber })),
      options.panels ?? 'all',
      undefined,
      sceneSlug,
    )
    const pageChunks = chunkComicPagePanels(selectedPanels, panelsPerImage)
    l('  Reference preflight: canonical character references followed by distinct immutable location references in first-panel order')
    for (const pageChunk of pageChunks) {
      const count = await validatePriceReferenceGroup(panelPromptsDir, pageChunk.panelNumbers, models)
      if ((options.qa ?? options.pageQa ?? true) && (options.maxRepairs ?? 2) > 0) validateReferenceImageCount(DEFAULT_IMAGE_MODEL, count + 1, `QA edits for page ${pageChunk.pageNumber}`)
      l(`  Reference preflight page ${pageChunk.pageNumber}: ${count} required`)
    }

    const pageOutputsByModel = new Map<ImageGenerationModel, number>()
    let skippedPages = 0
    for (const model of models) {
      let pageOutputs = 0
      for (const variation of variations) {
        for (const pageChunk of pageChunks) {
          const outputPath = getPageComicImagePath(
              sceneSlug,
              pageChunk.pageNumber,
              pageChunk.panelNumbers,
              useVariationOutputPaths ? model : useModelSpecificFilenames ? model : undefined,
              useVariationOutputPaths ? variation : undefined
            )
          if (!force && existsSync(outputPath)) skippedPages++
          else pageOutputs++
        }
      }
      pageOutputsByModel.set(model, pageOutputs)
    }

    const totalPages = Array.from(pageOutputsByModel.values()).reduce((sum, count) => sum + count, 0)

    l('  Pages:')
    const skipNote = skippedPages > 0 ? ` (${skippedPages} skipped -- already exist)` : ''
    l(`    ${sceneSlug.padEnd(40, ' ')}  ${totalPages} page${totalPages !== 1 ? 's' : ''}${skipNote}`)
    l('')

    if (totalPages === 0) {
      l('  All page images already exist. Nothing to generate.')
      return
    }

    printImageEstimateTableByModel(models, quality, size, pageOutputsByModel, 'page')
    l.dim('  Grouped pages use canonical character references followed by each distinct immutable location reference.')
    if (options.qa ?? options.pageQa ?? true) {
      const judgeModel = options.qaModel ?? options.pageQaModel ?? DEFAULT_PAGE_QA_MODEL
      const maxRepairs = options.maxRepairs ?? 2
      let judgeCalls = 0
      let reusedReports = 0
      for (const model of models) for (const variation of variations) for (const pageChunk of pageChunks) {
        const outputPath = getPageComicImagePath(
          sceneSlug, pageChunk.pageNumber, pageChunk.panelNumbers,
          useVariationOutputPaths ? model : useModelSpecificFilenames ? model : undefined,
          useVariationOutputPaths ? variation : undefined,
        )
        const reportPath = join(dirname(outputPath), 'page-qa-report.json')
        let reusable = false
        if (!force && existsSync(reportPath)) {
          try {
            const report = JSON.parse(readFileSync(reportPath, 'utf8')) as { schemaVersion?: number; pages?: Array<{ outputFile?: string; judgeModel?: string }> }
            reusable = report.schemaVersion === 1 && report.pages?.some(entry => entry.outputFile === basename(outputPath) && entry.judgeModel === judgeModel) === true
          } catch {}
        }
        if (reusable) reusedReports++
        else judgeCalls++
      }
      const estimatedInputTokens = judgeCalls * 5000
      const estimatedOutputTokens = judgeCalls * 1200
      const judgeCost = estimateLlmCostFromRegistry(judgeModel, estimatedInputTokens, estimatedOutputTokens)
      l('  Page QA judge calls:')
      l(`    Initial judge calls (${judgeModel}): ${judgeCalls}${reusedReports > 0 ? ` (${reusedReports} reused reports)` : ''}`)
      l(`    Maximum additional image edits: ${judgeCalls * maxRepairs}`)
      l(`    Maximum additional judge calls: ${judgeCalls * maxRepairs}`)
      if (judgeCalls * maxRepairs > 0) printImageEstimateTable([DEFAULT_IMAGE_MODEL], quality, size, judgeCalls * maxRepairs, 'maximum repair')
      l(`    Heuristic judge tokens: ${estimatedInputTokens.toLocaleString()} input + ${estimatedOutputTokens.toLocaleString()} output = ~${formatCost(judgeCost)}`)
      l.dim('    Judge cost is separate from image-generation cost; actual vision token usage may vary.')
      l('')
    }
    return
  }

  const panelDirs = entries
    .filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name))
    .map(entry => entry.name)
    .sort()

  let panelList = panelDirs
  let selectedPanelNumbers = panelDirs
    .map(name => getPanelNumberFromName(name))
    .filter((panelNumber): panelNumber is number => panelNumber !== null)
  if (options.panels !== undefined) {
    const availablePanelNumbers = panelDirs
      .map(name => getPanelNumberFromName(name))
      .filter((panelNumber): panelNumber is number => panelNumber !== null)
    const selected = selectComicPanels(
      availablePanelNumbers.map(panelNumber => ({ panelNumber, name: `panel-${String(panelNumber).padStart(2, '0')}` })),
      options.panels,
      undefined,
      sceneSlug,
    )
    panelList = selected.map(s => s.name)
    selectedPanelNumbers = selected.map(s => s.panelNumber)
  }

  for (const panelNumber of selectedPanelNumbers) {
    const count = await validatePriceReferenceGroup(panelPromptsDir, [panelNumber], models)
    if ((options.qa ?? options.pageQa ?? true) && (options.maxRepairs ?? 2) > 0) validateReferenceImageCount(DEFAULT_IMAGE_MODEL, count + 1, `QA edits for panel ${panelNumber}`)
    l(`  Reference preflight panel ${panelNumber}: ${count} required`)
  }

  let skipped = 0
  if (!force) {
    for (const panelDir of panelList) {
      const match = panelDir.match(PANEL_DIRECTORY_PATTERN)
      if (!match?.[1]) continue
      const panelNumber = Number(match[1])
      for (const variation of variations) {
        const allExist = models.every(model => {
          const outputPath = getPanelComicImagePath(
            sceneSlug,
            panelNumber,
            useVariationOutputPaths ? model : useModelSpecificFilenames ? model : undefined,
            useVariationOutputPaths ? variation : undefined
          )
          return existsSync(outputPath)
        })
        if (allExist) skipped++
      }
    }
  }

  const totalPanels = (panelList.length * variations.length) - skipped
  const scenePanelCount: ScenePanelCount = { panels: totalPanels, skipped }

  l('  Panels:')
  const skipNote = scenePanelCount.skipped > 0 ? ` (${scenePanelCount.skipped} skipped -- already exist)` : ''
  l(`    ${sceneSlug.padEnd(40, ' ')}  ${scenePanelCount.panels} panel${scenePanelCount.panels !== 1 ? 's' : ''}${skipNote}`)
  l('')

  if (totalPanels === 0) {
    l('  All panels already exist. Nothing to generate.')
    if (options.grid) {
      printGridCompositeEstimate(sceneSlug, selectedPanelNumbers, {
        grid: options.grid,
        models,
        variations,
        useVariationOutputPaths,
        useModelSpecificFilenames,
        force,
      })
    }
    return
  }

  printImageEstimateTable(models, quality, size, totalPanels, 'panel')
  l(`  Initial image calls: ${totalPanels}`)
  if (options.qa ?? options.pageQa ?? true) {
    const maxRepairs = options.maxRepairs ?? 2
    const judgeModel = options.qaModel ?? options.pageQaModel ?? DEFAULT_PAGE_QA_MODEL
    l(`  Initial judge calls (${judgeModel}): ${totalPanels}`)
    l(`  Maximum additional image edits: ${totalPanels * maxRepairs}`)
    l(`  Maximum additional judge calls: ${totalPanels * maxRepairs}`)
    if (totalPanels * maxRepairs > 0) printImageEstimateTable([DEFAULT_IMAGE_MODEL], quality, size, totalPanels * maxRepairs, 'maximum repair')
    const initialImageCost = models.reduce((sum, model) => {
      const price = estimateImageOutputCost(model, quality, size)
      return price === null ? Number.NaN : sum + price * totalPanels
    }, 0)
    const repairImagePrice = estimateImageOutputCost(DEFAULT_IMAGE_MODEL, quality, size)
    const maximumImageCost = repairImagePrice === null ? Number.NaN : initialImageCost + repairImagePrice * totalPanels * maxRepairs
    const maximumJudgeCalls = totalPanels * (1 + maxRepairs)
    const estimatedInputTokens = maximumJudgeCalls * 5000
    const estimatedOutputTokens = maximumJudgeCalls * 1200
    const maximumJudgeCost = estimateLlmCostFromRegistry(judgeModel, estimatedInputTokens, estimatedOutputTokens)
    l(`  Maximum total judge calls: ${maximumJudgeCalls}`)
    l(`  Maximum heuristic judge tokens: ${estimatedInputTokens.toLocaleString()} input + ${estimatedOutputTokens.toLocaleString()} output = ~${formatCost(maximumJudgeCost)}`)
    if (Number.isFinite(maximumImageCost)) {
      l(`  Maximum modeled cost (image outputs + heuristic QA): ~${formatCost(maximumImageCost + maximumJudgeCost)}`)
    } else {
      l(`  Maximum modeled cost: n/a image output pricing + ~${formatCost(maximumJudgeCost)} heuristic QA`)
    }
    l.dim('  Image input tokens and actual vision-token usage are not modeled, so provider charges may vary.')
  }
  if (options.grid) {
    printGridCompositeEstimate(sceneSlug, selectedPanelNumbers, {
      grid: options.grid,
      models,
      variations,
      useVariationOutputPaths,
      useModelSpecificFilenames,
      force,
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
  const panelsPerImage = options.panelsPerImage ?? DEFAULT_PANELS_PER_IMAGE
  const useModelSpecificFilenames = models.length > 1
  validateImageSizeForModels(size, models)

  l(`${bold('Comic')} - Price Estimate: generate-images --target sketches`)
  l(`${cyan('='.repeat(50))}\n`)
  l(`  Models:  ${models.join(', ')}`)
  l(`  Size:    ${size}  Quality: ${quality}`)
  l(`  Panels per sketch: ${panelsPerImage}`)
  l('')

  const panelPromptsDir = getPanelPromptsDirectory(sceneSlug)

  if (!existsSync(panelPromptsDir)) {
    l('  No stable panel prompt bundles found. Run "bun autoshow comic draft-scenes <script-path> --only panel-prompts" first.')
    return
  }

  const entries = await readdir(panelPromptsDir, { withFileTypes: true })
  const panelNumbers = entries
    .filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name))
    .map(entry => getPanelNumberFromName(entry.name))
    .filter((panelNumber): panelNumber is number => panelNumber !== null)
    .sort((left, right) => left - right)

  if (panelNumbers.length === 0) {
    l('  No panel prompt bundles found.')
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
    l(`  Reference preflight panels ${chunk.startPanelNumber}-${chunk.endPanelNumber}: ${count} required`)
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

  l('  Sketch chunks:')
  const skipNote = sceneSketchCount.skipped > 0 ? ` (${sceneSketchCount.skipped} skipped -- already exist)` : ''
  l(`    ${sceneSketchCount.label.padEnd(40, ' ')}  ${sceneSketchCount.sketches} sketch${sceneSketchCount.sketches !== 1 ? 'es' : ''}${skipNote}`)
  l('')

  if (totalSketches === 0) {
    l('  All sketch chunks already exist. Nothing to generate.')
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
    l(`${bold('Comic')} - Price Estimate: generate-images`)
    l(`${cyan('='.repeat(50))}\n`)
    l('  Reviewed schemaVersion 4 scene and panel bundles are required. Run draft-scenes explicitly; generate-images price mode never drafts or upgrades artifacts.')
    return
  }
  try {
    v.parse(ScenePromptDataSchema, JSON.parse(readFileSync(getSceneJsonPath(sceneSlug), 'utf8')))
  } catch {
    l(`${bold('Comic')} - Price Estimate: generate-images`)
    l(`${cyan('='.repeat(50))}\n`)
    l('  The scene is not reviewed schemaVersion 4. Run draft-scenes explicitly; older scene artifacts cannot enter controlled image generation.')
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
