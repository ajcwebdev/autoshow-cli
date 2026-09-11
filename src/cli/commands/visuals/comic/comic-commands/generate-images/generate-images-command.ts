import { mkdir, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import type { ComicSourceIdentity, FinalPanelImageStageOptions, GenerateImagesCommandOptions, GenerateImagesWorkflowDependencies, ImageRunStats, PipelineProviderState } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { canonicalTargetKey, sha256Bytes } from '../../../../audio/tts/script-to-audio/contract-identity'
import { captureComicImageRecoveryInputs, comicImageRecoveryFlags, comicImageRecoveryHash } from '../../comic-utils/comic-image-recovery'
import { comicLog, err, formatCompactCost, formatDuration, withSuppressedPipelineLogs } from '../../comic-utils/comic-logger'
import { updateComicImageManifest } from '../../comic-utils/comic-manifest'
import { completeComicRecoveryIntent, recordComicRecoveryIntent } from '../../comic-utils/comic-recovery-intent'
import { getSceneOutputDirectory } from '../../comic-utils/project-paths'
import { assertPanelPromptSourceCoverage } from '../../comic-utils/source-coverage-utils'
import { createFinalGridOptions, createFinalPageOptions, createFinalPanelOptions, prepareFinalPanelStage } from './comic-final-image-stage-options'
import { runComicImageAuditMode, runComicImageGenerationMode, runComicImageRevisionMode } from './comic-image-run-modes'
import { prepareComicImageRun } from './comic-image-run-preparation'
import { failedImageRunStatsFromError, mergeImageStats } from './comic-image-run-statistics'
import { generateComicGridPages } from './generate-comic-grid-pages'
import { generateComicPages } from './generate-comic-pages'
import { generatePanelImages } from './generate-panel-images'

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

const runFinalPanelImageStage = async (options: FinalPanelImageStageOptions): Promise<ImageRunStats> => {
  const { sceneSlug } = options
  const prepared = prepareFinalPanelStage(options)
  const { usePageMode, stageLabel } = prepared

  try {
    await mkdir(getSceneOutputDirectory(sceneSlug), { recursive: true })
    await assertPanelPromptSourceCoverage(sceneSlug)
  } catch (error) {
    err('Image initialization failed:', error instanceof Error ? error.message : String(error))
    throw InfraError('Failed at initialization step', {
      stage: 'comic:generate-images',
      ...(error instanceof Error ? { cause: error } : {})
    })
  }

  try {
    if (options.grid) {
      const panelStats = await generatePanelImages(sceneSlug, createFinalPanelOptions(options, prepared))
      const gridStats = await generateComicGridPages(sceneSlug, createFinalGridOptions(options, prepared))
      mergeImageStats(panelStats, gridStats)
      return panelStats
    }

    if (usePageMode) {

      return await generateComicPages(sceneSlug, createFinalPageOptions(options, prepared))
    } else {

      return await generatePanelImages(sceneSlug, createFinalPanelOptions(options, prepared))
    }
  } catch (error) {
    err(`${stageLabel} generation failed:`, error instanceof Error ? error.message : String(error))
    throw InfraError(`Failed at ${options.grid ? 'grid' : usePageMode ? 'page' : 'image'} generation step`, {
      stage: 'comic:generate-images',
      ...(error instanceof Error ? { cause: error } : {})
    })
  }
}

const runGenerateImagesCommand = async (
  options: GenerateImagesCommandOptions,
  dependencies: GenerateImagesWorkflowDependencies = {}
): Promise<void> => {
  const context = await prepareComicImageRun(options, dependencies)
  const { sceneRunDir, canonicalManifest, target, models, size, quality, finalPanelsPerImage, runId, recoveryOptions, startedAt, totals } = context
  if (options.qaOnly) return await runComicImageAuditMode(options, context)
  if (options.revisionPlan) return await runComicImageRevisionMode(options, dependencies, context)
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
      metadata: {
        imagesGenerated: totals.imagesGenerated,
        imagesSkipped: totals.imagesSkipped,
        runId,
        ...(options.hostedConcurrencyCoordinator ? { hostedConcurrency: options.hostedConcurrencyCoordinator.snapshot() } : {}),
      },
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
      artifactRefs: await collectImageArtifactRefs(sceneRunDir),
    })
  }

  if (canonicalManifest && Object.keys(dependencies).length === 0) {
    await recordComicRecoveryIntent({ rootDir: sceneRunDir, sourceIdentity: canonicalManifest.source as ComicSourceIdentity, stage: 'image', flags: comicImageRecoveryFlags(options), inputs: await captureComicImageRecoveryInputs(sceneRunDir, true), planHash: comicImageRecoveryHash(recoveryOptions), imageRunId: runId })
  }
  await updateImageManifest('running')

  try {
    await runComicImageGenerationMode(options, dependencies, context, runFinalPanelImageStage)
  } catch (error) {
    mergeImageStats(totals, failedImageRunStatsFromError(error))
    await updateImageManifest('failed', error)
    throw error
  }
  await updateImageManifest('succeeded')
  if (Object.keys(dependencies).length === 0) await completeComicRecoveryIntent(sceneRunDir, 'image', comicImageRecoveryHash(recoveryOptions))

  comicLog.summary([
    `generated=${totals.imagesGenerated}`,
    `skipped=${totals.imagesSkipped}`,
    `tokens=${(totals.totalInputTokens + totals.totalOutputTokens).toLocaleString()}`,
    `cost=${formatCompactCost(totals.totalCost)}`,
    `api=${formatDuration(totals.totalDurationMs)}`,
    `duration=${formatDuration(Date.now() - startedAt)}`,
    `imageInputUnits=${totals.totalInputImageTokens.toLocaleString()}`,
  ])
  comicLog.outputDirectory(sceneRunDir)
}

export const generateImagesCommand = async (
  options: GenerateImagesCommandOptions,
  dependencies: GenerateImagesWorkflowDependencies = {}
): Promise<void> => await withSuppressedPipelineLogs(
  async () => { await runGenerateImagesCommand(options, dependencies) }
)
