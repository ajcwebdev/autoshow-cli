import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import * as v from 'valibot'
import type { GenerateImagesCommandOptions, GenerateImagesTarget, GenerateImagesWorkflowDependencies, ImageGenerationQuality, ImageGenerationSize } from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { InfraError } from '~/utils/error-handler'
import { readManifest } from '../../../../command-shared/pipeline-manifest'
import { createImageRunStats } from '../../comic-image-services/image-costs'
import { comicLog } from '../../comic-utils/comic-logger'
import { createComicRunId } from '../../comic-utils/comic-run-id'
import { resolveCompatibleComicSceneRun } from '../../comic-utils/compatible-scene-run'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from '../../comic-utils/image-size'
import { getPanelPromptsDirectory, getSceneJsonPath, getSceneMetadataDirectoryForWorkspace, getSceneOutputDirectory } from '../../comic-utils/project-paths'
import { beginSceneRun, findLatestSceneRunDirectory } from '../../comic-utils/scene-run-context'
import { assertPanelPromptSourceCoverage } from '../../comic-utils/source-coverage-utils'
import { ScenePromptDataSchema } from '../../schemas/schemas'
import { DEFAULT_FINAL_PANELS_PER_IMAGE, DEFAULT_SKETCH_PANELS_PER_IMAGE, validateComicGridOptions } from './comic-page-utils'
import { getImagePromptVariationLabel } from './prompt-variations'

import { DEFAULT_IMAGE_QUALITY, DEFAULT_IMAGE_SIZE } from './comic-image-run-defaults'
const getGenerateImagesTarget = (target: GenerateImagesCommandOptions['target']): GenerateImagesTarget => {
  return target ?? 'images'
}

const panelPromptsExist = async (sceneSlug: string): Promise<boolean> => {
  const dir = getPanelPromptsDirectory(sceneSlug)
  if (!existsSync(dir)) return false
  const entries = await readdir(dir, { withFileTypes: true })
  return entries.some(entry => entry.isDirectory() && !entry.name.startsWith('.'))
}

const formatPanelSelection = (panels: GenerateImagesCommandOptions['panels']): string => {
  if (!panels || panels === 'all') return 'all'
  return panels.join(',')
}

export const prepareComicImageRun = async (options: GenerateImagesCommandOptions, dependencies: GenerateImagesWorkflowDependencies) => {
  const { sceneSlug } = options

  const latestRunDir = findLatestSceneRunDirectory(sceneSlug)
  const resumeLatest = latestRunDir !== undefined
    && existsSync(join(getSceneMetadataDirectoryForWorkspace(latestRunDir), 'scene.json'))
  beginSceneRun(sceneSlug, resumeLatest && latestRunDir
    ? { outputDir: latestRunDir }
    : {})
  const sceneRunDir = getSceneOutputDirectory(sceneSlug)
  let canonicalManifest = await readManifest(sceneRunDir)
  if (!canonicalManifest && Object.keys(dependencies).length === 0) throw InfraError('Comic image generation requires a canonical comic manifest from structured-script v5. Re-run comic draft-scenes for a clean scene run.', { stage: 'comic:generate-images' })
  if (Object.keys(dependencies).length === 0) canonicalManifest = (await resolveCompatibleComicSceneRun({ scriptPath: options.scriptPath, outputDir: sceneRunDir })).manifest

  const target = getGenerateImagesTarget(options.target)
  const checkPanelPromptSourceCoverage = dependencies.checkPanelPromptSourceCoverage ?? assertPanelPromptSourceCoverage
  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  const size: ImageGenerationSize = options.size ?? DEFAULT_IMAGE_SIZE
  const quality: ImageGenerationQuality = options.quality ?? DEFAULT_IMAGE_QUALITY
  const finalPanelsPerImage = options.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE
  const sketchPanelsPerImage = options.panelsPerImage ?? DEFAULT_SKETCH_PANELS_PER_IMAGE
  const concurrency = options.concurrency ?? DEFAULT_CLI_CONCURRENCY
  const runId = options.recoveryRunId ?? createComicRunId()
  const recoveryOptions = { ...options, recoveryRunId: runId }
  const startedAt = Date.now()
  const totals = createImageRunStats()

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
    options.qaOnly ? 'qaOnly=true' : undefined,
    options.revisionPlan ? `revisionPlan=${options.revisionPlan}` : undefined,
  ])

  if (canonicalManifest && (canonicalManifest.command !== 'comic' || !canonicalManifest.source)) throw InfraError('Comic image generation found a canonical manifest for another workflow.', { stage: 'comic:generate-images' })
  return { sceneSlug, sceneRunDir, canonicalManifest, target, models, size, quality, finalPanelsPerImage, sketchPanelsPerImage, concurrency, runId, recoveryOptions, startedAt, totals }
}

export type PreparedComicImageRun = Awaited<ReturnType<typeof prepareComicImageRun>>
