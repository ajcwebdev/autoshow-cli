import { HAPPYSCRIBE_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireProviderKey } from '~/utils/validate/env-utils'
import { httpResponseError, parseJsonOrText, resolveRestPath } from '~/utils/rest-client'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { UsageError, ValidationError } from '~/utils/error-handler'
import type { HappyScribeOrganization, HappyScribeOrganizationSelection } from '~/types'
import {
  extractHappyScribeErrorMessage,
  isRecord,
  normalizeHappyScribeId
} from './happyscribe-utils'

const ORGANIZATION_REQUEST_TIMEOUT_MS = 60_000

export const HAPPYSCRIBE_STT_LANGUAGE = 'en-US'

const parseOrganization = (value: unknown): HappyScribeOrganization | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const id = normalizeHappyScribeId(value['id'])
  if (!id) {
    return undefined
  }

  return {
    id,
    ...(typeof value['name'] === 'string' && value['name'].trim().length > 0
      ? { name: value['name'].trim() }
      : {}),
    ...(typeof value['currency'] === 'string' && value['currency'].trim().length > 0
      ? { currency: value['currency'].trim().toLowerCase() }
      : {})
  }
}

export const getHappyScribeBaseUrl = (): string => HAPPYSCRIBE_DEFAULT_BASE_URL

const formatHappyScribeOrganizationChoices = (
  organizations: HappyScribeOrganization[]
): string =>
  organizations.length === 0
    ? 'none'
    : organizations
        .map((organization) => {
          const parts = [
            organization.id,
            organization.name ? `"${organization.name}"` : undefined,
            organization.currency ? `currency=${organization.currency}` : 'currency=unknown'
          ].filter((value): value is string => typeof value === 'string')
          return parts.join(' ')
        })
        .join(', ')

const listHappyScribeOrganizations = async (
  options: {
    apiKey?: string | undefined
    baseURL?: string | undefined
  } = {}
): Promise<HappyScribeOrganization[]> => {
  const apiKey = options.apiKey ?? requireProviderKey('happyscribe', 'stt:happyscribe', 'Happy Scribe transcription')

  const baseURL = options.baseURL ?? getHappyScribeBaseUrl()
  const payload = await withRetry(
    {
      retryClass: 'runtime_http_read',
      operationName: 'happyscribe-list-organizations',
      timeoutMs: ORGANIZATION_REQUEST_TIMEOUT_MS
    },
    async (signal) => {
      const response = await fetch(resolveRestPath(baseURL, '/organizations'), {
        method: 'GET',
        headers: {
          authorization: `Bearer ${apiKey}`,
          accept: 'application/json'
        },
        signal: signal ?? null
      })
      const payload = parseJsonOrText(await response.text())

      if (!response.ok) {
        throw httpResponseError(
          `Happy Scribe organizations lookup failed (${response.status}): ${extractHappyScribeErrorMessage(payload) ?? 'Unknown error'}`,
          response,
          {
            stage: 'create',
            retryClass: 'runtime_http_read',
            rawResponse: payload
          }
        )
      }

      return payload
    },
    (error) => classifyFetchRetry(error, 'runtime_http_read')
  )

  if (!isRecord(payload) || !Array.isArray(payload['organizations'])) {
    throw ValidationError('Happy Scribe organizations response missing organizations array', { stage: 'stt:happyscribe' })
  }

  return payload['organizations']
    .map(parseOrganization)
    .filter((organization): organization is HappyScribeOrganization => organization !== undefined)
}

export const resolveHappyScribeOrganizationSelection = async (
  options: {
    preferredOrganizationId?: string | undefined
  } = {}
): Promise<HappyScribeOrganizationSelection> => {
  const organizations = await listHappyScribeOrganizations()
  const requestedOrganizationId = options.preferredOrganizationId?.trim()

  if (requestedOrganizationId) {
    const selected = organizations.find((organization) => organization.id === requestedOrganizationId)
    if (selected) {
      return {
        selected,
        organizations,
        source: 'option',
        requestedOrganizationId
      }
    }

    return {
      organizations,
      reason: 'not_found',
      source: 'option',
      requestedOrganizationId
    }
  }

  if (organizations.length === 1) {
    return {
      selected: organizations[0],
      organizations,
      source: 'auto'
    }
  }

  return {
    organizations,
    reason: organizations.length === 0 ? 'missing' : 'ambiguous'
  }
}

export const buildHappyScribeOrganizationResolutionError = (
  selection: HappyScribeOrganizationSelection
): Error => {
  const baseMessage = selection.reason === 'not_found'
    ? `Happy Scribe organization "${selection.requestedOrganizationId}" was not found for this API key.`
    : selection.reason === 'ambiguous'
      ? 'Happy Scribe execution requires an explicit organization because this API key can access multiple organizations.'
      : 'No Happy Scribe organizations are available for this API key.'

  return UsageError(
    [
      baseMessage,
      `Organizations: ${formatHappyScribeOrganizationChoices(selection.organizations)}.`
    ].join(' '),
    'Pass --stt-happyscribe-organization-id <id> or save defaults.extract.stt.happyscribeOrganizationId with bun autoshow config.'
  )
}

export const ensureHappyScribeSttSetup = async (): Promise<void> => { requireProviderKey('happyscribe', 'stt:happyscribe', 'Happy Scribe transcription') }
