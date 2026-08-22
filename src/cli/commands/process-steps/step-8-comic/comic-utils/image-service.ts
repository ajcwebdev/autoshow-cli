import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import type { ImageGenerationModel } from '~/types'

export const SERVICE_TO_IMAGE_MODELS_FIELD: Record<string, string> = {
  gemini: 'geminiImageModels',
  openai: 'openaiImageModels',
  grok: 'grokImageModels',
  bfl: 'bflImageModels',
  replicate: 'replicateImageModels',
  lumalabs: 'lumalabsImageModels',
}

export const resolveImageService = (model: ImageGenerationModel): string | undefined =>
  findRegistryServiceForModel('image', model)

export const isGeminiImageModel = (model: ImageGenerationModel): boolean =>
  resolveImageService(model) === 'gemini'
