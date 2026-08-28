import type { ProviderVoiceRef, SanitizedProviderVoiceMetadata } from '~/types'

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
