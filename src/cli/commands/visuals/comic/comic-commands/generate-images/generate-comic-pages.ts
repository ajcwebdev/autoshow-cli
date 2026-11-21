import { CLI_INVOCATION } from '~/cli/cli-invocation'
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  ComicImageGenerationDependencies,
  ComicPageGroup,
  ComicPagePanelSource,
  DirectoryEntry,
  GenerateComicPagesOptions,
  ImageGenerationModel,
  PageRenderContext,
  PageRenderResult,
  ResolvedReferenceImages,
} from '~/types'
import { createImageRunStats } from '../../comic-image-services/image-costs'
import { createImage } from '../../comic-image-services/comic-image-targets'
import { writeGeneratedImage } from '../../comic-image-services/image-writer'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { comicLog, err, formatDuration } from '../../comic-utils/comic-logger'
import {
  extractPanelBundleData,
  findMissingReferenceImageFiles,
  getPanelNumberFromName,
  getPromptBundleFilename,
  normalizePromptBundle,
  resolveGroupedReferenceImages,
  resolveScenePanelDirectories,
} from '../../comic-utils/panel-prompt-utils'
import { getPagesDirectory, getPanelPromptsDirectory } from '../../comic-utils/project-paths'
import { getPageComicImagePath } from '../../comic-utils/scene-utils'
import { validateReferenceImageCount } from '../../comic-utils/reference-capabilities'
import {
  buildComicPagePrompt,
  buildComicPagePromptData,
  chunkComicPagePanels,
  selectComicPanels,
} from './comic-page-utils'
import { generateComicBaseImage } from './comic-base-image-request'
import { runComicImageWorkItems } from './comic-image-work-items'
import { recordRunPageCandidate } from './comic-run-candidates'

const readComicPagePanelSource = async (
  sceneDirectory: string,
  panelEntry: DirectoryEntry
): Promise<ComicPagePanelSource> => {
  const panelNumber = getPanelNumberFromName(panelEntry.name)
  if (!panelNumber) {
    throw ValidationError(`Invalid panel directory name "${panelEntry.name}"`, { stage: 'comic:pages' })
  }

  const panelDirectory = join(sceneDirectory, panelEntry.name)
  const panelEntries = await readdir(panelDirectory, { withFileTypes: true })
  const promptFilename = getPromptBundleFilename(panelDirectory, panelEntries)
  const promptContent = await Bun.file(join(panelDirectory, promptFilename)).text()

  if (!promptContent.trim()) {
    throw ValidationError(`Prompt bundle "${promptFilename}" is empty`, { stage: 'comic:pages' })
  }

  const normalizedPrompt = normalizePromptBundle(promptContent)
  if (!normalizedPrompt) {
    throw ValidationError(`Prompt bundle "${promptFilename}" became empty after normalization`, { stage: 'comic:pages' })
  }

  return {
    panelDirectory,
    panelEntries,
    panelNumber,
    normalizedPrompt,
    bundleData: extractPanelBundleData(promptContent),
  }
}

const resolvePageReferences = (
  panels: ComicPagePanelSource[],
  model: ImageGenerationModel,
): ResolvedReferenceImages => {
  const resolved = resolveGroupedReferenceImages(panels, model)
  if (resolved.missingPrimaryCharacterRefs.length > 0) {
    throw InfraError(
      `Missing character reference images: ` +
      `${resolved.missingPrimaryCharacterRefs.join(', ')}. ` +
      'Generate any missing character sketches, then rebuild stable panel prompt bundles.',
      { stage: 'comic:pages' }
    )
  }
  return resolved
}

const renderSinglePage = async (
  pageChunk: ComicPageGroup,
  ctx: PageRenderContext
): Promise<PageRenderResult> => {
  const resultStats = createImageRunStats()
  const { sceneSlug, options, requestImage, writeImage, nextHostedIndex } = ctx
  const { model } = options
  const outputPath = getPageComicImagePath(sceneSlug, pageChunk.pageNumber, pageChunk.panelNumbers, { runId: options.runId })
  const pageDetails = [
    `id=page-${String(pageChunk.pageNumber).padStart(2, '0')}`,
    `panels=${pageChunk.panelNumbers.join('-')}`,
    `model=${model}`,
  ]

  try {
    const resolvedReferences = resolvePageReferences(pageChunk.panels, model)
    const pagePromptData = buildComicPagePromptData(pageChunk.panels.map(panel => panel.bundleData))
    const prompt = buildComicPagePrompt(pagePromptData, resolvedReferences.characterReferences ?? [], resolvedReferences.locationReferences ?? [], resolvedReferences.designReferences ?? [])
    const referenceImages = resolvedReferences.all
    const missingReferences = await findMissingReferenceImageFiles(referenceImages)
    if (missingReferences.length > 0) {
      throw InfraError(
        `Reference image file(s) went missing after pre-flight: ${missingReferences.join(', ')}. ` +
        'The run directory was likely modified while the run was in progress.',
        { stage: 'comic:pages' }
      )
    }

    const result = await generateComicBaseImage({
      kind: 'page',
      itemNumber: pageChunk.pageNumber,
      outputPath,
      model,
      prompt,
      referenceImages,
      sceneSlug,
      options,
      requestImage,
      writeImage,
      nextHostedIndex,
      stats: resultStats,
    })

    if (result.status === 'skipped') {
      resultStats.imagesSkipped++
      comicLog.output('skipped', 'page', [...pageDetails, 'refs=existing', `path=${outputPath}`])
    } else {
      comicLog.output('generated', 'page', [
        ...pageDetails,
        result.mode ? `mode=${result.mode}` : undefined,
        `refs=${referenceImages.length}`,
        result.costLabel ? `cost=${result.costLabel}` : undefined,
        `duration=${formatDuration(result.durationMs)}`,
        result.preservedPriorPath ? `prior=${result.preservedPriorPath}` : undefined,
        `path=${outputPath}`,
      ])
    }

    await recordRunPageCandidate({
      sceneSlug,
      runId: options.runId,
      model,
      pageNumber: pageChunk.pageNumber,
      panelNumbers: pageChunk.panelNumbers,
      outputPath,
      kind: 'provider-page',
    })
  } catch (error) {
    err(
      `Failed to generate ${sceneSlug}/page-${String(pageChunk.pageNumber).padStart(2, '0')}:`,
      error instanceof Error ? error.message : String(error)
    )
    return { stats: resultStats, error }
  }

  return { stats: resultStats }
}

export const generateComicPages = async (
  sceneSlug: string,
  options: GenerateComicPagesOptions,
  dependencies: ComicImageGenerationDependencies = {}
) => {
  let hostedRequestIndex = 0
  const nextHostedIndex = () => hostedRequestIndex++
  const requestImage = dependencies.requestImage ?? (async input => await createImage(input.normalizedPrompt, input.referenceImages, input.model, input.size, input.quality))
  const writeImage = dependencies.writeImage ?? writeGeneratedImage
  const stats = createImageRunStats()

  const sceneDirectory = getPanelPromptsDirectory(sceneSlug)
  const sceneEntries = await readdir(sceneDirectory, { withFileTypes: true })
  const panelDirectories = resolveScenePanelDirectories(sceneEntries, sceneDirectory, undefined)
  const panelSources = await Promise.all(
    panelDirectories.map(panelEntry => readComicPagePanelSource(sceneDirectory, panelEntry))
  )
  const selectedPanels = selectComicPanels(
    panelSources,
    options.panels,
    undefined,
    sceneSlug,
  )
  const pageChunks = chunkComicPagePanels(selectedPanels, options.panelsPerImage)

  await mkdir(getPagesDirectory(sceneSlug), { recursive: true })
  comicLog.line('page inputs', [
    `scene=${sceneSlug}`,
    `panels=${selectedPanels.map(panel => panel.panelNumber).join(',')}`,
    `groups=${pageChunks.length}`,
  ])

  const pendingReferenceFailures = new Set<string>()
  for (const pageChunk of pageChunks) {
    if (!options.force && await Bun.file(getPageComicImagePath(sceneSlug, pageChunk.pageNumber, pageChunk.panelNumbers, { runId: options.runId })).exists()) {
      continue
    }

    const preflightReferences = resolvePageReferences(pageChunk.panels, options.model)
    validateReferenceImageCount(options.model, preflightReferences.all.length, `Image references for page ${pageChunk.pageNumber}`)
    const missingReferences = await findMissingReferenceImageFiles(preflightReferences.all)
    missingReferences.forEach(reference => pendingReferenceFailures.add(reference))
  }

  if (pendingReferenceFailures.size > 0) {
    throw InfraError(
      `Missing reference image file(s): ${Array.from(pendingReferenceFailures).sort().join(', ')}. ` +
      `Re-run "${CLI_INVOCATION} comic draft-scenes <script-path> --only panel-prompts" to restage panel prompt bundles.`,
      { stage: 'comic:pages' }
    )
  }

  const renderContext: PageRenderContext = {
    sceneSlug,
    options,
    requestImage,
    writeImage,
    nextHostedIndex,
  }

  return await runComicImageWorkItems({
    concurrency: options.concurrency,
    items: pageChunks,
    render: async pageChunk => await renderSinglePage(pageChunk, renderContext),
    stats,
    ...(options.stopOnProviderError === true ? { stopOnProviderError: true } : {}),
    describeItem: pageChunk => `page-${String(pageChunk.pageNumber).padStart(2, '0')}`,
    itemFailure: { message: count => `${count} comic page generation task(s) failed`, stage: 'comic:pages' }
  })
}
