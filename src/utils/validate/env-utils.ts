import { AppUsageError, extractErrorMetadata, InternalError } from '~/utils/error-handler'
import { findHostedProviderCredential, HOSTED_PROVIDER_ENV_CHECKS } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import type { HostedProviderEnvCheck } from '~/types'

export const MISSING_ENV_HINTS: Readonly<Record<string, string>> = Object.fromEntries(
  HOSTED_PROVIDER_ENV_CHECKS.map(spec => [
    spec.envVar,
    `Set ${spec.envVar} environment variable to use ${spec.label} (${spec.hintUrl})`
  ])
)

export const hintsForMissingEnv = (key: string): string[] => [
  MISSING_ENV_HINTS[key] ?? `Set ${key} environment variable to use this provider`
]

export const readEnv = (key: string): string | undefined => {
  const val = process.env[key]?.trim()
  return val || undefined
}

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
  if (!spec) {
    throw InternalError(`Unknown hosted provider credential: ${providerId}`, {
      stage: 'credential',
      retryable: false
    })
  }
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

export const missingCredentialEnvVar = (error: unknown): string | undefined => {
  const value = extractErrorMetadata(error)['missingEnvVar']
  return typeof value === 'string' ? value : undefined
}
