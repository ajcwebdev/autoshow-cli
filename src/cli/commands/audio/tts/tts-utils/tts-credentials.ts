import type { TtsProvider } from '~/types'
import { findHostedTtsCredential } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { ValidationError } from '~/utils/error-handler'
import { resolveCredential } from '~/utils/validate/env-utils'

/**
 * Resolves a TTS provider key from the hosted credential registry that already carries the
 * preflight label, so the provider id, stage and description are data rather than a per-provider shim.
 */
export const requireTtsCredential = (service: TtsProvider): string => {
  const credential = findHostedTtsCredential(service)
  if (!credential?.ttsPreflight) {
    throw ValidationError(`TTS provider ${service} has no credential specification.`, {
      stage: `tts:${service}`,
      retryable: false
    })
  }

  return resolveCredential(credential.providerId, 'require', {
    stage: `tts:${service}`,
    description: credential.ttsPreflight.label
  })
}
