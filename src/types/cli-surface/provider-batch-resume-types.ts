import type { BatchManifestEntry, ProviderCompletionStatus, ProviderIdentity, ProviderResumeEntry, ProviderResumeProcessResult, ResumeTarget, RuntimeOptions } from '~/types'

export type ProviderResumeManifest = {
  infoPath: string
  entries: BatchManifestEntry[]
  source?: Record<string, unknown>
}

export type ProviderResumePassContextInput<TEntry> = {
  target: ResumeTarget
  opts: RuntimeOptions
  parsedEntries: Array<TEntry | undefined>
}

export type ProviderResumeProcessEntryInput<TEntry, TContext> = {
  target: ResumeTarget
  opts: RuntimeOptions
  entry: TEntry
  index: number
  entryCount: number
  providerLabels: string[]
  context: TContext
}

export type ProviderResumeNoMatchingDetailInput<TEntry, TContext> = {
  target: ResumeTarget
  opts: RuntimeOptions
  entry: TEntry
  index: number
  entryCount: number
  context: TContext
}

export type ProviderResumePassHookInput<TContext> = {
  target: ResumeTarget
  opts: RuntimeOptions
  context: TContext
}

export type ProviderResumeMetadataHookInput<TContext> = ProviderResumePassHookInput<TContext> & {
  metadata: BatchManifestEntry
}

export type ProviderResumeResultHookInput<TContext> = ProviderResumePassHookInput<TContext> & {
  result: ProviderResumeProcessResult
}

export type ProviderBatchResumeConfig<
  TTarget extends ProviderIdentity,
  TEntry extends ProviderResumeEntry<TTarget>,
  TContext = undefined
> = {
  stepLabel: string
  parseEntry: (entry: unknown) => Promise<TEntry | undefined>
  readOutputMetadata: (outputDir: string) => Promise<BatchManifestEntry>
  writeBatchManifest: (
    batchDir: string,
    entries: BatchManifestEntry[],
    source?: Record<string, unknown>
  ) => Promise<void>
  writeRunManifest: (
    outputDir: string,
    metadata: Record<string, unknown>
  ) => Promise<void>
  processingDetail?: string
  getProviderLabels: (targets: TTarget[]) => string[]
  processEntry: (
    input: ProviderResumeProcessEntryInput<TEntry, TContext>
  ) => Promise<ProviderResumeProcessResult>
  createPassContext?: (
    input: ProviderResumePassContextInput<TEntry>
  ) => TContext | Promise<TContext>
  formatNoMatchingDetail?: (
    input: ProviderResumeNoMatchingDetailInput<TEntry, TContext>
  ) => string
  normalizeAlreadyFullMetadata?: (metadata: BatchManifestEntry) => BatchManifestEntry
  classifyNoMatchingMetadata?: (metadata: BatchManifestEntry) => ProviderCompletionStatus
  onNoMatchingMetadata?: (input: ProviderResumeMetadataHookInput<TContext>) => void | Promise<void>
  onProcessedResult?: (input: ProviderResumeResultHookInput<TContext>) => void | Promise<void>
  afterPass?: (input: ProviderResumePassHookInput<TContext>) => void | Promise<void>
}
