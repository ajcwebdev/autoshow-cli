import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import * as v from 'valibot'
import type { CharacterSketchCommandOptions, ComicPriceModelRow, DraftScenesCommandOptions, FinalImageEstimateResult, GenerateImagesCommandOptions, GenerateSketchesCommandOptions, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, ImagePricingEstimate, LogMetadata, SceneSketchCount, StructureScriptsCommandOptions } from '~/types'
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
import { priceDetails, priceLine, priceNotice, priceTable } from './price-estimate-logging'
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

const LLM_ESTIMATE_BASIS_NOTE = 'Estimates: tokens ~ chars / 4, no cache discount, output ~800 tokens/call'
const IMAGE_ESTIMATE_BASIS_NOTE = 'Per-image output cost only. Token-based input costs are not estimated.'
const GEMINI_IMAGE_ESTIMATE_NOTE = 'Gemini costs use estimated1KImage (~$0.067/image) -- actual token costs vary.'
const JUDGE_COST_BASIS_NOTE = 'Judge cost is separate from image-generation cost; actual vision token usage may vary.'
const PANEL_QA_BASIS_NOTE = 'Image input tokens and actual vision-token usage are not modeled, so provider charges may vary.'

const estimateTokens = (content: string): number => {
  return Math.ceil(content.length / 4)
}

const estimateLlmCost = (model: DraftScenesCommandOptions['llmModel'], inputTokens: number, outputTokens: number): number =>
  estimateLlmCostFromRegistry(model ?? DEFAULT_LLM_MODEL, inputTokens, outputTokens)

const logLlmTokenEstimate = (
  title: string,
  model: string,
  sourceLabel: string,
  sourcePath: string,
  tokens: number
): void => {
  const totalCalls = 1
  const totalOutputTokens = ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL * totalCalls
  const inputCost = estimateLlmCost(model, tokens, 0)
  const outputCost = estimateLlmCost(model, 0, totalOutputTokens)
  const totalCost = estimateLlmCost(model, tokens, totalOutputTokens)

  priceTable(
    title,
    [{
      model,
      [sourceLabel]: sourcePath,
      inputTokens: tokens.toLocaleString(),
      outputTokens: totalOutputTokens.toLocaleString(),
      inputCost: `~${formatCost(inputCost)}`,
      outputCost: `~${formatCost(outputCost)}`,
      total: `~${formatCost(totalCost)}`
    }],
    [sourceLabel, 'model', 'inputTokens', 'outputTokens', 'inputCost', 'outputCost', 'total'],
    {
      model,
      [sourceLabel]: sourcePath,
      inputTokens: tokens,
      outputTokens: totalOutputTokens,
      calls: totalCalls,
      inputCost,
      outputCost,
      totalCost
    }
  )
  priceLine(LLM_ESTIMATE_BASIS_NOTE, {
    tokensPerChar: 0.25,
    cacheDiscount: false,
    outputTokensPerCall: ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL
  })
}

const estimateSceneDraftPrice = async (options: DraftScenesCommandOptions): Promise<void> => {
  const model = options.llmModel ?? DEFAULT_LLM_MODEL
  const { sceneSlug } = options

  const draftPromptPath = getDraftPromptPath(sceneSlug)

  if (!existsSync(draftPromptPath)) {
    priceNotice('Comic - Price Estimate: draft-scenes --only scene: no draft prompt file found. Run "bun autoshow comic draft-scenes --only prompt" first.', {
      stage: 'draft-scenes:scene',
      model,
      draftPromptPath
    })
    return
  }

  const content = await Bun.file(draftPromptPath).text()
  logLlmTokenEstimate(
    'Comic - Price Estimate: draft-scenes --only scene',
    model,
    'promptFile',
    `${sceneSlug}/metadata/draft-prompt.md`,
    estimateTokens(content)
  )
}

const estimatePanelPromptsPrice = (): void => {
  priceLine('Comic - Price Estimate: draft-scenes --only panel-prompts: the panel-prompt stage makes no LLM or image generation API calls.', {
    stage: 'draft-scenes:panel-prompts',
    llmCalls: 0,
    imageCalls: 0,
    totalCost: 0
  })
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
    priceLine('Comic - Price Estimate: draft-scenes --only prompt: the prompt-bundle stage makes no LLM or image generation API calls.', {
      stage: 'draft-scenes:prompt',
      llmCalls: 0,
      imageCalls: 0,
      totalCost: 0
    })
  }

  if (stages.includes('scene')) {
    await estimateSceneDraftPrice(options)
  }

  if (stages.includes('panel-prompts')) {
    estimatePanelPromptsPrice()
  }
}

const estimateStructureScriptsPrice = async (options: StructureScriptsCommandOptions): Promise<void> => {
  if (!options.llmModel) {
    priceNotice('Comic - Price Estimate: draft-scenes --only structure: no --llm-model specified, so the structure stage makes no API calls.', {
      stage: 'draft-scenes:structure',
      llmCalls: 0,
      totalCost: 0
    })
    return
  }

  const model = options.llmModel
  const { scriptPath, sceneSlug } = options

  if (!existsSync(scriptPath)) {
    priceNotice(`Comic - Price Estimate: draft-scenes --only structure: script file not found: ${scriptPath}`, {
      stage: 'draft-scenes:structure',
      model,
      scriptPath
    })
    return
  }

  const content = await Bun.file(scriptPath).text()
  logLlmTokenEstimate(
    'Comic - Price Estimate: draft-scenes --only structure',
    model,
    'scriptFile',
    sceneSlug,
    estimateTokens(content)
  )
}

const logImagePriceRows = (
  title: string,
  rows: readonly ComicPriceModelRow[],
  totalOutputs: number,
  outputLabel: string,
  hasGeminiModel: boolean,
  extraMetadata: LogMetadata = {}
): void => {
  const knownTotal = rows.reduce((total, row) => total + (row.subtotal ?? 0), 0)
  const hasNullCost = rows.some((row) => row.subtotal === null)
  const outputsColumn = `x${totalOutputs} ${outputLabel}${totalOutputs !== 1 ? 's' : ''}`

  priceTable(
    title,
    rows.map((row) => ({
      model: row.modelLabel,
      perImage: row.pricePerImage === null ? 'n/a' : formatCost(row.pricePerImage),
      [outputsColumn]: totalOutputs,
      subtotal: row.subtotal === null ? 'n/a' : formatCost(row.subtotal)
    })),
    ['model', 'perImage', outputsColumn, 'subtotal'],
    {
      outputLabel,
      totalOutputs,
      knownTotal,
      hasUnknownPricing: hasNullCost,
      rows: rows.map((row) => ({
        model: row.modelLabel,
        pricePerImage: row.pricePerImage,
        subtotal: row.subtotal
      })),
      ...extraMetadata
    }
  )

  priceLine(
    hasNullCost
      ? `Total: ~${formatCost(knownTotal)} + n/a (some models have no per-image estimate)`
      : `Total: ~${formatCost(knownTotal)}`,
    { knownTotal, hasUnknownPricing: hasNullCost }
  )
  priceLine(IMAGE_ESTIMATE_BASIS_NOTE, { inputTokenCostsModeled: false })
  if (hasGeminiModel) {
    priceNotice(GEMINI_IMAGE_ESTIMATE_NOTE, { provider: 'gemini', estimatedCostPerImage: 0.067 })
  }
}

const printImageEstimateTable = (
  models: ImageGenerationModel[],
  quality: ImageGenerationQuality,
  size: ImageGenerationSize,
  totalOutputs: number,
  outputLabel: string
): void => {
  const rows: ComicPriceModelRow[] = models.map((model) => {
    const qualityLabel = isGeminiImageModel(model) ? 'ignored' : quality
    const pricePerImage = estimateImageOutputCost(model, quality, size)
    return {
      modelLabel: `${model} (${qualityLabel})`,
      pricePerImage,
      subtotal: pricePerImage !== null ? pricePerImage * totalOutputs : null
    }
  })

  logImagePriceRows(
    'Comic Image Price Estimate',
    rows,
    totalOutputs,
    outputLabel,
    models.some(isGeminiImageModel),
    { quality, size }
  )
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
  const judgeModel = options.qaModel ?? DEFAULT_QA_MODEL
  priceDetails(
    'Comic - Price Estimate: reference-sketch --location',
    [
      ['Location', options.location],
      ['View', view],
      ['Location-spec aggregation model', options.llmModel ?? DEFAULT_LLM_MODEL],
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
      aggregationModel: options.llmModel ?? DEFAULT_LLM_MODEL,
      aggregationCalls,
      initialImageCalls: 1,
      judgeModel,
      initialJudgeCalls: qaEnabled ? 1 : 0,
      maximumAdditionalImageRepairs: qaEnabled ? maxRepairs : 0,
      maximumAdditionalJudgeCalls: qaEnabled ? maxRepairs : 0
    }
  )
  printImageEstimateTable([model], quality, size, 1, 'initial location view')
  if (qaEnabled && maxRepairs > 0) printImageEstimateTable([DEFAULT_IMAGE_MODEL], quality, size, maxRepairs, 'maximum location retry')
  priceLine('Dry run: no provider calls and no files written.', { dryRun: true })
}

const printFinalImageHeader = (result: FinalImageEstimateResult): void => {
  const { request } = result
  const modeLabel = request.mode === 'grid' ? ' (grid mode)' : request.mode === 'page' ? ' (page mode)' : ''
  const variations = request.variationsSpecified
    ? request.variations.map(getImagePromptVariationLabel)
    : undefined
  priceDetails(
    `Comic - Price Estimate: generate-images${modeLabel}`,
    [
      ['Models', request.models.join(', ')],
      ...(variations ? [['Variations', variations.join(', ')] as const] : []),
      ['Size', request.size],
      ['Quality', request.quality],
      ...(request.mode === 'page' ? [['Panels per image', request.panelsPerImage] as const] : []),
      ...(request.mode === 'grid'
        ? [['Grid', `${request.grid.columns}x${request.grid.rows} local composites from individual panels`] as const]
        : [])
    ],
    {
      command: 'generate-images',
      mode: request.mode,
      models: [...request.models],
      ...(variations ? { variations } : {}),
      size: request.size,
      quality: request.quality,
      ...(request.mode === 'page' ? { panelsPerImage: request.panelsPerImage } : {}),
      ...(request.mode === 'grid' ? { gridColumns: request.grid.columns, gridRows: request.grid.rows } : {})
    }
  )
}

const printImagePricingEstimate = (pricing: ImagePricingEstimate, title = 'Comic Image Price Estimate'): void => {
  logImagePriceRows(
    title,
    pricing.rows,
    pricing.rows[0]?.outputs ?? 0,
    pricing.outputLabel,
    pricing.rows.some(row => isGeminiImageModel(row.model))
  )
}

const printPagePricingEstimate = (pricing: ImagePricingEstimate): void => {
  priceTable(
    'Comic Page Price Estimate',
    pricing.rows.map((row) => ({
      model: row.modelLabel,
      pages: row.outputs,
      perImage: row.pricePerImage === null ? 'n/a' : formatCost(row.pricePerImage),
      subtotal: row.subtotal === null ? 'n/a' : formatCost(row.subtotal)
    })),
    ['model', 'pages', 'perImage', 'subtotal'],
    {
      outputLabel: pricing.outputLabel,
      knownTotal: pricing.knownTotal,
      hasUnknownPricing: pricing.hasUnknown,
      rows: pricing.rows.map((row) => ({
        model: row.modelLabel,
        outputs: row.outputs,
        pricePerImage: row.pricePerImage,
        subtotal: row.subtotal
      }))
    }
  )
  priceLine(`Subtotal: ~${formatCost(pricing.knownTotal)}${pricing.hasUnknown ? ' + n/a' : ''}`, {
    knownTotal: pricing.knownTotal,
    hasUnknownPricing: pricing.hasUnknown
  })
}

const printPageQaEstimate = (
  result: Extract<FinalImageEstimateResult, { status: 'ready' }>,
): void => {
  const qa = result.qaWork
  if (qa?.mode !== 'page') return

  priceDetails(
    'Comic Page QA Price Estimate',
    [
      ['Judge model', qa.judgeModel],
      ['Initial judge calls', qa.initialJudgeCalls],
      ...(qa.reusedReports > 0 ? [['Reused reports', qa.reusedReports] as const] : []),
      ['Maximum additional image edits', qa.maximumAdditionalImageEdits],
      ['Maximum additional judge calls', qa.maximumAdditionalJudgeCalls],
      ['Heuristic judge tokens', `${qa.estimatedInputTokens.toLocaleString()} input + ${qa.estimatedOutputTokens.toLocaleString()} output`],
      ['Heuristic judge cost', `~${formatCost(result.pricing.judgeCost ?? 0)}`]
    ],
    {
      mode: 'page',
      judgeModel: qa.judgeModel,
      initialJudgeCalls: qa.initialJudgeCalls,
      reusedReports: qa.reusedReports,
      maximumAdditionalImageEdits: qa.maximumAdditionalImageEdits,
      maximumAdditionalJudgeCalls: qa.maximumAdditionalJudgeCalls,
      estimatedInputTokens: qa.estimatedInputTokens,
      estimatedOutputTokens: qa.estimatedOutputTokens,
      judgeCost: result.pricing.judgeCost ?? 0
    }
  )
  if (result.pricing.repair) printImagePricingEstimate(result.pricing.repair, 'Comic Page Repair Price Estimate')
  priceLine(JUDGE_COST_BASIS_NOTE, { visionTokenUsageModeled: false })
}

const printPanelQaEstimate = (
  result: Extract<FinalImageEstimateResult, { status: 'ready' }>,
): void => {
  const qa = result.qaWork
  if (qa?.mode !== 'panel') return

  priceDetails(
    'Comic Panel QA Price Estimate',
    [
      ['Judge model', qa.judgeModel],
      ['Initial judge calls', qa.initialJudgeCalls],
      ['Maximum additional image edits', qa.maximumAdditionalImageEdits],
      ['Maximum additional judge calls', qa.maximumAdditionalJudgeCalls],
      ['Maximum total judge calls', qa.maximumTotalJudgeCalls],
      ['Maximum heuristic judge tokens', `${qa.estimatedInputTokens.toLocaleString()} input + ${qa.estimatedOutputTokens.toLocaleString()} output`],
      ['Maximum heuristic judge cost', `~${formatCost(result.pricing.judgeCost ?? 0)}`],
      [
        'Maximum modeled cost',
        result.pricing.maximumModeledCost === null
          ? `n/a image output pricing + ~${formatCost(result.pricing.judgeCost ?? 0)} heuristic QA`
          : `~${formatCost(result.pricing.maximumModeledCost)} (image outputs + heuristic QA)`
      ]
    ],
    {
      mode: 'panel',
      judgeModel: qa.judgeModel,
      initialJudgeCalls: qa.initialJudgeCalls,
      maximumAdditionalImageEdits: qa.maximumAdditionalImageEdits,
      maximumAdditionalJudgeCalls: qa.maximumAdditionalJudgeCalls,
      maximumTotalJudgeCalls: qa.maximumTotalJudgeCalls,
      estimatedInputTokens: qa.estimatedInputTokens,
      estimatedOutputTokens: qa.estimatedOutputTokens,
      judgeCost: result.pricing.judgeCost ?? 0,
      maximumModeledCost: result.pricing.maximumModeledCost
    }
  )
  if (result.pricing.repair) printImagePricingEstimate(result.pricing.repair, 'Comic Panel Repair Price Estimate')
  priceLine(PANEL_QA_BASIS_NOTE, { imageInputTokensModeled: false, visionTokenUsageModeled: false })
}

const printGridEstimate = (
  result: Extract<FinalImageEstimateResult, { status: 'ready' }>,
): void => {
  const grid = result.modeEstimate.mode === 'grid' ? result.modeEstimate.grid : null
  if (!grid) return

  priceTable(
    'Comic Grid Pages',
    [{
      scene: result.request.sceneSlug,
      composites: grid.totalOutputs,
      grid: `${grid.columns}x${grid.rows}`,
      cells: grid.capacity,
      skipped: grid.skipped
    }],
    ['scene', 'composites', 'grid', 'cells', 'skipped'],
    {
      scene: result.request.sceneSlug,
      totalOutputs: grid.totalOutputs,
      columns: grid.columns,
      rows: grid.rows,
      capacity: grid.capacity,
      skipped: grid.skipped,
      totalCost: 0
    }
  )
  priceLine('Grid pages are local ImageMagick composites and add no API cost.', { totalCost: 0 })
}

const printReadyFinalImageEstimate = (
  result: Extract<FinalImageEstimateResult, { status: 'ready' }>,
): void => {
  if (
    result.request.mode === 'page'
    && result.inventory.mode === 'page'
    && result.modeEstimate.mode === 'page'
  ) {
    priceTable(
      'Comic Reference Preflight (pages)',
      result.inventory.pages.map((page) => ({ page: page.pageNumber, referencesRequired: page.referenceCount })),
      ['page', 'referencesRequired'],
      {
        order: 'canonical character references followed by distinct immutable location references in first-panel order',
        pages: result.inventory.pages.map((page) => ({ page: page.pageNumber, referenceCount: page.referenceCount }))
      }
    )
    priceTable(
      'Comic Pages',
      [{
        scene: result.request.sceneSlug,
        pages: result.modeEstimate.totalOutputs,
        skipped: result.modeEstimate.skipped
      }],
      ['scene', 'pages', 'skipped'],
      {
        scene: result.request.sceneSlug,
        totalOutputs: result.modeEstimate.totalOutputs,
        skipped: result.modeEstimate.skipped
      }
    )
    if (result.modeEstimate.totalOutputs === 0) {
      priceNotice('All page images already exist. Nothing to generate.', {
        scene: result.request.sceneSlug,
        totalOutputs: 0,
        skipped: result.modeEstimate.skipped,
        totalCost: 0
      })
      return
    }
    printPagePricingEstimate(result.pricing.primary)
    priceLine('Grouped pages use canonical character references followed by each distinct immutable location reference.')
    printPageQaEstimate(result)
    return
  }

  if (result.inventory.mode === 'page' || result.modeEstimate.mode === 'page') return
  priceTable(
    'Comic Reference Preflight (panels)',
    result.inventory.panels.map((panel) => ({ panel: panel.panelNumber, referencesRequired: panel.referenceCount })),
    ['panel', 'referencesRequired'],
    { panels: result.inventory.panels.map((panel) => ({ panel: panel.panelNumber, referenceCount: panel.referenceCount })) }
  )
  priceTable(
    'Comic Panels',
    [{
      scene: result.request.sceneSlug,
      panels: result.modeEstimate.totalOutputs,
      skipped: result.modeEstimate.skipped
    }],
    ['scene', 'panels', 'skipped'],
    {
      scene: result.request.sceneSlug,
      totalOutputs: result.modeEstimate.totalOutputs,
      skipped: result.modeEstimate.skipped
    }
  )
  if (result.modeEstimate.totalOutputs === 0) {
    priceNotice('All panels already exist. Nothing to generate.', {
      scene: result.request.sceneSlug,
      totalOutputs: 0,
      skipped: result.modeEstimate.skipped,
      totalCost: 0
    })
    printGridEstimate(result)
    return
  }
  printImagePricingEstimate(result.pricing.primary)
  priceLine(`Initial image calls: ${result.modeEstimate.totalOutputs}`, { initialImageCalls: result.modeEstimate.totalOutputs })
  printPanelQaEstimate(result)
  printGridEstimate(result)
}

const printFinalImageEstimate = (result: FinalImageEstimateResult): void => {
  printFinalImageHeader(result)
  if (result.status !== 'ready') {
    priceNotice(
      result.status === 'missing-prompts'
        ? 'No stable panel prompt bundles found. Run "bun autoshow comic draft-scenes <script-path> --only panel-prompts" first.'
        : 'No panel prompt bundles found.',
      { status: result.status, scene: result.request.sceneSlug }
    )
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

  priceDetails(
    'Comic - Price Estimate: generate-images --target sketches',
    [
      ['Models', models.join(', ')],
      ['Size', size],
      ['Quality', quality],
      ['Panels per sketch', panelsPerImage]
    ],
    {
      command: 'generate-images',
      target: 'sketches',
      models: [...models],
      size,
      quality,
      panelsPerImage
    }
  )

  const panelPromptsDir = getPanelPromptsDirectory(sceneSlug)

  if (!existsSync(panelPromptsDir)) {
    priceNotice('No stable panel prompt bundles found. Run "bun autoshow comic draft-scenes <script-path> --only panel-prompts" first.', {
      scene: sceneSlug,
      panelPromptsDir
    })
    return
  }

  const entries = await readdir(panelPromptsDir, { withFileTypes: true })
  const panelNumbers = entries
    .filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name))
    .map(entry => getPanelNumberFromName(entry.name))
    .filter((panelNumber): panelNumber is number => panelNumber !== null)
    .sort((left, right) => left - right)

  if (panelNumbers.length === 0) {
    priceNotice('No panel prompt bundles found.', { scene: sceneSlug, panelPromptsDir })
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
  const preflightRows: Array<{ panels: string, referencesRequired: number }> = []
  for (const chunk of selectedSketchChunks) {
    const chunkPanelNumbers: number[] = []
    for (let panelNumber = chunk.startPanelNumber; panelNumber <= chunk.endPanelNumber; panelNumber++) chunkPanelNumbers.push(panelNumber)
    const count = await validatePriceReferenceGroup(panelPromptsDir, chunkPanelNumbers, models)
    preflightRows.push({ panels: `${chunk.startPanelNumber}-${chunk.endPanelNumber}`, referencesRequired: count })
  }
  priceTable(
    'Comic Reference Preflight (sketch chunks)',
    preflightRows,
    ['panels', 'referencesRequired'],
    { chunks: preflightRows }
  )

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

  priceTable(
    'Comic Sketch Chunks',
    [{
      scene: sceneSketchCount.label,
      sketches: sceneSketchCount.sketches,
      skipped: sceneSketchCount.skipped
    }],
    ['scene', 'sketches', 'skipped'],
    { scene: sceneSketchCount.label, sketches: sceneSketchCount.sketches, skipped: sceneSketchCount.skipped }
  )

  if (totalSketches === 0) {
    priceNotice('All sketch chunks already exist. Nothing to generate.', {
      scene: sceneSketchCount.label,
      sketches: 0,
      skipped: sceneSketchCount.skipped,
      totalCost: 0
    })
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
    priceNotice('Comic - Price Estimate: generate-images: reviewed schemaVersion 4 scene and panel bundles are required. Run draft-scenes explicitly; generate-images price mode never drafts or upgrades artifacts.', {
      command: 'generate-images',
      scene: sceneSlug,
      sceneJsonPath: getSceneJsonPath(sceneSlug)
    })
    return
  }
  try {
    v.parse(ScenePromptDataSchema, JSON.parse(readFileSync(getSceneJsonPath(sceneSlug), 'utf8')))
  } catch {
    priceNotice('Comic - Price Estimate: generate-images: the scene is not reviewed schemaVersion 4. Run draft-scenes explicitly; older scene artifacts cannot enter controlled image generation.', {
      command: 'generate-images',
      scene: sceneSlug,
      sceneJsonPath: getSceneJsonPath(sceneSlug)
    })
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
