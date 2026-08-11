import { basename } from 'node:path'
import type { ProviderVoiceRef, SanitizedProviderVoiceMetadata } from '~/types'
import { CLIUsageError, InfraError, ValidationError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import { MISTRAL_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { mistralJsonRequest } from '~/utils/mistral/mistral-client'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { hashCanonicalTtsValue, sha256Bytes } from '../script-to-audio/contract-identity'

export type MistralVoiceManagementRequest = <T = unknown>(options: {
  apiKey: string
  baseURL?: string | undefined
  path: string
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | undefined
  body?: unknown
  timeoutMs?: number | undefined
  errorMessagePrefix: string
}) => Promise<T>

export type MistralSavedVoiceCreateInput = {
  apiKey: string
  protectedSamplePath: string
  name: string
  slug: string
  languages?: string[] | undefined
  gender?: string | undefined
  age?: number | undefined
  tags?: string[] | undefined
  retentionNoticeDays?: number | undefined
  baseURL?: string | undefined
  request?: MistralVoiceManagementRequest | undefined
}

export type MistralSavedVoiceObservation = {
  providerVoice: Extract<ProviderVoiceRef, { kind: 'remote-resource' }>
  accountScopeHash: string
  sanitizedMetadata: SanitizedProviderVoiceMetadata
  sanitizedResponseHash: string
  observedAt: string
}

const readRequiredString = (value: Record<string, unknown>, key: string): string => {
  const field = value[key]
  if (typeof field !== 'string' || !field.trim()) throw ValidationError(`Mistral voice response is missing ${key}.`, { stage: 'voice:mistral' })
  return field.trim()
}

const sanitizeVoiceResponse = (payload: unknown): { id: string, metadata: SanitizedProviderVoiceMetadata } => {
  if (!isRecord(payload)) throw ValidationError('Mistral voice response must be an object.', { stage: 'voice:mistral' })
  const id = readRequiredString(payload, 'id')
  const name = readRequiredString(payload, 'name')
  const metadata: SanitizedProviderVoiceMetadata = { id, name }
  for (const key of ['created_at', 'slug', 'gender', 'description', 'color'] as const) {
    if (typeof payload[key] === 'string') metadata[key] = payload[key]
  }
  for (const key of ['age', 'retention_notice', 'trimmed_seconds'] as const) {
    if (typeof payload[key] === 'number' && Number.isFinite(payload[key])) metadata[key] = payload[key]
  }
  for (const key of ['languages', 'tags'] as const) {
    if (Array.isArray(payload[key]) && payload[key].every(entry => typeof entry === 'string')) metadata[key] = payload[key]
  }
  return { id, metadata }
}

const requestDefault: MistralVoiceManagementRequest = async options => await mistralJsonRequest(options)

export const mistralAccountScopeHash = (apiKey: string): string => {
  if (!apiKey.trim()) throw CLIUsageError('Mistral voice management requires an API key.')
  return sha256Bytes(`mistral-account-scope-v1\0${apiKey}`)
}

export const createMistralSavedVoice = async (
  input: MistralSavedVoiceCreateInput
): Promise<MistralSavedVoiceObservation> => {
  if (!input.name.trim()) throw CLIUsageError('Mistral saved voice requires a name.')
  if (!/^[a-z0-9][a-z0-9-]{0,127}$/.test(input.slug)) throw CLIUsageError('Mistral saved voice slug must be lowercase letters, numbers, and hyphens.')
  const sample = Bun.file(input.protectedSamplePath)
  if (!await sample.exists()) throw InfraError('Protected Mistral voice sample is unavailable.', { stage: 'voice:mistral' })
  const bytes = new Uint8Array(await sample.arrayBuffer())
  if (bytes.byteLength === 0) throw InfraError('Protected Mistral voice sample is empty.', { stage: 'voice:mistral' })
  const body = {
    name: input.name.trim(),
    slug: input.slug,
    sample_audio: Buffer.from(bytes).toString('base64'),
    sample_filename: basename(input.protectedSamplePath),
    ...(input.languages?.length ? { languages: input.languages } : {}),
    ...(input.gender?.trim() ? { gender: input.gender.trim() } : {}),
    ...(input.age !== undefined ? { age: input.age } : {}),
    ...(input.tags?.length ? { tags: input.tags } : {}),
    ...(input.retentionNoticeDays !== undefined ? { retention_notice: input.retentionNoticeDays } : {})
  }
  const payload = await (input.request ?? requestDefault)({
    apiKey: input.apiKey,
    baseURL: input.baseURL ?? MISTRAL_DEFAULT_BASE_URL,
    path: '/audio/voices',
    method: 'POST',
    body,
    timeoutMs: MEDIA_GENERATION_TIMEOUT_MS,
    errorMessagePrefix: 'Mistral saved voice creation failed'
  })
  const observedAt = new Date().toISOString()
  const { id, metadata } = sanitizeVoiceResponse(payload)
  const accountScopeHash = mistralAccountScopeHash(input.apiKey)
  return {
    providerVoice: {
      kind: 'remote-resource',
      provider: 'mistral',
      resourceId: id,
      namespace: 'account',
      accountScopeHash,
      origin: 'saved-reference',
      ownership: 'project',
      deletion: { state: 'eligible', checkedAt: observedAt }
    },
    accountScopeHash,
    sanitizedMetadata: metadata,
    sanitizedResponseHash: hashCanonicalTtsValue(metadata),
    observedAt
  }
}

export const inspectMistralSavedVoice = async (input: {
  apiKey: string
  voiceId: string
  baseURL?: string | undefined
  request?: MistralVoiceManagementRequest | undefined
}): Promise<MistralSavedVoiceObservation> => {
  if (!input.voiceId.trim()) throw CLIUsageError('Mistral voice inspection requires a voice ID.')
  const payload = await (input.request ?? requestDefault)({
    apiKey: input.apiKey,
    baseURL: input.baseURL ?? MISTRAL_DEFAULT_BASE_URL,
    path: `/audio/voices/${encodeURIComponent(input.voiceId)}`,
    method: 'GET',
    timeoutMs: MEDIA_GENERATION_TIMEOUT_MS,
    errorMessagePrefix: 'Mistral saved voice inspection failed'
  })
  const observedAt = new Date().toISOString()
  const { id, metadata } = sanitizeVoiceResponse(payload)
  if (id !== input.voiceId) throw ValidationError('Mistral voice inspection returned a different resource ID.', { stage: 'voice:mistral' })
  const accountScopeHash = mistralAccountScopeHash(input.apiKey)
  return {
    providerVoice: {
      kind: 'remote-resource', provider: 'mistral', resourceId: id, namespace: 'account', accountScopeHash,
      origin: 'saved-reference', ownership: 'project', deletion: { state: 'eligible', checkedAt: observedAt }
    },
    accountScopeHash,
    sanitizedMetadata: metadata,
    sanitizedResponseHash: hashCanonicalTtsValue(metadata),
    observedAt
  }
}

export const inspectMistralSavedVoiceIfPresent = async (
  input: Parameters<typeof inspectMistralSavedVoice>[0]
): Promise<MistralSavedVoiceObservation | undefined> => {
  try {
    return await inspectMistralSavedVoice(input)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error && (error as { status?: unknown }).status === 404) return undefined
    throw error
  }
}

export const findMistralSavedVoiceBySlug = async (input: {
  apiKey: string
  slug: string
  baseURL?: string | undefined
  request?: MistralVoiceManagementRequest | undefined
}): Promise<MistralSavedVoiceObservation | undefined> => {
  if (!input.slug.trim()) throw CLIUsageError('Mistral reconciliation requires a saved voice slug.')
  const matches: Record<string, unknown>[] = []
  const pageSize = 1000
  let offset = 0
  for (let page = 0; page < 1000; page += 1) {
    const payload = await (input.request ?? requestDefault)({
      apiKey: input.apiKey,
      baseURL: input.baseURL ?? MISTRAL_DEFAULT_BASE_URL,
      path: `/audio/voices?limit=${pageSize}&offset=${offset}&type=custom`,
      method: 'GET',
      timeoutMs: MEDIA_GENERATION_TIMEOUT_MS,
      errorMessagePrefix: 'Mistral saved voice reconciliation lookup failed'
    })
    if (!isRecord(payload) || !Array.isArray(payload['items']) || payload['items'].some(item => !isRecord(item))) throw ValidationError('Mistral voice list returned an invalid response.', { stage: 'voice:mistral' })
    const items = payload['items'] as Record<string, unknown>[]
    matches.push(...items.filter(item => item['slug'] === input.slug))
    const total = typeof payload['total'] === 'number' && Number.isInteger(payload['total']) && payload['total'] >= 0 ? payload['total'] : undefined
    offset += items.length
    if (items.length === 0 || (total !== undefined ? offset >= total : items.length < pageSize)) break
    if (page === 999) throw ValidationError('Mistral voice reconciliation pagination exceeded its safety limit.', { stage: 'voice:mistral' })
  }
  if (matches.length > 1) throw ValidationError('Mistral voice reconciliation found multiple resources with the attempt slug.', { stage: 'voice:mistral' })
  if (matches.length === 0) return undefined
  const { id } = sanitizeVoiceResponse(matches[0])
  return await inspectMistralSavedVoice({ ...input, voiceId: id })
}

export const deleteMistralSavedVoice = async (input: {
  apiKey: string
  providerVoice: Extract<ProviderVoiceRef, { kind: 'remote-resource' }>
  confirmResourceId: string
  baseURL?: string | undefined
  request?: MistralVoiceManagementRequest | undefined
}): Promise<{ deletedAt: string, providerVoice: ProviderVoiceRef }> => {
  const voice = input.providerVoice
  if (voice.provider !== 'mistral' || voice.ownership !== 'project' || voice.deletion.state !== 'eligible') throw CLIUsageError('AutoShow can delete only an eligibility-checked project-owned Mistral voice.')
  if (voice.namespace !== 'account' || voice.accountScopeHash !== mistralAccountScopeHash(input.apiKey)) throw CLIUsageError('Mistral deletion credentials do not match the registered account scope.')
  if (input.confirmResourceId !== voice.resourceId) throw CLIUsageError('Mistral deletion confirmation does not match the exact resource ID.')
  const payload = await (input.request ?? requestDefault)({
    apiKey: input.apiKey,
    baseURL: input.baseURL ?? MISTRAL_DEFAULT_BASE_URL,
    path: `/audio/voices/${encodeURIComponent(voice.resourceId)}`,
    method: 'DELETE',
    timeoutMs: MEDIA_GENERATION_TIMEOUT_MS,
    errorMessagePrefix: 'Mistral saved voice deletion failed'
  })
  const { id } = sanitizeVoiceResponse(payload)
  if (id !== voice.resourceId) throw ValidationError('Mistral deletion returned a different resource identity.', { stage: 'voice:mistral' })
  return { deletedAt: new Date().toISOString(), providerVoice: voice }
}
