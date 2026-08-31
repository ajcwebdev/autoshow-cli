import { existsSync, readFileSync } from 'node:fs'
import * as v from 'valibot'
import type { GenerateImagesCommandOptions } from '~/types'
import { COMIC_GRID_PANEL_SIZE, DEFAULT_FINAL_PANELS_PER_IMAGE, panelSelectionToSketchRange, validateComicGridOptions } from '../comic-commands/generate-images/comic-page-utils'
import { ScenePromptDataSchema } from '../schemas/schemas'
import { estimateFinalPanelImagesPrice } from './comic-price-final-image-estimates'
import { estimateGenerateSketchesPrice } from './comic-price-sketch-estimates'
import { priceNotice } from './price-estimate-logging'
import { getSceneJsonPath } from './project-paths'
import { estimateQaOnlyPanelAuditPrice } from './qa-only-price-estimate'
import { estimateRevisionEvaluationPrice } from './revision-evaluation-price'

export { estimateDraftScenesPrice } from './comic-price-llm-estimates'
export { estimateCharacterSketchPrice, estimateLocationReferencePrice } from './comic-price-reference-estimates'

export const estimateGenerateImagesPrice = async (
  options: GenerateImagesCommandOptions
): Promise<void> => {
  const { sceneSlug } = options
  const sceneJsonExists = existsSync(getSceneJsonPath(sceneSlug))
  const target = options.target ?? 'images'

  validateComicGridOptions(options.grid, {
    target,
    size: options.size ?? COMIC_GRID_PANEL_SIZE,
    panelsPerImage: options.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE,
  })

  if (target === 'sketches') {
    const sketchPanels = panelSelectionToSketchRange(options.panels)
    await estimateGenerateSketchesPrice({
      sceneSlug: options.sceneSlug,
      ...(options.imageModels ? { imageModels: options.imageModels } : {}),
      ...(options.size ? { size: options.size } : {}),
      ...(options.quality ? { quality: options.quality } : {}),
      ...(options.force !== undefined ? { force: options.force } : {}),
      ...(sketchPanels !== undefined ? { sketchPanels } : {}),
      ...(options.panelsPerImage !== undefined ? { panelsPerImage: options.panelsPerImage } : {}),
    })
    return
  }

  if (!sceneJsonExists) {
    priceNotice('Comic - Price Estimate: generate-images: reviewed schemaVersion 4 scene and panel bundles are required. Run draft-scenes explicitly; generate-images price mode never drafts or upgrades artifacts.', {
      command: 'generate-images',
      scene: sceneSlug,
      sceneJsonPath: getSceneJsonPath(sceneSlug)
    })
    return
  }
  try {
    v.parse(ScenePromptDataSchema, JSON.parse(readFileSync(getSceneJsonPath(sceneSlug), 'utf8')))
  } catch {
    priceNotice('Comic - Price Estimate: generate-images: the scene is not reviewed schemaVersion 4. Run draft-scenes explicitly; older scene artifacts cannot enter controlled image generation.', {
      command: 'generate-images',
      scene: sceneSlug,
      sceneJsonPath: getSceneJsonPath(sceneSlug)
    })
    return
  }

  if (options.qaOnly) {
    await estimateQaOnlyPanelAuditPrice(options)
    return
  }

  if (options.revisionPlan) {
    await estimateRevisionEvaluationPrice(options)
    return
  }

  if (target === 'both') {
    const sketchPanels = panelSelectionToSketchRange(options.panels)
    await estimateGenerateSketchesPrice({
      sceneSlug: options.sceneSlug,
      ...(options.imageModels ? { imageModels: options.imageModels } : {}),
      ...(options.size ? { size: options.size } : {}),
      ...(options.quality ? { quality: options.quality } : {}),
      ...(options.force !== undefined ? { force: options.force } : {}),
      ...(sketchPanels !== undefined ? { sketchPanels } : {}),
      ...(options.panelsPerImage !== undefined ? { panelsPerImage: options.panelsPerImage } : {}),
    })
  }

  if (target === 'images' || target === 'both') {
    await estimateFinalPanelImagesPrice(options)
  }
}
