import { CLIUsageError, extractErrorMetadata, hintsForMissingEnv } from '~/utils/error-handler'

export const readEnv = (key: string): string | undefined => {
  const val = process.env[key]?.trim()
  return val || undefined
}

/**
 * The single credential gate.
 *
 * Kind is `usage` (exit 2), not `internal` (exit 1): a missing environment variable is a
 * user-fixable configuration mistake, and it is the one thing `hintsForMissingEnv` exists
 * to tell the user how to fix. Ten TTS/soundscape sites and three validation sites used to
 * spell the same concern their own way, so the identical mistake produced exit 1 or 2 with
 * hints or nothing depending on the provider selected.
 *
 * `metadata.missingEnvVar` is the structural marker callers classify on — it replaces
 * regexes that matched this function's own message text.
 */
const missingCredentialError = (envVar: string, stage: string, description?: string): Error =>
  Object.assign(
    CLIUsageError(`${envVar} environment variable is required${description ? ` for ${description}` : ''}`),
    { metadata: { missingEnvVar: envVar }, stage, retryable: false, hints: hintsForMissingEnv(envVar) }
  )

export const requireApiKey = (envVar: string, stage: string, description?: string): string => {
  const value = readEnv(envVar)
  if (!value) {
    throw missingCredentialError(envVar, stage, description)
  }
  return value
}

/**
 * Same contract for adapters handed a credential by their caller rather than reading the
 * environment themselves: the defensive guard reports the missing variable identically
 * instead of inventing its own message and kind.
 */
export const requireProvidedApiKey = (
  value: string | undefined,
  envVar: string,
  stage: string,
  description?: string
): string => {
  const trimmed = value?.trim()
  if (!trimmed) {
    throw missingCredentialError(envVar, stage, description)
  }
  return trimmed
}

/** True when `error` (or any cause) is a missing-credential failure from `requireApiKey`. */
export const missingCredentialEnvVar = (error: unknown): string | undefined => {
  const value = extractErrorMetadata(error)['missingEnvVar']
  return typeof value === 'string' ? value : undefined
}

// Explicitly () => Promise<void>: bootstrap-broker `ensure` entries require void, and a
// () => Promise<string> factory would not be assignable there.
export const ensureApiKeySetup = (envVar: string, stage: string, description?: string): () => Promise<void> =>
  async () => { requireApiKey(envVar, stage, description) }
