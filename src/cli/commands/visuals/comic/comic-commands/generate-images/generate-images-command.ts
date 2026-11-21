import { mkdir, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import type { ComicSourceIdentity, ComicStageArtifactRef, FinalPanelImageStageDependencies, FinalPanelImageStageOptions, GenerateImagesCommandOptions, GenerateImagesWorkflowDependencies, ImageRunStats, PipelineProviderState } from '~/types'
import { createProviderSettingsRecord } from '~/cli/commands/command-shared/pipeline-manifest/provider-settings-record'
import { CLI_INVOCATION } from '~/cli/cli-invocation'
import { InfraError } from '~/utils/error-handler'
import { readPngChunks, verifyPngSamples } from '~/utils/lossless-png'
import { canonicalTargetKey, sha256Bytes } from '../../../../audio/tts/script-to-audio/contract-identity'
import { captureComicImageRecoveryInputs, comicImageRecoveryFlags, comicImageRecoveryHash } from '../../comic-utils/comic-image-recovery'
import { comicLog, err, formatCompactCost, formatDuration, withSuppressedPipelineLogs } from '../../comic-utils/comic-logger'
import { updateComicImageManifest } from '../../comic-utils/comic-manifest'
import { createComicImageUsageCheckpoint } from '../../comic-utils/comic-image-usage-checkpoint'
import { completeComicRecoveryIntent, recordComicRecoveryIntent } from '../../comic-utils/comic-recovery-intent'
import { findImageRunRecord, readPanelSelections, readRecordedComicImageEvidence } from '../../comic-utils/panel-selection'
import { getSceneOutputDirectory } from '../../comic-utils/project-paths'
import { assertPanelPromptSourceCoverage } from '../../comic-utils/source-coverage-utils'
import { createFinalGridOptions, createFinalPageOptions, createFinalPanelOptions, prepareFinalPanelStage } from './comic-final-image-stage-options'
import { runComicImageGenerationMode } from './comic-image-run-modes'
import { prepareComicImageRun } from './comic-image-run-preparation'
import { failedImageRunStatsFromError, mergeImageStats } from './comic-image-run-statistics'
import { generateComicGridPages } from './generate-comic-grid-pages'
import { generateComicPages } from './generate-comic-pages'
import { generatePanelImages } from './generate-panel-images'

const IMAGE_ARTIFACT_DIRECTORIES = ['panels', 'pages', 'sketches'] as const

/**
 * Rebuild image-stage refs from the bytes on disk. A retained ref under an image directory survives only while its file
 * still exists and is still eligible, so deleted, replaced or damaged files never leave a stale hash that would fail
 * manifest artifact verification on the next read.
 */
export const collectImageArtifactRefs = async (sceneRunDir: string, retained: ComicStageArtifactRef[]): Promise<ComicStageArtifactRef[]> => {
  const paths: string[] = []
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && !entry.name.startsWith('.') && ['.png', '.webp', '.jpg', '.jpeg'].includes(extname(entry.name).toLowerCase())) paths.push(path)
    }
  }
  await Promise.all(IMAGE_ARTIFACT_DIRECTORIES.map(async directory => await visit(join(sceneRunDir, directory))))
  const isScanned = (path: string): boolean => IMAGE_ARTIFACT_DIRECTORIES.some(directory => path.startsWith(`${directory}/`))
  const retainedByPath = new Map(retained.map(ref => [ref.path, ref]))
  // Refs outside the scanned image directories are not this function's to judge, so they pass through unchanged.
  const refs = new Map(retained.filter(ref => !isScanned(ref.path)).map(ref => [ref.path, ref]))
  const { panelHashes, localGrids } = await readRecordedComicImageEvidence(sceneRunDir)
  for (const file of paths) {
    const path = relative(sceneRunDir, file).split('\\').join('/')
    const bytes = await Bun.file(file).bytes()
    const sha256 = sha256Bytes(bytes)
    const prior = retainedByPath.get(path)
    if (prior?.sha256 === sha256) {
      refs.set(path, prior)
      continue
    }
    const expected = panelHashes.get(path)
    if (expected !== undefined && expected !== sha256) continue
    if (expected === undefined && !path.startsWith('sketches/') && extname(file).toLowerCase() === '.png') {
      // A failed attempt can leave an unrecorded input in place for repair.
      // Binding its damaged bytes here would prevent a retry with the restored image.
      try {
        if (localGrids.has(path)) readPngChunks(bytes)
        else verifyPngSamples(bytes)
      } catch { continue }
    }
    refs.set(path, { path, sha256 })
  }
  return [...refs.values()].sort((a, b) => a.path.localeCompare(b.path))
}

export const runFinalPanelImageStage = async (options: FinalPanelImageStageOptions, dependencies: FinalPanelImageStageDependencies = {}): Promise<ImageRunStats> => {
  const { sceneSlug } = options
  const checkPanelPromptSourceCoverage = dependencies.checkPanelPromptSourceCoverage ?? assertPanelPromptSourceCoverage
  const prepared = prepareFinalPanelStage(options)
  const { usePageMode, stageLabel } = prepared

  try {
    await mkdir(getSceneOutputDirectory(sceneSlug), { recursive: true })
    await checkPanelPromptSourceCoverage(sceneSlug)
  } catch (error) {
    err('Image initialization failed:', error instanceof Error ? error.message : String(error))
    throw InfraError('Failed at initialization step', {
      stage: 'comic:generate-images',
      ...(error instanceof Error ? { cause: error } : {})
    })
  }

  let generatedPanelStats: ImageRunStats | undefined
  try {
    if (options.grid) {
      generatedPanelStats = await generatePanelImages(sceneSlug, createFinalPanelOptions(options, prepared), dependencies)
      const gridStats = await generateComicGridPages(sceneSlug, createFinalGridOptions({ ...options, grid: options.grid }, prepared), dependencies)
      mergeImageStats(generatedPanelStats, gridStats)
      return generatedPanelStats
    }

    if (usePageMode) return await generateComicPages(sceneSlug, createFinalPageOptions(options, prepared), dependencies)
    return await generatePanelImages(sceneSlug, createFinalPanelOptions(options, prepared), dependencies)
  } catch (error) {
    err(`${stageLabel} generation failed:`, error instanceof Error ? error.message : String(error))
    throw InfraError(`Failed at ${options.grid ? 'grid' : usePageMode ? 'page' : 'image'} generation step`, {
      stage: 'comic:generate-images',
      ...(generatedPanelStats ? { metadata: { imageRunStats: generatedPanelStats } } : {}),
      ...(error instanceof Error ? { cause: error } : {})
    })
  }
}

const runGenerateImagesCommand = async (
  options: GenerateImagesCommandOptions,
  dependencies: GenerateImagesWorkflowDependencies = {}
): Promise<void> => {
  const context = await prepareComicImageRun(options, dependencies)
  const attemptId = crypto.randomUUID()
  const { sceneRunDir, canonicalManifest, target, model, size, quality, finalPanelsPerImage, runId, recoveryOptions, startedAt, totals } = context
  const checkpoint = canonicalManifest ? createComicImageUsageCheckpoint(sceneRunDir, runId, model, attemptId) : undefined
  const imageProviderState = (status: PipelineProviderState['status'], error?: unknown): PipelineProviderState[] => {
    const service = findRegistryServiceForModel('image', model)
    if (!service) throw InfraError(`Comic image model ${model} is missing its central provider identity.`, { stage: 'comic:generate-images' })
    const transport = 'hosted-api'
    return [{
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
      settings: createProviderSettingsRecord({
        service,
        operation: 'comic-image',
        request: { model, size, quality },
        local: {
          target,
          panelsPerImage: finalPanelsPerImage,
          panels: Array.isArray(options.panels) ? options.panels.join(',') : options.panels ?? 'all',
          grid: options.grid ? `${options.grid.columns}x${options.grid.rows}` : undefined,
          stopOnProviderError: options.stopOnProviderError === true,
        },
      }),
      metadata: {
        imagesGenerated: totals.imagesGenerated,
        imagesSkipped: totals.imagesSkipped,
        runId,
        usage: {
          costUsd: totals.totalCost,
          durationMs: totals.totalDurationMs,
          imageInputUnits: totals.totalInputImageTokens,
          textInputUnits: totals.totalInputTextTokens,
          imageOutputUnits: totals.totalOutputImageTokens,
        },
        ...(options.hostedConcurrencyCoordinator ? { hostedConcurrency: options.hostedConcurrencyCoordinator.snapshot() } : {}),
      },
      ...(status === 'succeeded' ? { result: {} } : {}),
      ...(status === 'failed' ? { error: { message: error instanceof Error ? error.message : String(error ?? 'Comic image generation failed.') } } : {}),
    }]
  }
  const reportImageRun = async (failed: boolean): Promise<void> => {
    if (target === 'sketches') return
    const review = `${CLI_INVOCATION} comic review ${Bun.$.escape(options.scriptPath)} --output-dir ${Bun.$.escape(sceneRunDir)}`
    try {
      const record = await findImageRunRecord(options.sceneSlug, runId)
      if (record && (record.panels.length || record.pages?.length)) {
        comicLog.line(`Image run: ${runId} — preview with \`${review} --run ${runId}\``)
        return
      }
      if (failed) {
        const hasCurrentSelections = (await readPanelSelections(options.sceneSlug)).size > 0
        const hint = hasCurrentSelections ? ` Preview current selections with \`${review}\`.` : ''
        comicLog.line(`Image run ${runId} produced no review candidates.${hint}`)
      } else {
        comicLog.line(`Current selections reused — preview with \`${review}\``)
      }
    } catch (error) {
      comicLog.line(`Could not resolve a preview for image run ${runId}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const updateImageManifest = async (status: PipelineProviderState['status'], error?: unknown): Promise<void> => {
    if (!canonicalManifest) return
    await updateComicImageManifest({
      sceneRunDir,
      sourceIdentity: canonicalManifest.source as ComicSourceIdentity,
      providers: imageProviderState(status, error),
      attemptId,
      ...(status === 'running' ? {} : { artifactRefs: retained => collectImageArtifactRefs(sceneRunDir, retained) }),
    })
  }

  if (canonicalManifest && Object.keys(dependencies).length === 0) {
    await recordComicRecoveryIntent({ rootDir: sceneRunDir, sourceIdentity: canonicalManifest.source as ComicSourceIdentity, stage: 'image', flags: comicImageRecoveryFlags(options), inputs: await captureComicImageRecoveryInputs(sceneRunDir, true), planHash: comicImageRecoveryHash(recoveryOptions), imageRunId: runId })
  }
  await updateImageManifest('running')

  try {
    await runComicImageGenerationMode(checkpoint ? { ...options, checkpointPurchase: checkpoint.record } : options, dependencies, context, runFinalPanelImageStage)
  } catch (error) {
    mergeImageStats(totals, failedImageRunStatsFromError(error))
    await updateImageManifest('failed', error)
    await checkpoint?.clear()
    await reportImageRun(true)
    throw error
  }
  await updateImageManifest('succeeded')
  await checkpoint?.clear()
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
  await reportImageRun(false)
}

export const generateImagesCommand = async (
  options: GenerateImagesCommandOptions,
  dependencies: GenerateImagesWorkflowDependencies = {}
): Promise<void> => await withSuppressedPipelineLogs(
  async () => { await runGenerateImagesCommand(options, dependencies) }
)
