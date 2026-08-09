import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'

export const readEnv = (key: string): string | undefined => {
  const val = process.env[key]?.trim()
  return val || undefined
}

export const requireApiKey = (envVar: string, stage: string, description?: string): string => {
  const value = readEnv(envVar)
  if (!value) {
    throw InternalError(`${envVar} environment variable is required${description ? ` for ${description}` : ''}`, { stage, hints: hintsForMissingEnv(envVar) })
  }
  return value
}

// Explicitly () => Promise<void>: bootstrap-broker `ensure` entries require void, and a
// () => Promise<string> factory would not be assignable there.
export const ensureApiKeySetup = (envVar: string, stage: string, description?: string): () => Promise<void> =>
  async () => { requireApiKey(envVar, stage, description) }
