import { mkdir } from 'node:fs/promises'
import { err } from '../../comic-utils/comic-logger'
import { generateSceneSketches } from './generate-scene-sketches'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from '../../comic-utils/image-size'
import { getSketchesDirectory } from '../../comic-utils/project-paths'
import { createComicRunId } from '../../comic-utils/comic-run-id'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { assertPanelPromptSourceCoverage } from '../../comic-utils/source-coverage-utils'
import { DEFAULT_SKETCH_PANELS_PER_IMAGE } from '../generate-images/comic-page-utils'
import { InfraError } from '~/utils/error-handler'
import type { GenerateSceneSketchesOptions, GenerateSketchesCommandOptions, ImageRunStats } from '~/types'


const DEFAULT_IMAGE_SIZE: GenerateSceneSketchesOptions['size'] = '1536x1024'
const DEFAULT_SKETCH_QUALITY: GenerateSceneSketchesOptions['quality'] = 'high'

export const generateSketchesCommand = async (
  options: GenerateSketchesCommandOptions
): Promise<ImageRunStats> => {
  const generationOptions: GenerateSceneSketchesOptions = {
    models: options.imageModels ?? [DEFAULT_IMAGE_MODEL],
    size: options.size ?? DEFAULT_IMAGE_SIZE,
    quality: options.quality ?? DEFAULT_SKETCH_QUALITY,
    force: options.force ?? false,
    runId: options.runId ?? createComicRunId(),
    concurrency: options.concurrency ?? DEFAULT_CLI_CONCURRENCY,
    panelsPerImage: options.panelsPerImage ?? DEFAULT_SKETCH_PANELS_PER_IMAGE,
    ...(options.sketchPanels !== undefined ? { sketchPanels: options.sketchPanels } : {}),
  }
  validateImageSizeForModels(generationOptions.size, generationOptions.models)

  try {
    await mkdir(getSketchesDirectory(options.sceneSlug), { recursive: true })
    await assertPanelPromptSourceCoverage(options.sceneSlug)
  } catch (error) {
    err('Sketch initialization failed:', error instanceof Error ? error.message : String(error))
    throw InfraError('Failed at initialization step', {
      stage: 'comic:generate-sketches',
      ...(error instanceof Error ? { cause: error } : {})
    })
  }

  try {
    return await generateSceneSketches(options.sceneSlug, generationOptions)
  } catch (error) {
    err('Sketch generation failed:', error instanceof Error ? error.message : String(error))
    throw InfraError('Failed at sketch generation step', {
      stage: 'comic:generate-sketches',
      ...(error instanceof Error ? { cause: error } : {})
    })
  }
}
