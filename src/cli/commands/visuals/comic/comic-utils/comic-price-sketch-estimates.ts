import { CLI_INVOCATION } from '~/cli/cli-invocation'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import type { GenerateSketchesCommandOptions, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, SceneSketchCount } from '~/types'
import { DEFAULT_SKETCH_PANELS_PER_IMAGE } from '../comic-commands/generate-images/comic-page-utils'
import { resolveSketchChunks } from '../comic-commands/generate-sketches/generate-scene-sketches'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from './image-size'
import { PANEL_DIRECTORY_PATTERN, getPanelNumberFromName } from './panel-prompt-utils'
import { getPanelPromptsDirectory } from './project-paths'
import { getSketchComicImagePath } from './scene-utils'
import { inspectPriceReferenceGroup } from './final-image-price-inventory'
import { priceDetails, priceNotice, priceRows } from './price-estimate-logging'
import { printImageEstimateTable } from './comic-price-output'

export type SketchPriceEstimate = {
  model: ImageGenerationModel
  size: ImageGenerationSize
  quality: ImageGenerationQuality
  totalSketches: number
  referenceInputs: number
}

export const estimateGenerateSketchesPrice = async (
  options: GenerateSketchesCommandOptions,
  runId?: string,
): Promise<SketchPriceEstimate | undefined> => {
  const { sceneSlug } = options
  const model = options.imageModel ?? DEFAULT_IMAGE_MODEL
  const size: ImageGenerationSize = options.size ?? '1536x1024'
  const quality: ImageGenerationQuality = options.quality ?? 'high'
  const force = options.force ?? false
  const panelsPerImage = options.panelsPerImage ?? DEFAULT_SKETCH_PANELS_PER_IMAGE
  validateImageSizeForModels(size, [model])

  priceDetails(
    'Comic - Price Estimate: generate-images --target sketches',
    [
      ['Model', model],
      ...(runId ? [['Run', runId] as const] : []),
      ['Size', size],
      ['Quality', quality],
      ['Panels per sketch', panelsPerImage]
    ],
    {
      command: 'generate-images',
      target: 'sketches',
      model,
      ...(runId ? { runId } : {}),
      size,
      quality,
      panelsPerImage
    }
  )

  const panelPromptsDir = getPanelPromptsDirectory(sceneSlug)

  if (!existsSync(panelPromptsDir)) {
    priceNotice(`No stable panel prompt bundles found. Run "${CLI_INVOCATION} comic draft-scenes <script-path> --only panel-prompts" first.`, {
      scene: sceneSlug,
      panelPromptsDir
    })
    return undefined
  }

  const entries = await readdir(panelPromptsDir, { withFileTypes: true })
  const panelNumbers = entries
    .filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name))
    .map(entry => getPanelNumberFromName(entry.name))
    .filter((panelNumber): panelNumber is number => panelNumber !== null)
    .sort((left, right) => left - right)

  if (panelNumbers.length === 0) {
    priceNotice('No panel prompt bundles found.', { scene: sceneSlug, panelPromptsDir })
    return undefined
  }

  const { selectedChunks: selectedSketchChunks } = resolveSketchChunks(
    panelNumbers.map(panelNumber => ({ panelNumber })),
    {
      ...(options.sketchPanels !== undefined ? { sketchPanels: options.sketchPanels } : {}),
      panelsPerImage,
    },
    sceneSlug,
  )
  // Dispatch runs chunks in order and attaches earlier sketches from this run (the first sketch that established each
  // character in the chunk, then the previous chunk's sketch) as optional continuity references, so price them the same way.
  const preflightRows: Array<{ panels: string, referencesRequired: number }> = []
  const establishedCharacterSketches = new Map<string, string>()
  let previousSketch: string | undefined
  for (const [index, chunk] of selectedSketchChunks.entries()) {
    const chunkPanelNumbers: number[] = []
    for (let panelNumber = chunk.startPanelNumber; panelNumber <= chunk.endPanelNumber; panelNumber++) chunkPanelNumbers.push(panelNumber)
    const { characterKeys } = await inspectPriceReferenceGroup(panelPromptsDir, chunkPanelNumbers, model)
    const priorSketches = Array.from(new Set([
      ...characterKeys.map(key => establishedCharacterSketches.get(key)).filter((sketch): sketch is string => sketch !== undefined),
      ...(previousSketch ? [previousSketch] : []),
    ]))
    const { referenceCount } = await inspectPriceReferenceGroup(panelPromptsDir, chunkPanelNumbers, model, priorSketches)
    preflightRows.push({ panels: `${chunk.startPanelNumber}-${chunk.endPanelNumber}`, referencesRequired: referenceCount })
    const sketch = `__sketch-${index + 1}__`
    for (const key of characterKeys) if (!establishedCharacterSketches.has(key)) establishedCharacterSketches.set(key, sketch)
    previousSketch = sketch
  }
  priceRows(
    'Comic Reference Preflight (sketch chunks)',
    preflightRows,
    ['panels', 'referencesRequired'],
    { chunks: preflightRows }
  )

  // A fresh run receives a new run ID, so only a recovered run can reuse sketches at its run-scoped destination.
  const pending = selectedSketchChunks
    .map((chunk, index) => ({ chunk, index }))
    .filter(({ chunk }) => force || !runId || !existsSync(getSketchComicImagePath(sceneSlug, chunk.startPanelNumber, chunk.endPanelNumber, undefined, runId)))
  const totalSketches = pending.length
  const skipped = selectedSketchChunks.length - totalSketches
  const referenceInputs = pending.reduce((sum, { index }) => sum + preflightRows[index]!.referencesRequired, 0)
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

  priceRows(
    'Comic Sketch Chunks',
    [{
      scene: sceneSketchCount.label,
      sketches: sceneSketchCount.sketches,
      skipped: sceneSketchCount.skipped
    }],
    ['scene', 'sketches', 'skipped'],
    { scene: sceneSketchCount.label, sketches: sceneSketchCount.sketches, skipped: sceneSketchCount.skipped }
  )

  const estimate: SketchPriceEstimate = { model, size, quality, totalSketches, referenceInputs }
  if (totalSketches === 0) {
    priceNotice('All sketch chunks already exist. Nothing to generate.', {
      scene: sceneSketchCount.label,
      sketches: 0,
      skipped: sceneSketchCount.skipped,
      totalCost: 0
    })
    return estimate
  }

  printImageEstimateTable([model], quality, size, totalSketches, 'sketch')
  return estimate
}
