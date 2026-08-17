import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import type { ImageGenerationModel } from '~/types'

// Maps a central image registry service name onto the ImageGenOptions /
// EstimateImageCostOptions model-list field that the shared collectors and
// pricing read. Comic resolves every image model through the central registry,
// so this is the single place that knows how a service routes.
export const SERVICE_TO_IMAGE_MODELS_FIELD: Record<string, string> = {
  gemini: 'geminiImageModels',
  openai: 'openaiImageModels',
  grok: 'grokImageModels',
  bfl: 'bflImageModels',
  replicate: 'replicateImageModels',
  lumalabs: 'lumalabsImageModels',
}

// Resolves a comic image model id to its central registry service, or undefined
// when the id is not present in image-config.json.
export const resolveImageService = (model: ImageGenerationModel): string | undefined =>
  findRegistryServiceForModel('image', model)

export const isGeminiImageModel = (model: ImageGenerationModel): boolean =>
  resolveImageService(model) === 'gemini'
