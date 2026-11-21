import { readdir } from 'node:fs/promises'
import { basename, relative } from 'node:path'
import type {
  ComicBaseImageRequestInput,
  ComicImageGenerationDependencies,
  DirectoryEntry,
  GeneratePanelImagesOptions,
  ImageRunStats,
  PanelRenderContext,
  PanelRenderResult
} from '~/types'
import { CLI_INVOCATION } from '~/cli/cli-invocation'
import * as appLog from '~/utils/app-logger/app-logger'
import { ValidationError } from '~/utils/error-handler'
import { createImage } from '../../comic-image-services/comic-image-targets'
import { createImageRunStats } from '../../comic-image-services/image-costs'
import { writeGeneratedImage } from '../../comic-image-services/image-writer'
import { err } from '../../comic-utils/comic-logger'
import { findMissingReferenceImageFiles, getPanelNumberFromName, resolveScenePanelDirectories } from '../../comic-utils/panel-prompt-utils'
import { readRecordedComicImageEvidence } from '../../comic-utils/panel-selection'
import { getPanelPromptsDirectory, getSceneOutputDirectory, normalizeProjectPath } from '../../comic-utils/project-paths'
import { getPanelComicImagePath } from '../../comic-utils/scene-utils'
import { validateReferenceImageCount } from '../../comic-utils/reference-capabilities'
import { generateComicBaseImage, verifyReusableComicImage } from './comic-base-image-request'
import { runComicImageWorkItems } from './comic-image-work-items'
import { selectComicPanels } from './comic-page-utils'
import { preparePanelImageRequest, preparePanelPrompt } from './comic-panel-request-preparation'
import { presentPanelImageResult } from './comic-panel-result-presentation'
import { recordAndPublishPanelCandidate } from './comic-run-candidates'

const reuseSelectedPanel = async (
  request: ComicBaseImageRequestInput,
  recordedHashes: ReadonlyMap<string, string>,
  stats: ImageRunStats
): Promise<boolean> => {
  if (request.options.force) return false
  const selectedPath = getPanelComicImagePath(request.sceneSlug, request.itemNumber)
  if (!await Bun.file(selectedPath).exists()) return false
  const relativePath = normalizeProjectPath(relative(getSceneOutputDirectory(request.sceneSlug), selectedPath))
  const evidence = await verifyReusableComicImage(selectedPath, `selected panel ${request.itemNumber}`)
  const recordedHash = recordedHashes.get(relativePath)
  if (recordedHash !== undefined && recordedHash !== evidence.sha256) {
    // Same rule as review: a valid canonical whose bytes differ from the record is an existing selection of unrecorded
    // origin. Keep it, leave the record alone, and never block or buy the other panels because of it.
    appLog.write('warn', `Selected panel ${request.itemNumber} at ${relativePath} differs from its recorded selection; keeping it as an existing selection (origin not recorded). Use "${CLI_INVOCATION} comic review --use" to record a choice or --force to regenerate.`, {
      category: 'command',
      metadata: { panelNumber: request.itemNumber, path: relativePath, recordedSha256: recordedHash, sha256: evidence.sha256 },
    })
  }
  // A retained run candidate must still be verified and recorded by the publication step.
  if (await Bun.file(request.outputPath).exists()) return false
  presentPanelImageResult({ status: 'skipped', outputPath: selectedPath, durationMs: 0 }, { ...request, outputPath: selectedPath }, stats)
  return true
}

const renderSinglePanel = async (
  request: ComicBaseImageRequestInput,
  recordedHashes: ReadonlyMap<string, string>
): Promise<PanelRenderResult> => {
  const { sceneSlug, options, stats } = request
  try {
    // A different run may have filled this slot since preflight.
    if (!await Bun.file(request.outputPath).exists() && await reuseSelectedPanel(request, recordedHashes, stats)) return { stats }
    const result = await generateComicBaseImage(request)
    await recordAndPublishPanelCandidate({
      sceneSlug,
      runId: options.runId,
      model: options.model,
      panelNumber: request.itemNumber,
      outputPath: result.outputPath,
      generatedEvidence: result.generatedEvidence,
    })
    presentPanelImageResult(result, request, stats)
  } catch (error) {
    err(`Failed to generate ${sceneSlug}/${basename(request.outputPath, '.png')}:`, error instanceof Error ? error.message : String(error))
    return { stats, error }
  }

  return { stats }
}

const assertPanelDirectoryNames = (panelDirectories: DirectoryEntry[]): void => {
  for (const panelEntry of panelDirectories) {
    if (!getPanelNumberFromName(panelEntry.name)) {
      throw ValidationError(`Invalid panel directory name "${panelEntry.name}"`, { stage: 'comic:generate-images' })
    }
  }
}

const preparePendingPanelRequests = async (
  panelDirectories: DirectoryEntry[],
  ctx: PanelRenderContext,
  recordedHashes: ReadonlyMap<string, string>,
  stats: ImageRunStats
): Promise<ComicBaseImageRequestInput[]> => {
  const preflightFailures: string[] = []
  const pending: ComicBaseImageRequestInput[] = []
  for (const panelEntry of panelDirectories) {
    try {
      const prepared = await preparePanelPrompt(panelEntry, ctx.sceneDirectory)
      const request = preparePanelImageRequest(prepared, ctx)
      validateReferenceImageCount(ctx.options.model, request.referenceImages.length, `Image references for ${panelEntry.name}`)
      const missing = await findMissingReferenceImageFiles(request.referenceImages)
      if (missing.length > 0) {
        preflightFailures.push(...missing)
        continue
      }
      if (!await reuseSelectedPanel(request, recordedHashes, stats)) pending.push(request)
    } catch (error) {
      preflightFailures.push(`${panelEntry.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (preflightFailures.length > 0) {
    throw ValidationError(`Image preflight failed before any provider calls:\n- ${Array.from(new Set(preflightFailures)).join('\n- ')}`, { stage: 'comic:generate-images' })
  }
  return pending
}

export const generatePanelImages = async (
  sceneSlug: string,
  options: GeneratePanelImagesOptions,
  dependencies: ComicImageGenerationDependencies = {},
) => {
  const stats = createImageRunStats()
  const requestImage = dependencies.requestImage ?? (async input => await createImage(input.normalizedPrompt, input.referenceImages, input.model, input.size, input.quality))
  const writeImage = dependencies.writeImage ?? writeGeneratedImage
  let hostedRequestIndex = 0
  const nextHostedIndex = () => hostedRequestIndex++

  const sceneDirectory = getPanelPromptsDirectory(sceneSlug)
  const sceneEntries = await readdir(sceneDirectory, { withFileTypes: true })
  let panelDirectories = resolveScenePanelDirectories(sceneEntries, sceneDirectory, undefined)

  if (options.panels !== undefined) {
    const panelSources = panelDirectories.map(entry => ({
      panelNumber: getPanelNumberFromName(entry.name)!,
      entry,
    }))
    panelDirectories = selectComicPanels(panelSources, options.panels, undefined, sceneSlug).map(selected => selected.entry)
  }

  assertPanelDirectoryNames(panelDirectories)

  const renderContext: PanelRenderContext = {
    sceneSlug,
    sceneDirectory,
    options,
    requestImage,
    writeImage,
    nextHostedIndex,
  }
  const { panelHashes } = await readRecordedComicImageEvidence(getSceneOutputDirectory(sceneSlug))
  const pending = await preparePendingPanelRequests(panelDirectories, renderContext, panelHashes, stats)

  return await runComicImageWorkItems({
    concurrency: options.concurrency,
    items: pending,
    render: async request => await renderSinglePanel(request, panelHashes),
    stats,
    ...(options.stopOnProviderError === true ? { stopOnProviderError: true } : {}),
    describeItem: request => basename(request.outputPath, '.png'),
    itemFailure: { message: count => `${count} image generation task(s) failed`, stage: 'comic:generate-images' }
  })
}
