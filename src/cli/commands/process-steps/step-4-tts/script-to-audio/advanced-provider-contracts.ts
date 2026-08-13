import type {
  AccountCapabilityObservation,
  AnyCapabilityRecord,
  CapabilityDocumentationEvidence,
  CapabilityScope,
  ProviderAccessRequirement,
  TtsProvider,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { hashCanonicalTtsValue } from './contract-identity'
import { validateAccountCapabilityObservation, validateCapabilityFacetSet } from './contract-validation'

export const ADVANCED_PROVIDER_FIXTURE_CHECKED_AT = '2026-08-11T00:00:00.000Z'

export type AdvancedProviderHttpRequest = <T = unknown>(input: {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  query?: Readonly<Record<string, string | undefined>> | undefined
  headers?: Readonly<Record<string, string>> | undefined
  body?: unknown | undefined
  signal?: AbortSignal | undefined
}) => Promise<T>

export const createAdvancedProviderJsonRequest = (input: {
  baseUrl: string
  apiKey: string
  apiKeyHeader: string
  providerLabel: string
  defaultHeaders?: Readonly<Record<string, string>> | undefined
}): AdvancedProviderHttpRequest => async <T>(request: {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  query?: Readonly<Record<string, string | undefined>> | undefined
  headers?: Readonly<Record<string, string>> | undefined
  body?: unknown | undefined
  signal?: AbortSignal | undefined
}): Promise<T> => {
  const url = new URL(request.path, input.baseUrl.endsWith('/') ? input.baseUrl : `${input.baseUrl}/`)
  for (const [key, value] of Object.entries(request.query ?? {})) if (value !== undefined) url.searchParams.set(key, value)
  const response = await fetch(url, {
    method: request.method,
    headers: {
      [input.apiKeyHeader]: input.apiKey,
      ...input.defaultHeaders,
      ...request.headers,
      ...(request.body === undefined || request.body instanceof FormData ? {} : { 'Content-Type': 'application/json' })
    },
    ...(request.body === undefined ? {} : { body: request.body instanceof FormData ? request.body : JSON.stringify(request.body) }),
    ...(request.signal ? { signal: request.signal } : {})
  })
  if (!response.ok) {
    throw CLIUsageError(`${input.providerLabel} management request failed with HTTP ${response.status}.`)
  }
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

export const buildCapabilityDocumentationEvidence = (
  sourceRefs: readonly string[],
  checkedAt = ADVANCED_PROVIDER_FIXTURE_CHECKED_AT
): CapabilityDocumentationEvidence => {
  const evidence = { checkedAt, sourceRefs: [...sourceRefs] }
  return { ...evidence, evidenceHash: hashCanonicalTtsValue(evidence) }
}

export const buildAdvancedCapabilityFixture = <T extends readonly AnyCapabilityRecord[]>(records: T): {
  schemaVersion: 1
  records: T
  capabilityFixtureHash: string
} => {
  validateCapabilityFacetSet(records)
  const fixture = { schemaVersion: 1 as const, records }
  return { ...fixture, capabilityFixtureHash: hashCanonicalTtsValue(fixture) }
}

export const capabilityScopeHash = (scope: CapabilityScope): string => hashCanonicalTtsValue(scope)

export const providerAccountScopeHash = (provider: TtsProvider, credential: string): string => {
  const normalized = credential.trim()
  if (!normalized) throw CLIUsageError(`${provider} account scope requires configured credentials.`)
  return hashCanonicalTtsValue({ schemaVersion: 1, provider, credential: normalized })
}

export const buildAccountCapabilityObservation = (input: {
  scope: CapabilityScope
  capabilityFixtureHash: string
  accountScopeHash: string
  state: AccountCapabilityObservation['state']
  requirements: readonly ProviderAccessRequirement[]
  unmetRequirements?: readonly ProviderAccessRequirement[] | undefined
  checkedAt?: string | undefined
  expiresAt?: string | undefined
  evidenceRefs: readonly string[]
  reason?: string | undefined
}): AccountCapabilityObservation => {
  const unmetRequirements = [...(input.unmetRequirements ?? [])]
  const satisfiedRequirements = input.requirements.filter(requirement =>
    !unmetRequirements.some(unmet => hashCanonicalTtsValue(unmet) === hashCanonicalTtsValue(requirement)))
  const base = {
    capabilityScopeHash: capabilityScopeHash(input.scope),
    capabilityFixtureHash: input.capabilityFixtureHash,
    accountScopeHash: input.accountScopeHash,
    state: input.state,
    satisfiedRequirements,
    unmetRequirements,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    evidenceRefs: [...input.evidenceRefs],
    ...(input.reason ? { reason: input.reason } : {})
  }
  const observation: AccountCapabilityObservation = {
    ...base,
    observationHash: hashCanonicalTtsValue(base)
  }
  return validateAccountCapabilityObservation(observation, {
    capabilityScopeHash: base.capabilityScopeHash,
    capabilityFixtureHash: input.capabilityFixtureHash,
    accountScopeHash: input.accountScopeHash
  })
}

export const providerSecondsToMilliseconds = (seconds: number, durationMs?: number | undefined): number => {
  if (!Number.isFinite(seconds) || seconds < 0) throw CLIUsageError('Provider timing must be a finite non-negative number of seconds.')
  const rounded = Math.floor((seconds * 1000) + 0.5)
  return durationMs === undefined ? rounded : Math.min(durationMs, rounded)
}

export const providerMilliseconds = (milliseconds: number, durationMs?: number | undefined): number => {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) throw CLIUsageError('Provider timing must be a finite non-negative number of milliseconds.')
  const rounded = Math.floor(milliseconds + 0.5)
  return durationMs === undefined ? rounded : Math.min(durationMs, rounded)
}
