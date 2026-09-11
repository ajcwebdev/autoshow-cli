import { join } from 'node:path'
import type { FinalPanelImageStageOptions, GenerateImagesCommandOptions, GenerateImagesWorkflowDependencies, ImageRunStats } from '~/types'
import { comicLog, formatCompactCost, formatDuration } from '../../comic-utils/comic-logger'
import { generateSketchesCommand } from '../generate-sketches/generate-sketches-command'
import { panelSelectionToSketchRange } from './comic-page-utils'
import { runQaOnlyPanelAudit } from './qa-only-panel-audit'
import { runRevisionEvaluation } from './revision-evaluation'

import type { PreparedComicImageRun } from './comic-image-run-preparation'
import { mergeImageStats } from './comic-image-run-statistics'

export const runComicImageAuditMode = async (options: GenerateImagesCommandOptions, { startedAt, sceneRunDir }: PreparedComicImageRun): Promise<void> => {
  const audit = await runQaOnlyPanelAudit(options)
  comicLog.summary([
    `judged=${audit.entries.length}`,
    `hardFailures=${audit.entries.filter(entry => entry.hardFailure).length}`,
    audit.continuity ? `continuityJudged=${audit.continuity.judged}` : undefined,
    audit.continuity ? `continuityFindings=${audit.continuity.hardFailures}` : undefined,
    audit.continuity ? `continuityAnchor=${audit.continuity.anchorPanel}` : undefined,
    'imageCalls=0',
    'repairCalls=0',
    `tokens=${(audit.inputTokens + audit.outputTokens).toLocaleString()}`,
    `cost=${formatCompactCost(audit.costUsd)}`,
    `duration=${formatDuration(Date.now() - startedAt)}`,
    'imageInputUnits=0',
  ])
  comicLog.outputDirectory(audit.reportDirectory)
  if (audit.continuity) comicLog.outputDirectory(join(sceneRunDir, audit.continuity.reportDirectory))
}

export const runComicImageRevisionMode = async (options: GenerateImagesCommandOptions, dependencies: GenerateImagesWorkflowDependencies, { totals, startedAt, sceneRunDir }: PreparedComicImageRun): Promise<void> => {
  const runRevision = dependencies.runRevisionEvaluation ?? (async revisionOptions => (await runRevisionEvaluation(revisionOptions)).stats)
  const revisionStats = await runRevision(options)
  mergeImageStats(totals, revisionStats)
  comicLog.summary([
    `generated=${totals.imagesGenerated}`,
    `skipped=${totals.imagesSkipped}`,
    `comparisons=${totals.totalInputTokens + totals.totalOutputTokens > 0 ? 'recorded' : 'none-recorded'}`,
    `tokens=${(totals.totalInputTokens + totals.totalOutputTokens).toLocaleString()}`,
    `cost=${formatCompactCost(totals.totalCost)}`,
    `duration=${formatDuration(Date.now() - startedAt)}`,
    `imageInputUnits=${totals.totalInputImageTokens.toLocaleString()}`,
  ])
  comicLog.outputDirectory(sceneRunDir)
}

export const runComicImageGenerationMode = async (options: GenerateImagesCommandOptions, dependencies: GenerateImagesWorkflowDependencies, context: PreparedComicImageRun, runFinalImages: (options: FinalPanelImageStageOptions) => Promise<ImageRunStats>): Promise<void> => {
  const { target, sceneSlug, models, size, quality, runId, concurrency, sketchPanelsPerImage, finalPanelsPerImage, totals } = context
  const runSketches = dependencies.runSketches ?? generateSketchesCommand
  const runImages = dependencies.runImages ?? runFinalImages
  if (target === 'sketches' || target === 'both') {
    const sketchPanels = panelSelectionToSketchRange(options.panels)
    const sketchStats = await runSketches({
      sceneSlug,
      imageModels: models,
      size,
      quality,
      runId,
      concurrency,
      hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator,
      concurrencyMode: options.concurrencyMode,
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
}
