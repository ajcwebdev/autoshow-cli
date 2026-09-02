import type { ImageGenerationModel, ReferenceImageCapabilities } from '~/types'
import { getImageReferenceCapabilities } from '~/cli/commands/setup-and-utilities/models/image-reference-capabilities'
import { ValidationError } from '~/utils/error-handler'

const getReferenceImageCapabilities = (model: ImageGenerationModel): ReferenceImageCapabilities => {
  return getImageReferenceCapabilities(model)
}

export const validateReferenceImageCount = (
  model: ImageGenerationModel,
  requiredCount: number,
  context: string,
): void => {
  const capability = getReferenceImageCapabilities(model)
  if (!capability.supported || requiredCount > capability.maxInputs) {
    throw ValidationError(
      `${context} requires ${requiredCount} reference image${requiredCount === 1 ? '' : 's'}, but ${model} supports ${capability.supported ? capability.maxInputs : 0}. ` +
      'Choose a model with a higher reference limit or reduce --panels-per-image.',
      { stage: 'comic:reference-preflight' }
    )
  }
}

export const trimOptionalContinuityReferences = (
  model: ImageGenerationModel,
  required: readonly string[],
  optional: readonly string[],
  options: { reserveSlots?: number | undefined } = {},
): { references: string[]; trimmed: string[] } => {
  validateReferenceImageCount(model, required.length, 'Required character references')
  const { maxInputs } = getReferenceImageCapabilities(model)
  const reserveSlots = Math.max(0, Math.floor(options.reserveSlots ?? 0))
  const available = Math.max(0, maxInputs - required.length - reserveSlots)
  return {
    references: [...required, ...optional.slice(0, available)],
    trimmed: optional.slice(available),
  }
}
