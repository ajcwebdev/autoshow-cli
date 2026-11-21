import { CLI_INVOCATION } from '~/cli/cli-invocation'
import type { ComicPriceModelRow, FinalImageEstimateResult, FinalImageInputEstimate, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, ImagePricingEstimate, LogMetadata } from '~/types'
import { estimateImageOutputCost, formatCost } from '../comic-image-services/image-costs'
import { isGeminiImageModel } from './image-service'
import { priceDetails, priceLine, priceNotice, priceRows } from './price-estimate-logging'

export const IMAGE_ESTIMATE_BASIS_NOTE = 'Per-image output cost only. Image input units are reported on the separate "Image input (modeled)" line when the estimate models them; text input costs are not estimated.'

export const GEMINI_IMAGE_ESTIMATE_NOTE = 'Gemini costs use the registry 1K output-image estimate; input and text/thinking output tokens are excluded. Actual token costs vary.'

export const IMAGE_INPUT_BASIS_NOTE = 'Image input units are modeled at 1,000 per reference image and priced only when the registry exposes an image-input rate; text input and actual vision usage are not modeled, so provider charges may vary.'

export const printImageInputEstimate = (estimate: FinalImageInputEstimate | null): void => {
  if (!estimate) return
  const pricedLabel = estimate.costCents === null ? ' (unpriced)' : ` (~${formatCost(estimate.costCents / 100)})`
  priceLine(
    `Image input (modeled): ${estimate.totalUnits.toLocaleString('en-US')} units across ${estimate.referenceInputs.toLocaleString('en-US')} references${pricedLabel}`,
    {
      model: estimate.model,
      calls: estimate.calls,
      unitsPerReference: estimate.unitsPerReference,
      referenceInputs: estimate.referenceInputs,
      imageInputUnits: estimate.totalUnits,
      ratePer1MCents: estimate.ratePer1MCents,
      costCents: estimate.costCents,
      priced: estimate.priced
    }
  )
  priceLine(IMAGE_INPUT_BASIS_NOTE, { imageInputUnitsModeled: true, visionUsageModeled: false })
}

export const logImagePriceRows = (
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

  priceRows(
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
  priceLine(IMAGE_ESTIMATE_BASIS_NOTE, { imageInputUnitsReportedSeparately: true, textInputModeled: false })
  if (hasGeminiModel) {
    priceNotice(GEMINI_IMAGE_ESTIMATE_NOTE, { provider: 'gemini', estimatedCostPerImage: 0.067 })
  }
}

export const printImageEstimateTable = (
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

export const printFinalImageHeader = (result: FinalImageEstimateResult): void => {
  const { request } = result
  const modeLabel = request.mode === 'grid' ? ' (grid mode)' : request.mode === 'page' ? ' (page mode)' : ''
  priceDetails(
    `Comic - Price Estimate: generate-images${modeLabel}`,
    [
      ['Model', request.model],
      ...(request.runId ? [['Run', request.runId] as const] : []),
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
      model: request.model,
      ...(request.runId ? { runId: request.runId } : {}),
      size: request.size,
      quality: request.quality,
      ...(request.mode === 'page' ? { panelsPerImage: request.panelsPerImage } : {}),
      ...(request.mode === 'grid' ? { gridColumns: request.grid.columns, gridRows: request.grid.rows } : {})
    }
  )
}

const toModelRow = (pricing: ImagePricingEstimate): ComicPriceModelRow => ({
  modelLabel: pricing.modelLabel,
  pricePerImage: pricing.pricePerImage,
  subtotal: pricing.subtotal,
})

export const printImagePricingEstimate = (pricing: ImagePricingEstimate, title = 'Comic Image Price Estimate'): void => {
  logImagePriceRows(title, [toModelRow(pricing)], pricing.outputs, pricing.outputLabel, isGeminiImageModel(pricing.model))
}

export const printGridEstimate = (
  result: Extract<FinalImageEstimateResult, { status: 'ready' }>,
): void => {
  const grid = result.modeEstimate.mode === 'grid' ? result.modeEstimate.grid : null
  if (!grid) return

  priceRows(
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
      providerCalls: 0,
      totalCost: 0
    }
  )
  priceLine('Grid pages are local ImageMagick composites of individual panels and add no provider calls or API cost.', { providerCalls: 0, totalCost: 0 })
}

const printEstimatedTotal = (result: Extract<FinalImageEstimateResult, { status: 'ready' }>): void => {
  const { estimatedTotal } = result.pricing
  priceLine(
    estimatedTotal === null ? 'Estimated total: n/a (unpriced image output or input)' : `Estimated total: ~${formatCost(estimatedTotal)}`,
    { imageCalls: result.modeEstimate.totalOutputs, estimatedTotal }
  )
}

export const printReadyFinalImageEstimate = (
  result: Extract<FinalImageEstimateResult, { status: 'ready' }>,
): void => {
  if (result.inventory.mode === 'page' && result.modeEstimate.mode === 'page') {
    priceRows(
      'Comic Reference Preflight (pages)',
      result.inventory.pages.map((page) => ({ page: page.pageNumber, referencesRequired: page.referenceCount })),
      ['page', 'referencesRequired'],
      {
        order: 'canonical character references followed by distinct immutable location references in first-panel order',
        pages: result.inventory.pages.map((page) => ({ page: page.pageNumber, referenceCount: page.referenceCount }))
      }
    )
    priceRows(
      'Comic Pages',
      [{ scene: result.request.sceneSlug, pages: result.modeEstimate.totalOutputs, skipped: result.modeEstimate.skipped }],
      ['scene', 'pages', 'skipped'],
      { scene: result.request.sceneSlug, totalOutputs: result.modeEstimate.totalOutputs, skipped: result.modeEstimate.skipped }
    )
    if (result.modeEstimate.totalOutputs === 0) {
      priceNotice('All page images already exist for this run. Nothing to generate.', {
        scene: result.request.sceneSlug,
        totalOutputs: 0,
        skipped: result.modeEstimate.skipped,
        totalCost: 0
      })
      return
    }
    printImagePricingEstimate(result.pricing.primary, 'Comic Page Price Estimate')
    printImageInputEstimate(result.pricing.imageInput)
    priceLine('Grouped pages use current canonical character references followed by each distinct current location reference.')
    printEstimatedTotal(result)
    return
  }

  if (result.inventory.mode === 'page' || result.modeEstimate.mode === 'page') return
  priceRows(
    'Comic Reference Preflight (panels)',
    result.inventory.panels.map((panel) => ({ panel: panel.panelNumber, referencesRequired: panel.referenceCount })),
    ['panel', 'referencesRequired'],
    { panels: result.inventory.panels.map((panel) => ({ panel: panel.panelNumber, referenceCount: panel.referenceCount })) }
  )
  priceRows(
    'Comic Panels',
    [{ scene: result.request.sceneSlug, panels: result.modeEstimate.totalOutputs, skipped: result.modeEstimate.skipped }],
    ['scene', 'panels', 'skipped'],
    { scene: result.request.sceneSlug, totalOutputs: result.modeEstimate.totalOutputs, skipped: result.modeEstimate.skipped }
  )
  if (result.modeEstimate.totalOutputs === 0) {
    priceNotice('All selected panels already have an image. Nothing to generate.', {
      scene: result.request.sceneSlug,
      totalOutputs: 0,
      skipped: result.modeEstimate.skipped,
      totalCost: 0
    })
    printGridEstimate(result)
    return
  }
  printImagePricingEstimate(result.pricing.primary)
  priceLine(`Image calls: ${result.modeEstimate.totalOutputs}`, { imageCalls: result.modeEstimate.totalOutputs })
  printImageInputEstimate(result.pricing.imageInput)
  printEstimatedTotal(result)
  printGridEstimate(result)
}

export const printFinalImageEstimate = (result: FinalImageEstimateResult): void => {
  printFinalImageHeader(result)
  if (result.status !== 'ready') {
    priceNotice(
      result.status === 'missing-prompts'
        ? `No stable panel prompt bundles found. Run "${CLI_INVOCATION} comic draft-scenes <script-path> --only panel-prompts" first.`
        : 'No panel prompt bundles found.',
      { status: result.status, scene: result.request.sceneSlug }
    )
    return
  }
  printReadyFinalImageEstimate(result)
}
