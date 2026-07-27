import type { ImageGenerationModel } from '~/types'
import { getImageReferenceCapabilities } from '~/cli/commands/setup-and-utilities/models/image-reference-capabilities'
import { ValidationError } from '~/utils/error-handler'

export type ReferenceImageCapabilities = Readonly<{ supported: boolean; maxInputs: number }>

export const getReferenceImageCapabilities = (model: ImageGenerationModel): ReferenceImageCapabilities => {
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
): { references: string[]; trimmed: string[] } => {
  validateReferenceImageCount(model, required.length, 'Required character references')
  const { maxInputs } = getReferenceImageCapabilities(model)
  const available = Math.max(0, maxInputs - required.length)
  return {
    references: [...required, ...optional.slice(0, available)],
    trimmed: optional.slice(available),
  }
}

export const preflightReferenceCounts = (
  requests: readonly { model: ImageGenerationModel; requiredCount: number; context: string }[]
): void => {
  const failures: string[] = []
  for (const request of requests) {
    try {
      validateReferenceImageCount(request.model, request.requiredCount, request.context)
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error))
    }
  }
  if (failures.length > 0) {
    throw ValidationError(`Reference preflight failed before any provider calls:\n- ${failures.join('\n- ')}`, { stage: 'comic:reference-preflight' })
  }
}
