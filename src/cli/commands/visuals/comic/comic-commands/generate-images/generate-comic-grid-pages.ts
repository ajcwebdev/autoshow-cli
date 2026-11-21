import { mkdir, readdir } from 'node:fs/promises'
import { InfraError } from '~/utils/error-handler'
import type { GenerateComicGridPagesDependencies, GenerateComicGridPagesOptions } from '~/types'
import { createImageRunStats } from '../../comic-image-services/image-costs'
import { comicLog } from '../../comic-utils/comic-logger'
import { getPanelNumberFromName, resolveScenePanelDirectories } from '../../comic-utils/panel-prompt-utils'
import { getPagesDirectory, getPanelPromptsDirectory } from '../../comic-utils/project-paths'
import { getPageComicImagePath, getPanelComicImagePath } from '../../comic-utils/scene-utils'
import { composeComicGridPage } from './comic-grid-composer'
import { chunkComicGridPanels, getComicGridCapacity, selectComicPanels } from './comic-page-utils'
import { recordRunPageCandidate } from './comic-run-candidates'
import { runWithConcurrency } from '~/utils/run-with-concurrency'

const formatGridSpec = (grid: GenerateComicGridPagesOptions['grid']): string => {
  return `${grid.columns}x${grid.rows}`
}

const assertPanelImagesExist = async (
  sceneSlug: string,
  pageNumber: number,
  sourcePaths: string[]
): Promise<void> => {
  const missingPaths: string[] = []
  for (const sourcePath of sourcePaths) {
    if (!await Bun.file(sourcePath).exists()) {
      missingPaths.push(sourcePath)
    }
  }

  if (missingPaths.length > 0) {
    throw InfraError(
      `Missing panel PNGs for ${sceneSlug}/page-${String(pageNumber).padStart(2, '0')}:\n` +
      missingPaths.map(path => `  ${path}`).join('\n'),
      { stage: 'comic:grid-pages' }
    )
  }
}

/** Compose local grid pages from this run's individual panel candidates. Local composition makes no provider calls. */
export const generateComicGridPages = async (
  sceneSlug: string,
  options: GenerateComicGridPagesOptions,
  dependencies: GenerateComicGridPagesDependencies = {}
) => {
  const composeGridPage = dependencies.composeGridPage ?? composeComicGridPage
  const stats = createImageRunStats()
  const capacity = getComicGridCapacity(options.grid)
  const gridLabel = formatGridSpec(options.grid)
  const sceneDirectory = getPanelPromptsDirectory(sceneSlug)
  const sceneEntries = await readdir(sceneDirectory, { withFileTypes: true })
  const panelDirectories = resolveScenePanelDirectories(sceneEntries, sceneDirectory, undefined)
  const panelSources = panelDirectories.map(entry => ({
    panelNumber: getPanelNumberFromName(entry.name)!,
  }))
  const selectedPanels = selectComicPanels(
    panelSources,
    options.panels,
    undefined,
    sceneSlug,
  )
  const gridChunks = chunkComicGridPanels(selectedPanels, options.grid)

  await mkdir(getPagesDirectory(sceneSlug), { recursive: true })
  comicLog.line('grid inputs', [
    `scene=${sceneSlug}`,
    `grid=${gridLabel}`,
    `panels=${selectedPanels.map(panel => panel.panelNumber).join(',')}`,
    `groups=${gridChunks.length}`,
  ])

  const gridTasks = gridChunks.map(gridChunk => async () => {
    const outputPath = getPageComicImagePath(sceneSlug, gridChunk.pageNumber, gridChunk.panelNumbers, { runId: options.runId })
    const details = [
      `id=page-${String(gridChunk.pageNumber).padStart(2, '0')}`,
      `panels=${gridChunk.panelNumbers.join('-')}`,
      `grid=${gridLabel}`,
      `model=${options.model}`,
    ]

    if (!options.force && await Bun.file(outputPath).exists()) {
      stats.imagesSkipped++
      comicLog.output('skipped', 'grid-page', [...details, 'refs=existing', `path=${outputPath}`])
    } else {
      const sourcePaths = await Promise.all(gridChunk.panelNumbers.map(async panelNumber => {
        // A panel skipped because its slot was already selected is composed from that selection.
        const runPath = getPanelComicImagePath(sceneSlug, panelNumber, { runId: options.runId })
        const selectedPath = getPanelComicImagePath(sceneSlug, panelNumber)
        return !await Bun.file(runPath).exists() && await Bun.file(selectedPath).exists() ? selectedPath : runPath
      }))

      await assertPanelImagesExist(sceneSlug, gridChunk.pageNumber, sourcePaths)
      await composeGridPage({
        sources: sourcePaths,
        outputPath,
        grid: options.grid,
      })

      stats.imagesGenerated++
      comicLog.output('combined', 'grid-page', [
        ...details,
        `cells=${sourcePaths.length}/${capacity}`,
        'cost=local/no-cost',
        `path=${outputPath}`,
      ])
    }

    await recordRunPageCandidate({
      sceneSlug,
      runId: options.runId,
      model: options.model,
      pageNumber: gridChunk.pageNumber,
      panelNumbers: gridChunk.panelNumbers,
      outputPath,
      kind: 'local-grid',
    })
  })

  await runWithConcurrency(options.concurrency, gridTasks)

  return stats
}
