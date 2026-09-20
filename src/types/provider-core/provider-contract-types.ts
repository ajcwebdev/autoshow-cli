import type { ExtractRoute, InputFamily, JsonObject, ProcessCommand } from '~/types'

export type ProviderSpec = {
  provider: string
  model?: string | undefined
}

export const PIPELINE_ITEM_STATUSES = ['full', 'incomplete', 'failed', 'skipped'] as const
export type PipelineItemStatus = typeof PIPELINE_ITEM_STATUSES[number]

export const PIPELINE_PROVIDER_STATUSES = ['running', 'succeeded', 'missing', 'failed', 'skipped'] as const
export type PipelineProviderStatus = typeof PIPELINE_PROVIDER_STATUSES[number]

// Effective provider request settings and local output-shaping settings for one provider target. Recorded for provenance only; never part of an identity hash.
export type ProviderSettingsRecord = {
  schemaVersion: 1
  settingsSchema: string
  request: JsonObject
  local?: JsonObject | undefined
  ignored?: string[] | undefined
}

export type PipelineProviderState = {
  service: string
  model?: string | null | undefined
  local?: boolean | undefined
  operation?: string | undefined
  targetKey?: string | undefined
  transport?: string | undefined
  artifactDir: string
  status: PipelineProviderStatus
  attempts: number
  options: JsonObject
  metadata: JsonObject
  result?: JsonObject | undefined
  error?: JsonObject | undefined
  settings?: ProviderSettingsRecord | undefined
}

export type PipelineManifestChildLink = {
  route: ExtractRoute
  index: number
  manifestDir: string
}

export type PipelineManifestItem = {
  input?: string | undefined
  inputFamily?: InputFamily | undefined
  extractRoute?: ExtractRoute | undefined
  outputDir?: string | undefined
  child?: PipelineManifestChildLink | undefined
  status: PipelineItemStatus
  metadata: JsonObject
  providers: PipelineProviderState[]
}

export type PipelineManifest = {
  command: ProcessCommand
  scope: 'single' | 'batch'
  createdAt: string
  updatedAt: string
  source?: JsonObject | undefined
  items: PipelineManifestItem[]
}
