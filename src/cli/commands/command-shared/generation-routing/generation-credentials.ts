import type { GenerationModality, GenerationSelectionEntry } from '~/types'
import { InternalError } from '~/utils/error-handler'
import { resolveCredential } from '~/utils/validate/env-utils'
import { GENERATION_SELECTION_ENTRIES } from './generation-selection-entries'

/** Every generation provider authenticates under its own provider id, so service doubles as the credential key. */
export const getGenerationCredentialEntry = (
  modality: GenerationModality,
  service: string
): GenerationSelectionEntry => {
  const entry = GENERATION_SELECTION_ENTRIES.find(candidate => candidate.modality === modality && candidate.service === service)
  if (!entry) {
    throw InternalError(`No ${modality} generation provider is registered for service ${service}`, { stage: 'credential' })
  }
  return entry
}

export const getGenerationStage = (
  modality: GenerationModality,
  service: string
): string => `${modality}:${service}`

/**
 * Resolves the provider key from the registry entry instead of a per-provider `ensure*Setup` shim,
 * so the stage and description are data rather than three literals repeated at every call site.
 */
export const requireGenerationCredential = (
  modality: GenerationModality,
  service: string
): string => {
  const entry = getGenerationCredentialEntry(modality, service)
  return resolveCredential(entry.service, 'require', {
    stage: getGenerationStage(modality, service),
    description: entry.credentialDescription
  })
}
