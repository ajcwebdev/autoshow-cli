import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import type {
  ParsedGenerateBaseArgs,
  ParsedGenerateImagesArgs
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import {
  COMIC_GRID_PANEL_SIZE,
  DEFAULT_FINAL_PANELS_PER_IMAGE,
  validateComicGridOptions
} from '../comic-commands/generate-images/comic-page-utils'
import {
  validateImageSizeForModels,
} from './image-size'

export const validateComicImageTarget = (output: ParsedGenerateBaseArgs) => {
  if (output.grid && output.panelsPerImage === undefined) {
    throw UsageError('--grid requires --panels-per-image 1')
  }
}

// The resolved configuration must still name one registered image model, whatever produced it.
const assertSingleResolvedImageModel = (output: ParsedGenerateBaseArgs) => {
  const model: unknown = output.imageModel
  if (model === undefined) return
  if (typeof model !== 'string' || !findRegistryServiceForModel('image', model)) {
    throw UsageError('comic generate-images accepts exactly one registered image model per run')
  }
}

export const finalizeComicImageOptions = (output: ParsedGenerateBaseArgs) => {
  const target = output.target ?? 'images'
  assertSingleResolvedImageModel(output)
  validateImageSizeForModels(output.size, output.imageModel === undefined ? undefined : [output.imageModel])
  validateComicGridOptions(output.grid, {
    target,
    size: output.size ?? COMIC_GRID_PANEL_SIZE,
    panelsPerImage: output.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE,
  })
  return output as ParsedGenerateImagesArgs
}
