import type { FinalPanelImageStageOptions, GenerateImagesCommandOptions, GenerateImagesWorkflowDependencies, ImageRunStats } from '~/types'
import { generateSketchesCommand } from '../generate-sketches/generate-sketches-command'
import { panelSelectionToSketchRange } from './comic-page-utils'
import type { PreparedComicImageRun } from './comic-image-run-preparation'
import { mergeImageStats } from './comic-image-run-statistics'

export const runComicImageGenerationMode = async (options: GenerateImagesCommandOptions, dependencies: GenerateImagesWorkflowDependencies, context: PreparedComicImageRun, runFinalImages: (options: FinalPanelImageStageOptions) => Promise<ImageRunStats>): Promise<void> => {
  const { target, sceneSlug, model, size, quality, runId, concurrency, sketchPanelsPerImage, finalPanelsPerImage, totals } = context
  const runSketches = dependencies.runSketches ?? generateSketchesCommand
  const runImages = dependencies.runImages ?? runFinalImages
  if (target === 'sketches' || target === 'both') {
    const sketchPanels = panelSelectionToSketchRange(options.panels)
    const sketchStats = await runSketches({
      sceneSlug,
      imageModel: model,
      size,
      quality,
      runId,
      concurrency,
      checkpointPurchase: options.checkpointPurchase,
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
      imageModel: model,
      size,
      quality,
      panelsPerImage: finalPanelsPerImage,
      runId,
      concurrency,
    })
    mergeImageStats(totals, imageStats)
  }
}
