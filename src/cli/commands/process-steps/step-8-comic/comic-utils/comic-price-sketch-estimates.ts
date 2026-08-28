import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import type { GenerateSketchesCommandOptions, ImageGenerationQuality, ImageGenerationSize, SceneSketchCount } from '~/types'
import { DEFAULT_SKETCH_PANELS_PER_IMAGE } from '../comic-commands/generate-images/comic-page-utils'
import { resolveSketchChunks } from '../comic-commands/generate-sketches/generate-scene-sketches'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from './image-size'
import { PANEL_DIRECTORY_PATTERN, getPanelNumberFromName } from './panel-prompt-utils'
import { getPanelPromptsDirectory } from './project-paths'
import { getSketchComicImagePath } from './scene-utils'
import { validatePriceReferenceGroup } from './final-image-price-inventory'
import { priceDetails, priceNotice, priceTable } from './price-estimate-logging'
import { printImageEstimateTable } from './comic-price-output'

export const estimateGenerateSketchesPrice = async (
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
