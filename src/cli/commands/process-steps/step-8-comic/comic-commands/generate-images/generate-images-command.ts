import { existsSync } from 'node:fs'
import * as v from 'valibot'
import { mkdir, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import type { ComicSourceIdentity, FinalPanelImageStageOptions, GenerateComicPagesOptions, GenerateImagesCommandOptions, GenerateImagesTarget, GenerateImagesWorkflowDependencies, GeneratePanelImagesOptions, ImageGenerationQuality, ImageGenerationSize, ImageRunStats, PipelineProviderState } from '~/types'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from '../../comic-utils/image-size'
import { InfraError } from '~/utils/error-handler'
import { ScenePromptDataSchema } from '../../schemas/schemas'
import { comicLog, err, formatCompactCost, formatDuration, suppressSharedPipelineLogs } from '../../comic-utils/comic-logger'
import { getPanelPromptsDirectory, getSceneJsonPath, getSceneMetadataDirectoryForWorkspace, getSceneOutputDirectory } from '../../comic-utils/project-paths'
import { beginSceneRun, findLatestSceneRunDirectory } from '../../comic-utils/scene-run-context'
import { createComicRunId } from '../../comic-utils/comic-run-id'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { assertPanelPromptSourceCoverage } from '../../comic-utils/source-coverage-utils'
import { generateSketchesCommand } from '../generate-sketches/generate-sketches-command'
import { COMIC_GRID_PANEL_SIZE, DEFAULT_FINAL_PANELS_PER_IMAGE, DEFAULT_SKETCH_PANELS_PER_IMAGE, panelSelectionToSketchRange, validateComicGridOptions } from './comic-page-utils'
import { generateComicGridPages } from './generate-comic-grid-pages'
import { generateComicPages } from './generate-comic-pages'
import { generatePanelImages } from './generate-panel-images'
import { getImagePromptVariationLabel } from './prompt-variations'
import { readManifest } from '../../../pipeline-manifest'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { canonicalTargetKey, sha256Bytes } from '../../../step-4-tts/script-to-audio/contract-identity'
import { updateComicImageManifest } from '../../comic-utils/comic-manifest'
import { resolveCompatibleComicSceneRun } from '../../comic-utils/compatible-scene-run'

const DEFAULT_IMAGE_SIZE: ImageGenerationSize = COMIC_GRID_PANEL_SIZE
const DEFAULT_IMAGE_QUALITY: ImageGenerationQuality = 'high'

const getGenerateImagesTarget = (target: GenerateImagesCommandOptions['target']): GenerateImagesTarget => {
  return target ?? 'images'
}

const panelPromptsExist = async (sceneSlug: string): Promise<boolean> => {
  const dir = getPanelPromptsDirectory(sceneSlug)
  if (!existsSync(dir)) return false
  const entries = await readdir(dir, { withFileTypes: true })
  return entries.some(entry => entry.isDirectory() && !entry.name.startsWith('.'))
}

const createEmptyImageStats = (): ImageRunStats => ({
  imagesGenerated: 0,
  imagesSkipped: 0,
  totalInputTokens: 0,
  totalInputTextTokens: 0,
  totalInputImageTokens: 0,
  totalInputUnattributedTokens: 0,
  totalOutputTokens: 0,
  totalOutputTextTokens: 0,
  totalOutputImageTokens: 0,
  totalOutputUnattributedTokens: 0,
  totalCost: 0,
  totalDurationMs: 0,
})

const mergeImageStats = (target: ImageRunStats, source: ImageRunStats | void): void => {
  if (!source) return

  target.imagesGenerated += source.imagesGenerated
  target.imagesSkipped += source.imagesSkipped
  target.totalInputTokens += source.totalInputTokens
  target.totalInputTextTokens += source.totalInputTextTokens
  target.totalInputImageTokens += source.totalInputImageTokens
  target.totalInputUnattributedTokens += source.totalInputUnattributedTokens
  target.totalOutputTokens += source.totalOutputTokens
  target.totalOutputTextTokens += source.totalOutputTextTokens
  target.totalOutputImageTokens += source.totalOutputImageTokens
  target.totalOutputUnattributedTokens += source.totalOutputUnattributedTokens
  target.totalCost += source.totalCost
  target.totalDurationMs += source.totalDurationMs
}

const collectImageArtifactRefs = async (sceneRunDir: string): Promise<Array<{ path: string, sha256: string }>> => {
  const paths: string[] = []
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && ['.png', '.webp', '.jpg', '.jpeg'].includes(extname(entry.name).toLowerCase())) paths.push(path)
    }
  }
  await Promise.all(['panels', 'pages', 'sketches'].map(async directory => await visit(join(sceneRunDir, directory))))
  paths.sort()
  return await Promise.all(paths.map(async path => ({ path: relative(sceneRunDir, path).split('\\').join('/'), sha256: sha256Bytes(new Uint8Array(await Bun.file(path).arrayBuffer())) })))
}

const formatPanelSelection = (panels: GenerateImagesCommandOptions['panels']): string => {
  if (!panels || panels === 'all') return 'all'
  return panels.join(',')
}

const runFinalPanelImageStage = async (options: FinalPanelImageStageOptions): Promise<ImageRunStats> => {
  const { sceneSlug, runId, concurrency } = options
  const panelsPerImage = options.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE
  const usePageMode = !options.grid && panelsPerImage > 1
  const stageLabel = options.grid ? 'Grid' : usePageMode ? 'Page' : 'Image'

  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  const size: ImageGenerationSize = options.size ?? DEFAULT_IMAGE_SIZE
  const quality: ImageGenerationQuality = options.quality ?? DEFAULT_IMAGE_QUALITY
  const force = options.force ?? false
  validateImageSizeForModels(size, models)
  validateComicGridOptions(options.grid, {
    target: 'images',
    size,
    panelsPerImage,
  })

  try {
    await mkdir(getSceneOutputDirectory(sceneSlug), { recursive: true })
    await assertPanelPromptSourceCoverage(sceneSlug)
  } catch (error) {
    err('Image initialization failed:', error instanceof Error ? error.message : String(error))
    throw InfraError('Failed at initialization step', { stage: 'comic:generate-images' })
  }

  try {
    if (options.grid) {
      const panelStats = await generatePanelImages(sceneSlug, {
        models,
        size,
        quality,
        force,
        runId,
        concurrency,
        ...(options.panels !== undefined ? { panels: options.panels } : {}),
        ...(options.variations !== undefined ? { variations: options.variations } : {}),
      })
      const gridStats = await generateComicGridPages(sceneSlug, {
        models,
        force,
        runId,
        concurrency,
        panels: options.panels ?? 'all',
        grid: options.grid,
        ...(options.variations !== undefined ? { variations: options.variations } : {}),
      })
      mergeImageStats(panelStats, gridStats)
      return panelStats
    }

    if (usePageMode) {
      const pageOptions: GenerateComicPagesOptions = {
        models,
        size,
        quality,
        force,
        runId,
        concurrency,
        panels: options.panels ?? 'all',
        panelsPerImage,
        ...(options.variations !== undefined ? { variations: options.variations } : {}),
        qa: options.qa ?? true,
        ...(options.qaModel ? { qaModel: options.qaModel } : {}),
        maxRepairs: options.maxRepairs ?? 2,
      }
      return await generateComicPages(sceneSlug, pageOptions)
    } else {
      const generationOptions: GeneratePanelImagesOptions = {
        models,
        size,
        quality,
        force,
        runId,
        concurrency,
        ...(options.panels !== undefined ? { panels: options.panels } : {}),
        ...(options.variations !== undefined ? { variations: options.variations } : {}),
        qa: options.qa ?? true,
        ...(options.qaModel ? { qaModel: options.qaModel } : {}),
        maxRepairs: options.maxRepairs ?? 2,
      }
      return await generatePanelImages(sceneSlug, generationOptions)
    }
  } catch (error) {
    err(`${stageLabel} generation failed:`, error instanceof Error ? error.message : String(error))
    throw InfraError(`Failed at ${options.grid ? 'grid' : usePageMode ? 'page' : 'image'} generation step`, { stage: 'comic:generate-images' })
  }
}

export const generateImagesCommand = async (
  options: GenerateImagesCommandOptions,
  dependencies: GenerateImagesWorkflowDependencies = {}
): Promise<void> => {
  const { sceneSlug } = options

  // Comic prints its own per-image output line with the real path; drop the shared
  // image services' interim pipeline logs (which show the throwaway scratch path).
  suppressSharedPipelineLogs()

  // Image generation is a controlled consumer: it only resumes a reviewed run and
  // never drafts, upgrades, or rewrites scene/panel artifacts. --force is image-only.
  const latestRunDir = findLatestSceneRunDirectory(sceneSlug)
  const resumeLatest = latestRunDir !== undefined
    && existsSync(join(getSceneMetadataDirectoryForWorkspace(latestRunDir), 'scene.json'))
  beginSceneRun(sceneSlug, resumeLatest && latestRunDir
    ? { outputDir: latestRunDir }
    : {})
  const sceneRunDir = getSceneOutputDirectory(sceneSlug)
  let canonicalManifest = await readManifest(sceneRunDir)
  if (!canonicalManifest && Object.keys(dependencies).length === 0) throw InfraError('Comic image generation requires a canonical comic manifest from structured-script v4. Re-run comic draft-scenes for a clean scene run.', { stage: 'comic:generate-images' })
  if (Object.keys(dependencies).length === 0) canonicalManifest = (await resolveCompatibleComicSceneRun({ scriptPath: options.scriptPath, outputDir: sceneRunDir })).manifest

  const target = getGenerateImagesTarget(options.target)
  const runSketches = dependencies.runSketches ?? generateSketchesCommand
  const runImages = dependencies.runImages ?? runFinalPanelImageStage
  const checkPanelPromptSourceCoverage = dependencies.checkPanelPromptSourceCoverage ?? assertPanelPromptSourceCoverage
  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  const size: ImageGenerationSize = options.size ?? DEFAULT_IMAGE_SIZE
  const quality: ImageGenerationQuality = options.quality ?? DEFAULT_IMAGE_QUALITY
  const finalPanelsPerImage = options.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE
  const sketchPanelsPerImage = options.panelsPerImage ?? DEFAULT_SKETCH_PANELS_PER_IMAGE
  const concurrency = options.concurrency ?? DEFAULT_CLI_CONCURRENCY
  const runId = createComicRunId()
  const startedAt = Date.now()
  const totals = createEmptyImageStats()

  validateImageSizeForModels(size, models)
  validateComicGridOptions(options.grid, {
    target,
    size,
    panelsPerImage: finalPanelsPerImage,
  })
  comicLog.header('comic generate-images', [
    `scene=${sceneSlug}`,
    `target=${target}`,
  ])

  const checkScenesExist = dependencies.checkScenesExist ?? (async (slug: string) => {
    return existsSync(getSceneJsonPath(slug))
  })
  const checkPromptsExist = dependencies.checkPromptsExist ?? panelPromptsExist

  if (!(await checkScenesExist(sceneSlug)) || !(await checkPromptsExist(sceneSlug))) {
    throw InfraError(
      `Reviewed schemaVersion 4 scene and panel bundles are required. Run "bun autoshow comic draft-scenes ${options.scriptPath}" explicitly; generate-images never drafts or upgrades artifacts.`,
      { stage: 'comic:generate-images' },
    )
  }
  if (!dependencies.checkScenesExist) {
    try {
      v.parse(ScenePromptDataSchema, JSON.parse(await Bun.file(getSceneJsonPath(sceneSlug)).text()))
    } catch (error) {
      throw InfraError(
        `Reviewed schemaVersion 4 scene JSON is required. Run "bun autoshow comic draft-scenes ${options.scriptPath}" explicitly; older scenes cannot enter controlled image generation.`,
        { stage: 'comic:generate-images', cause: error instanceof Error ? error : undefined },
      )
    }
  }

  const coverageReport = await checkPanelPromptSourceCoverage(sceneSlug)
  comicLog.line('inputs ready', [
    'draft=reviewed-v4',
    'prompts=reviewed-v4',
    `coverage=${coverageReport.coveredSegments}/${coverageReport.totalSegments}`,
  ])
  comicLog.line('config', [
    `target=${target}`,
    `models=${models.join(',')}`,
    `size=${size}`,
    `quality=${quality}`,
    `concurrency=${concurrency}`,
    `run=${runId}`,
    `panels=${formatPanelSelection(options.panels)}`,
    `finalPanelsPerImage=${finalPanelsPerImage}`,
    `sketchPanelsPerImage=${sketchPanelsPerImage}`,
    options.grid ? `grid=${options.grid.columns}x${options.grid.rows}` : undefined,
    options.variations !== undefined
      ? `variations=${options.variations.map(getImagePromptVariationLabel).join(',')}`
      : undefined,
    options.force ? 'force=true' : undefined,
  ])

  if (canonicalManifest && (canonicalManifest.command !== 'comic' || !canonicalManifest.source)) throw InfraError('Comic image generation found a canonical manifest for another workflow.', { stage: 'comic:generate-images' })
  const imageProviderState = (status: PipelineProviderState['status'], error?: unknown): PipelineProviderState[] => models.map((model) => {
    const service = findRegistryServiceForModel('image', model)
    if (!service) throw InfraError(`Comic image model ${model} is missing its central provider identity.`, { stage: 'comic:generate-images' })
    const transport = 'hosted-api'
    return {
      service,
      model,
      local: false,
      operation: 'comic-image',
      targetKey: canonicalTargetKey('comic-image', service, model, transport),
      transport,
      artifactDir: '.',
      status,
      attempts: status === 'running' || status === 'succeeded' || status === 'failed' ? 1 : 0,
      options: { target, size, quality, panelsPerImage: finalPanelsPerImage },
      metadata: { imagesGenerated: totals.imagesGenerated, imagesSkipped: totals.imagesSkipped, runId },
      ...(status === 'succeeded' ? { result: {} } : {}),
      ...(status === 'failed' ? { error: { message: error instanceof Error ? error.message : String(error ?? 'Comic image generation failed.') } } : {}),
    }
  })
  const updateImageManifest = async (status: PipelineProviderState['status'], error?: unknown): Promise<void> => {
    if (!canonicalManifest) return
    await updateComicImageManifest({
      sceneRunDir,
      sourceIdentity: canonicalManifest.source as ComicSourceIdentity,
      providers: imageProviderState(status, error),
      artifactRefs: status === 'succeeded' ? await collectImageArtifactRefs(sceneRunDir) : [],
    })
  }

  await updateImageManifest('running')

  try {
    if (target === 'sketches' || target === 'both') {
      const sketchPanels = panelSelectionToSketchRange(options.panels)
      const sketchStats = await runSketches({
        sceneSlug,
        imageModels: models,
        size,
        quality,
        runId,
        concurrency,
        ...(options.force !== undefined ? { force: options.force } : {}),
        ...(sketchPanels !== undefined ? { sketchPanels } : {}),
        panelsPerImage: sketchPanelsPerImage,
      })
      mergeImageStats(totals, sketchStats)
    }

    if (target === 'images' || target === 'both') {
      const imageStats = await runImages({
        ...options,
        imageModels: models,
        size,
        quality,
        panelsPerImage: finalPanelsPerImage,
        qa: options.qa ?? true,
        ...(options.qaModel ? { qaModel: options.qaModel } : {}),
        maxRepairs: options.maxRepairs ?? 2,
        runId,
        concurrency,
      })
      mergeImageStats(totals, imageStats)
    }
  } catch (error) {
    await updateImageManifest('failed', error)
    throw error
  }
  await updateImageManifest('succeeded')

  comicLog.summary([
    `generated=${totals.imagesGenerated}`,
    `skipped=${totals.imagesSkipped}`,
    `tokens=${(totals.totalInputTokens + totals.totalOutputTokens).toLocaleString()}`,
    `cost=${formatCompactCost(totals.totalCost)}`,
    `api=${formatDuration(totals.totalDurationMs)}`,
    `duration=${formatDuration(Date.now() - startedAt)}`,
  ])
  comicLog.outputDirectory(sceneRunDir)
}
