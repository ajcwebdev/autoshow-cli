import type { ExtractRoute, InputFamily, OptionalProviderModelIdentity } from '~/types'

export type ProviderSpec = OptionalProviderModelIdentity

export type ProviderManifestBase<TKind extends string> = OptionalProviderModelIdentity & {
  schemaVersion: 2
  kind: TKind
  metadata: Record<string, unknown>
}

export type ProviderCheckpoint = ProviderManifestBase<'provider-checkpoint'>

export type ProviderResult = ProviderManifestBase<'provider-result'> & {
  result: Record<string, unknown>
}

export type RunManifest = {
  schemaVersion: 3
  kind: 'metadata' | 'download' | 'extract' | 'write' | 'tts' | 'image' | 'video' | 'music'
  metadata: Record<string, unknown>
}

export type BatchManifest = {
  schemaVersion: 3
  kind: RunManifest['kind']
  items: Record<string, unknown>[]
  source?: Record<string, unknown> | undefined
}


export type ExtractBatchManifestItem = {
  input: string
  inputFamily: InputFamily
  extractRoute?: ExtractRoute | undefined
  childBatchEntry?: {
    route: ExtractRoute
    index: number
  } | undefined
  completionStatus: 'full' | 'incomplete' | 'failed' | 'skipped'
  skipReason?: string | undefined
  outputDir?: string | undefined
}

export type ExtractBatchManifest = {
  schemaVersion: 3
  createdAt: string
  items: ExtractBatchManifestItem[]
  childBatches: {
    media?: string | undefined
    document?: string | undefined
    article?: string | undefined
    'x-space'?: string | undefined
  }
}
