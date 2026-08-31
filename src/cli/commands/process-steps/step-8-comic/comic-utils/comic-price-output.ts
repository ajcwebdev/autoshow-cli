import type { ComicPriceModelRow, FinalImageEstimateResult, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, ImagePricingEstimate, LogMetadata } from '~/types'
import { estimateImageOutputCost, formatCost } from '../comic-image-services/image-costs'
import { getImagePromptVariationLabel } from '../comic-commands/generate-images/prompt-variations'
import { isGeminiImageModel } from './image-service'
import { priceDetails, priceLine, priceNotice, priceTable } from './price-estimate-logging'

export const IMAGE_ESTIMATE_BASIS_NOTE = 'Per-image output cost only. Token-based input costs are not estimated.'

export const GEMINI_IMAGE_ESTIMATE_NOTE = 'Gemini costs use estimated1KImage (~$0.067/image) -- actual token costs vary.'

export const JUDGE_COST_BASIS_NOTE = 'Judge cost is separate from image-generation cost; actual vision token usage may vary.'

export const PANEL_QA_BASIS_NOTE = 'Image input tokens and actual vision-token usage are not modeled, so provider charges may vary.'

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

export const printImagePricingEstimate = (pricing: ImagePricingEstimate, title = 'Comic Image Price Estimate'): void => {
  logImagePriceRows(
    title,
    pricing.rows,
    pricing.rows[0]?.outputs ?? 0,
    pricing.outputLabel,
    pricing.rows.some(row => isGeminiImageModel(row.model))
  )
}

export const printPagePricingEstimate = (pricing: ImagePricingEstimate): void => {
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

export const printPageQaEstimate = (
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

export const printPanelQaEstimate = (
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
      ['Maximum repair QA calls', qa.maximumRepairQaCalls],
      ['Maximum order-swapped comparison calls', qa.maximumComparisonJudgeCalls],
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
      maximumRepairQaCalls: qa.maximumRepairQaCalls,
      maximumComparisonJudgeCalls: qa.maximumComparisonJudgeCalls,
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

export const printGridEstimate = (
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

export const printReadyFinalImageEstimate = (
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

export const printFinalImageEstimate = (result: FinalImageEstimateResult): void => {
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
