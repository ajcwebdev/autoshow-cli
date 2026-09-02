import type { DirectoryEntry } from '~/types'
import { mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  ComicImageGenerationDependencies,
  ComicPageGroup,
  ComicPagePanelSource,
  GenerateComicPagesOptions,
  GenerateWithQaRepairResult,
  ImageGenerationModel,
  ImagePromptVariation,
  PageQaEntry,
  PageRenderContext,
  PageRenderResult,
  PageWorkItem,
  ResolvedReferenceImages,
} from '~/types'
import {
  createImageRunStats,
  updateImageRunStatsWithCostFallback,
} from '../../comic-image-services/image-costs'
import { createImage } from '../../comic-image-services/comic-image-targets'
import { writeGeneratedImage } from '../../comic-image-services/image-writer'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { comicLog, err } from '../../comic-utils/comic-logger'
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
import { getPageComicImagePath, loadPromptsConfig } from '../../comic-utils/scene-utils'
import {
  buildComicPagePrompt,
  buildComicPagePromptData,
  chunkComicPagePanels,
  selectComicPanels,
} from './comic-page-utils'
import {
  applyImagePromptVariation,
  getImagePromptVariationLabel,
} from './prompt-variations'
import { judgeComicPage } from './comic-page-qa'
import { DEFAULT_QA_MODEL } from '../../comic-utils/cli-args'
import { validateReferenceImageCount } from '../../comic-utils/reference-capabilities'
import { failedQaRepairEvidenceFromError, generateWithQaRepair } from './panel-qa-pipeline'
import { runComicImageWorkItems } from './comic-image-work-items'

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

const resolvePageReferences = async (
  panels: ComicPagePanelSource[],
  model: ImageGenerationModel,
): Promise<ResolvedReferenceImages> => {
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
  item: PageWorkItem,
  ctx: PageRenderContext
): Promise<PageRenderResult> => {
  const resultStats = createImageRunStats()
  const qaEntries: Array<{ directory: string; entry: PageQaEntry }> = []
  const { variation, model, pageChunk } = item
  const { sceneSlug, options, useVariationOutputPaths, useModelSpecificFilenames, prompts, requestImage, writeImage, judgePage, qaEnabled, judgeModel, maxRepairs, nextHostedIndex } = ctx
  const recordRepairResult = (repairResult: GenerateWithQaRepairResult, outputDirectory: string): void => {
    resultStats.imagesGenerated += repairResult.imagesGenerated
    resultStats.totalDurationMs += repairResult.totalDurationMs
    resultStats.totalInputTokens += repairResult.totalInputTokens
    resultStats.totalOutputTokens += repairResult.totalOutputTokens
    resultStats.totalInputImageTokens += repairResult.imageInputUnits
    resultStats.totalInputTextTokens += repairResult.textInputUnits
    resultStats.totalOutputImageTokens += repairResult.imageOutputUnits
    resultStats.totalCost += repairResult.totalCostUsd
    for (const costEntry of repairResult.costEntries) updateImageRunStatsWithCostFallback(costEntry.model, resultStats, options.quality, options.size)
    if (repairResult.qaEntry) qaEntries.push({ directory: outputDirectory, entry: repairResult.qaEntry })
  }

  const outputPath = getPageComicImagePath(
    sceneSlug,
    pageChunk.pageNumber,
    pageChunk.panelNumbers,
    useVariationOutputPaths ? model : useModelSpecificFilenames ? model : undefined,
    useVariationOutputPaths ? variation : undefined,
    options.runId
  )
  const canonicalExists = await Bun.file(outputPath).exists()
  const outputExists = !options.force && canonicalExists

  if (outputExists) {
    comicLog.output('skipped', 'page', [
      `id=page-${String(pageChunk.pageNumber).padStart(2, '0')}`,
      `panels=${pageChunk.panelNumbers.join('-')}`,
      `model=${model}`,
      useVariationOutputPaths ? `variation=${getImagePromptVariationLabel(variation)}` : undefined,
      'refs=existing',
      `path=${outputPath}`,
    ])
  }

  try {
    const resolvedReferences = await resolvePageReferences(pageChunk.panels, model)
    const pagePromptData = buildComicPagePromptData(pageChunk.panels.map(panel => panel.bundleData))
    const normalizedPrompt = buildComicPagePrompt(pagePromptData, resolvedReferences.characterReferences ?? [], resolvedReferences.locationReferences ?? [], resolvedReferences.designReferences ?? [])
    const promptForVariation = prompts
      ? applyImagePromptVariation(normalizedPrompt, variation, prompts)
      : normalizedPrompt
    const referenceImages = resolvedReferences.all
    const missingReferences = await findMissingReferenceImageFiles(referenceImages)
    if (missingReferences.length > 0) {
      throw InfraError(
        `Reference image file(s) went missing after pre-flight: ${missingReferences.join(', ')}. ` +
        'The run directory was likely modified while the run was in progress.',
        { stage: 'comic:pages' }
      )
    }

    const repairResult = await generateWithQaRepair({
      kind: 'page',
      itemNumber: pageChunk.pageNumber,
      outputPath,
      canonicalExists,
      outputExists,
      force: Boolean(options.force),
      model,
      promptForVariation,
      referenceImages,
      bundleData: pagePromptData,
      resolvedReferences,
      sceneSlug,
      options,
      requestImage,
      writeImage,
      judge: judgePage,
      qaEnabled,
      judgeModel,
      maxRepairs,
      nextHostedIndex,
    })

    recordRepairResult(repairResult, dirname(outputPath))

    if (repairResult.status === 'skipped') {
      resultStats.imagesSkipped++
    } else {
      comicLog.output('generated', 'page', [
        `id=page-${String(pageChunk.pageNumber).padStart(2, '0')}`,
        `panels=${pageChunk.panelNumbers.join('-')}`,
        `model=${model}`,
        `refs=${referenceImages.length}`,
        `path=${outputPath}`,
      ])
    }

    if (qaEnabled && repairResult.qaEntry) {
      comicLog.line(outputExists ? 'page QA reused' : 'page QA judged', [
        `page=${pageChunk.pageNumber}`,
        `model=${judgeModel}`,
        `hardFailure=${repairResult.qaEntry.hardFailure}`,
        `path=${outputPath}`,
      ])
    }
  } catch (error) {
    const failure = failedQaRepairEvidenceFromError(error)
    if (failure) recordRepairResult(failure, failure.outputDirectory)
    err(
      `Failed to generate ${sceneSlug}/page-${String(pageChunk.pageNumber).padStart(2, '0')}:`,
      error instanceof Error ? error.message : String(error)
    )
    return { stats: resultStats, qaEntries, error }
  }

  return { stats: resultStats, qaEntries }
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
  const judgePage = dependencies.judgePage ?? judgeComicPage
  const stats = createImageRunStats()
  const useModelSpecificFilenames = options.models.length > 1
  const variations: ImagePromptVariation[] = options.variations ?? ['canonical']
  const useVariationOutputPaths = options.variations !== undefined
  const qaEnabled = options.qa ?? true
  const judgeModel = options.qaModel ?? DEFAULT_QA_MODEL
  const maxRepairs = options.maxRepairs ?? 2

  const prompts = useVariationOutputPaths ? await loadPromptsConfig() : undefined
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
  const pagesDirectory = getPagesDirectory(sceneSlug)

  await mkdir(pagesDirectory, { recursive: true })
  comicLog.line('page inputs', [
    `scene=${sceneSlug}`,
    `panels=${selectedPanels.map(panel => panel.panelNumber).join(',')}`,
    `groups=${pageChunks.length}`,
  ])

  const pageStreams = variations.flatMap(variation =>
    options.models.map(model => ({ variation, model }))
  )

  const resolvePageOutputPath = (
    variation: ImagePromptVariation,
    model: ImageGenerationModel,
    pageChunk: ComicPageGroup
  ) => getPageComicImagePath(
    sceneSlug,
    pageChunk.pageNumber,
    pageChunk.panelNumbers,
    useVariationOutputPaths ? model : useModelSpecificFilenames ? model : undefined,
    useVariationOutputPaths ? variation : undefined,
    options.runId
  )

  const pendingReferenceFailures = new Set<string>()
  for (const { variation, model } of pageStreams) {
    for (const pageChunk of pageChunks) {
      if (!options.force && await Bun.file(resolvePageOutputPath(variation, model, pageChunk)).exists()) {
        continue
      }

      const preflightReferences = await resolvePageReferences(pageChunk.panels, model)
      if (qaEnabled && maxRepairs > 0) validateReferenceImageCount(model, preflightReferences.all.length + 1, `QA edits for page ${pageChunk.pageNumber}`)
      const missingReferences = await findMissingReferenceImageFiles(preflightReferences.all)
      missingReferences.forEach(reference => pendingReferenceFailures.add(reference))
    }
  }

  if (pendingReferenceFailures.size > 0) {
    throw InfraError(
      `Missing reference image file(s): ${Array.from(pendingReferenceFailures).sort().join(', ')}. ` +
      'Re-run "bun autoshow comic draft-scenes <script-path> --only panel-prompts" to restage panel prompt bundles.',
      { stage: 'comic:pages' }
    )
  }

  const renderContext: PageRenderContext = {
    sceneSlug,
    options,
    useVariationOutputPaths,
    useModelSpecificFilenames,
    prompts,
    requestImage,
    writeImage,
    judgePage,
    qaEnabled,
    judgeModel,
    maxRepairs,
    nextHostedIndex,
  }

  const workList: PageWorkItem[] = pageStreams.flatMap(({ variation, model }) =>
    pageChunks.map(pageChunk => ({ variation, model, pageChunk }))
  )

  return await runComicImageWorkItems({
    concurrency: options.concurrency,
    items: workList,
    render: async item => await renderSinglePage(item, renderContext),
    stats,
    qaEnabled,
    qaHardFailure: {
      message: count => `${count} comic page QA hard failure(s); generated artifacts and QA reports were preserved.`,
      stage: 'comic:page-qa'
    },
    itemFailure: { message: count => `${count} comic page generation task(s) failed`, stage: 'comic:pages' }
  })
}
