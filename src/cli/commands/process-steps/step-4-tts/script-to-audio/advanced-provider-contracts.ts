import type {
  AdvancedProviderHttpRequest,
  AnyCapabilityRecord,
  CapabilityDocumentationEvidence,
  TtsProvider,
} from '~/types'
import { CLIUsageError, InternalError, ProviderError } from '~/utils/error-handler'
import { extractRestErrorMessage, parseJsonOrText, readJsonResponse, readRestResponseText } from '~/utils/rest-client'
import { classifyFetchRetry, isRetryableStatus, withRetry } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { hashCanonicalTtsValue } from './contract-identity'
import { validateCapabilityFacetSet } from './contract-validation'
import { deriveProviderAccountScopeHash } from '~/utils/account-scope-hash'
import { findHostedTtsCredential } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { requireProvidedApiKey } from '~/utils/validate/env-utils'

const ADVANCED_PROVIDER_FIXTURE_CHECKED_AT = '2026-08-11T00:00:00.000Z'

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

  const execute = async (signal?: AbortSignal): Promise<T> => {
    const response = await fetch(url, {
      method: request.method,
      headers: {
        [input.apiKeyHeader]: input.apiKey,
        ...input.defaultHeaders,
        ...request.headers,
        ...(request.body === undefined || request.body instanceof FormData ? {} : { 'Content-Type': 'application/json' })
      },
      ...(request.body === undefined ? {} : { body: request.body instanceof FormData ? request.body : JSON.stringify(request.body) }),
      ...(signal ? { signal } : {})
    })
    if (!response.ok) {
      const captured = await readRestResponseText(response)
      const payload = captured.truncated ? captured.sanitizedPreview : parseJsonOrText(captured.text)
      throw ProviderError(`${input.providerLabel} management request failed (${response.status}): ${extractRestErrorMessage(payload, captured.text, response.status)}`, {
        status: response.status,
        headers: response.headers,
        stage: `${input.providerLabel}:voice-management`,
        retryable: isRetryableStatus(response.status)
      })
    }
    if (response.status === 204) return undefined as T
    return await readJsonResponse(response, `${input.providerLabel} management response`) as T
  }

  if (request.method === 'GET') {
    return await withRetry({
      retryClass: 'runtime_http_read',
      operationName: `${input.providerLabel.toLowerCase()}-voice-management-read`,
      timeoutMs: MEDIA_GENERATION_TIMEOUT_MS,
      abortSignal: request.signal
    }, execute, (error) => classifyFetchRetry(error, 'runtime_http_read'))
  }

  const timeout = AbortSignal.timeout(MEDIA_GENERATION_TIMEOUT_MS)
  const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout
  return await execute(signal)
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

export const providerAccountScopeHash = (provider: TtsProvider, credential: string): string => {
  const spec = findHostedTtsCredential(provider)
  if (!spec) {
    throw InternalError(`TTS provider ${provider} has no credential specification.`, {
      stage: 'tts:account-scope',
      retryable: false
    })
  }
  const normalized = requireProvidedApiKey(
    credential,
    spec.envVar,
    'tts:account-scope',
    `${provider} account scope`
  )
  return deriveProviderAccountScopeHash(provider, normalized)
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
