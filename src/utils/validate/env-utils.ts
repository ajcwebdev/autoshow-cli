import { AppUsageError, extractErrorMetadata, hintsForMissingEnv } from '~/utils/error-handler'
import { findHostedProviderCredential, findHostedProviderCredentialByEnvVar } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import type { HostedProviderEnvCheck } from '~/types'

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
  new AppUsageError(
    `${envVar} environment variable is required${description ? ` for ${description}` : ''}`,
    hintsForMissingEnv(envVar),
    { stage, retryable: false, metadata: { missingEnvVar: envVar } }
  )

export type CredentialObservation = {
  providerId: string
  envVar: string
  label: string
  hintUrl: string
  stages: readonly string[]
  available: boolean
  value?: string | undefined
  message: string
  hints: string[]
}

type CredentialResolutionOptions = {
  stage?: string | undefined
  description?: string | undefined
  env?: Record<string, string | undefined> | undefined
  providedValue?: string | undefined
  useProvidedValue?: boolean | undefined
}

const requireKnownCredential = (providerId: string): HostedProviderEnvCheck => {
  const spec = findHostedProviderCredential(providerId)
  if (!spec) throw new TypeError(`Unknown hosted provider credential: ${providerId}`)
  return spec
}

const observeCredentialSpec = (
  spec: HostedProviderEnvCheck,
  options: CredentialResolutionOptions = {}
): CredentialObservation => {
  const rawValue = options.useProvidedValue
    ? options.providedValue
    : (options.env ?? process.env)[spec.envVar]
  const value = rawValue?.trim() || undefined
  const description = options.description ?? spec.label
  return {
    providerId: spec.providerId,
    envVar: spec.envVar,
    label: spec.label,
    hintUrl: spec.hintUrl,
    stages: spec.stages,
    available: value !== undefined,
    ...(value ? { value } : {}),
    message: `${spec.envVar} environment variable is required for ${description}`,
    hints: hintsForMissingEnv(spec.envVar)
  }
}

export function resolveCredential (
  providerId: string,
  mode: 'observe',
  options?: CredentialResolutionOptions
): CredentialObservation
export function resolveCredential (
  providerId: string,
  mode: 'require',
  options: CredentialResolutionOptions & { stage: string }
): string
export function resolveCredential (
  providerId: string,
  mode: 'observe' | 'require',
  options: CredentialResolutionOptions = {}
): CredentialObservation | string {
  const observation = observeCredentialSpec(requireKnownCredential(providerId), options)
  if (mode === 'observe') return observation
  if (!observation.value) {
    throw missingCredentialError(observation.envVar, options.stage ?? 'credential', options.description ?? observation.label)
  }
  return observation.value
}

export const requireProviderKey = (
  providerId: string,
  stage: string,
  description?: string
): string => resolveCredential(providerId, 'require', { stage, ...(description ? { description } : {}) })

export const ensureProvider = (
  providerId: string,
  stage: string,
  description?: string
): () => Promise<void> => async () => {
  requireProviderKey(providerId, stage, description)
}

export const requireApiKey = (envVar: string, stage: string, description?: string): string => {
  const spec = findHostedProviderCredentialByEnvVar(envVar)
  if (!spec) throw new TypeError(`Unknown hosted provider credential environment variable: ${envVar}`)
  return resolveCredential(spec.providerId, 'require', { stage, ...(description ? { description } : {}) })
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
  const spec = findHostedProviderCredentialByEnvVar(envVar)
  if (!spec) throw new TypeError(`Unknown hosted provider credential environment variable: ${envVar}`)
  return resolveCredential(spec.providerId, 'require', {
    stage,
    providedValue: value,
    useProvidedValue: true,
    ...(description ? { description } : {})
  })
}

/** True when `error` (or any cause) is a missing-credential failure from `requireApiKey`. */
export const missingCredentialEnvVar = (error: unknown): string | undefined => {
  const value = extractErrorMetadata(error)['missingEnvVar']
  return typeof value === 'string' ? value : undefined
}
