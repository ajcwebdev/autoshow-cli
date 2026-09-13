import type { ImageProvider, ImageReferenceCapabilities } from '~/types'
import { getModelRegistry } from './model-loader/registry'
import { UsageError } from '~/utils/error-handler'

export const getImageReferenceCapabilities = (model: string, provider?: ImageProvider): ImageReferenceCapabilities => {
  const registry = getModelRegistry().image
  for (const service of provider ? [registry[provider]] : Object.values(registry)) {
    if (!service) continue
    const modelConfig = service.models[model]
    if (modelConfig) return Object.freeze(modelConfig.referenceImages ?? service.referenceImages)
  }
  throw UsageError(`Image model "${model}" was not found in the central registry`)
}

export const validateImageReferenceCapabilities = (model: string, inputCount: number, provider?: ImageProvider): void => {
  if (inputCount === 0) return
  const capability = getImageReferenceCapabilities(model, provider)
  if (!capability.supported || inputCount > capability.maxInputs) {
    throw UsageError(`--input provides ${inputCount} references for ${model}, but the central image registry allows ${capability.supported ? capability.maxInputs : 0}.`)
  }
}
