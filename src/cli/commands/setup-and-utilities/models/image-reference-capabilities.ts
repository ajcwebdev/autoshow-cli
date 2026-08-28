import type { ImageReferenceCapabilities } from '~/types'
import { getModelRegistry } from './model-loader/registry'
import { UsageError } from '~/utils/error-handler'

export const getImageReferenceCapabilities = (model: string): ImageReferenceCapabilities => {
  for (const service of Object.values(getModelRegistry().image)) {
    const modelConfig = service.models[model]
    if (modelConfig) return Object.freeze(modelConfig.referenceImages ?? service.referenceImages)
  }
  throw UsageError(`Image model "${model}" was not found in the central registry`)
}

export const validateImageReferenceCapabilities = (model: string, inputCount: number): void => {
  if (inputCount === 0) return
  const capability = getImageReferenceCapabilities(model)
  if (!capability.supported || inputCount > capability.maxInputs) {
    throw UsageError(`--input provides ${inputCount} references for ${model}, but the central image registry allows ${capability.supported ? capability.maxInputs : 0}.`)
  }
}
