import type { ProviderVoiceRef, TtsProvider } from '~/types'

export type AdvancedProviderHttpRequest = <T = unknown>(input: {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  query?: Readonly<Record<string, string | undefined>> | undefined
  headers?: Readonly<Record<string, string>> | undefined
  body?: unknown | undefined
  signal?: AbortSignal | undefined
}) => Promise<T>

/**
 * Identity used in the shared safety messages. `labelWithArticle` exists because the
 * provider names take different articles ("a Cartesia" vs "an Inworld") and these
 * strings are asserted verbatim by the management contract tests.
 */
export type AdvancedVoiceProviderIdentity = {
  provider: TtsProvider
  label: string
  labelWithArticle: string
  accountScopeHash: string
}

/**
 * How one provider spells its deletion eligibility rule. `namespaceCheck` decides which
 * guard a non-account namespace trips: most providers treat it as an ownership failure,
 * ElevenLabs reports it as an account-scope mismatch.
 */
export type AdvancedVoiceDeletionPolicy = {
  /** Completes "… deletes only eligibility-checked project-owned <ownedResourceLabel>." */
  ownedResourceLabel: string
  namespaceCheck?: 'ownership' | 'account-scope' | undefined
}

export type RemoteVoiceResourceRef = Extract<ProviderVoiceRef, { kind: 'remote-resource' }>
