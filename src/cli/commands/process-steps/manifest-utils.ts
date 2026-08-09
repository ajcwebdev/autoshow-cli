import { isRecord } from '~/utils/rest-client'
import { join } from 'node:path'
import type { BatchManifest, BatchManifestEntry, BatchManifestKind, ExtractBatchManifest, ExtractBatchManifestItem, ExtractRoute, ProviderResult, RunManifest, RunManifestKind } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

export const CURRENT_MANIFEST_VERSION_BY_KIND = {
  run: 3,
  batch: 3,
  'extract-batch': 3,
  'provider-result': 2,
  'provider-checkpoint': 2
} as const

export type VersionedManifestKind = keyof typeof CURRENT_MANIFEST_VERSION_BY_KIND

type VersionedManifestReadBase = {
  manifestPath: string
  supportedVersion: number
}

export type VersionedManifestReadOutcome<T> =
  | VersionedManifestReadBase & { status: 'missing' }
  | VersionedManifestReadBase & { status: 'unsupported-version', foundVersion: unknown }
  | VersionedManifestReadBase & { status: 'invalid', raw: unknown }
  | VersionedManifestReadBase & { status: 'ok', manifest: T }

export const readVersionedManifest = async <T>(
  manifestPath: string,
  manifestKind: VersionedManifestKind,
  parse: (raw: unknown) => T | undefined
): Promise<VersionedManifestReadOutcome<T>> => {
  const supportedVersion = CURRENT_MANIFEST_VERSION_BY_KIND[manifestKind]
  if (!await Bun.file(manifestPath).exists()) {
    return { status: 'missing', manifestPath, supportedVersion }
  }

  // Malformed JSON deliberately remains a thrown parse error rather than being
  // collapsed into an invalid-shape outcome.
  const raw = await Bun.file(manifestPath).json() as unknown
  if (!isRecord(raw) || !Object.hasOwn(raw, 'schemaVersion')) {
    return { status: 'invalid', manifestPath, supportedVersion, raw }
  }

  const foundVersion = raw['schemaVersion']
  if (foundVersion !== supportedVersion) {
    return { status: 'unsupported-version', manifestPath, supportedVersion, foundVersion }
  }

  const manifest = parse(raw)
  return manifest === undefined
    ? { status: 'invalid', manifestPath, supportedVersion, raw }
    : { status: 'ok', manifestPath, supportedVersion, manifest }
}

const formatFoundManifestVersion = (value: unknown): string =>
  typeof value === 'string' ? JSON.stringify(value) : String(value)

export const unsupportedManifestVersionError = (
  outcome: Extract<VersionedManifestReadOutcome<unknown>, { status: 'unsupported-version' }>
): Error => CLIUsageError(
  `Unsupported manifest version at ${outcome.manifestPath}: found schemaVersion ${formatFoundManifestVersion(outcome.foundVersion)}, but this build supports schemaVersion ${outcome.supportedVersion}. Old runs are not resumable with this build — re-run the pipeline.`
)

const unwrapVersionedManifest = <T>(outcome: VersionedManifestReadOutcome<T>): T | undefined =>
  outcome.status === 'ok' ? outcome.manifest : undefined

export type ParsedItemManifest<TManifest extends { items: unknown[] }> = {
  manifestPath: string
  manifest: TManifest
  rawItemCount: number
  firstUnparseableEntryIndex?: number | undefined
}

export const assertManifestEntriesCanBeRewritten = (
  parsed: ParsedItemManifest<{ items: unknown[] }>
): void => {
  if (parsed.manifest.items.length === parsed.rawItemCount) {
    return
  }

  const entryNumber = (parsed.firstUnparseableEntryIndex ?? parsed.manifest.items.length) + 1
  throw CLIUsageError(
    `Refusing to rewrite ${parsed.manifestPath}: manifest entry ${entryNumber} is unparseable by this build. Re-run the pipeline to regenerate this corrupt or foreign manifest.`
  )
}

const parseRunManifest = (
  value: unknown,
  expectedKind?: RunManifestKind
): RunManifest | undefined => {
  if (
    !isRecord(value)
    || typeof value['kind'] !== 'string'
    || !isRecord(value['metadata'])
  ) {
    return undefined
  }

  const kind = value['kind']
  if (
    kind !== 'metadata'
    && kind !== 'download'
    && kind !== 'extract'
    && kind !== 'write'
    && kind !== 'tts'
    && kind !== 'image'
    && kind !== 'video'
    && kind !== 'music'
  ) {
    return undefined
  }

  if (expectedKind !== undefined && kind !== expectedKind) {
    return undefined
  }

  return {
    schemaVersion: CURRENT_MANIFEST_VERSION_BY_KIND.run,
    kind,
    metadata: value['metadata']
  }
}

const parseBatchManifest = (
  value: unknown,
  expectedKind?: BatchManifestKind
): BatchManifest | undefined => {
  if (
    !isRecord(value)
    || typeof value['kind'] !== 'string'
    || !Array.isArray(value['items'])
  ) {
    return undefined
  }

  const kind = value['kind']
  if (
    kind !== 'metadata'
    && kind !== 'download'
    && kind !== 'extract'
    && kind !== 'write'
    && kind !== 'tts'
    && kind !== 'image'
    && kind !== 'video'
    && kind !== 'music'
  ) {
    return undefined
  }

  if (expectedKind !== undefined && kind !== expectedKind) {
    return undefined
  }

  return {
    schemaVersion: CURRENT_MANIFEST_VERSION_BY_KIND.batch,
    kind,
    items: value['items'].filter((entry): entry is Record<string, unknown> => isRecord(entry)),
    ...(isRecord(value['source']) ? { source: value['source'] } : {})
  }
}

export const parseProviderResult = (
  value: unknown,
  options: { lenientMetadata?: boolean } = {}
): ProviderResult | undefined => {
  const metadata = isRecord(value) && isRecord(value['metadata'])
    ? value['metadata']
    : options.lenientMetadata === true
      ? {}
      : undefined
  if (
    !isRecord(value)
    || value['kind'] !== 'provider-result'
    || typeof value['provider'] !== 'string'
    || metadata === undefined
    || !isRecord(value['result'])
  ) {
    return undefined
  }

  return {
    schemaVersion: CURRENT_MANIFEST_VERSION_BY_KIND['provider-result'],
    kind: 'provider-result',
    provider: value['provider'],
    ...(typeof value['model'] === 'string' ? { model: value['model'] } : {}),
    metadata,
    result: value['result']
  }
}

const isInputFamily = (value: unknown): value is ExtractBatchManifestItem['inputFamily'] =>
  value === 'media' || value === 'document' || value === 'html_article' || value === 'x_space' || value === 'unsupported'

const isExtractRoute = (value: unknown): value is ExtractRoute =>
  value === 'media' || value === 'document' || value === 'article' || value === 'x-space'

const isExtractBatchCompletionStatus = (
  value: unknown
): value is ExtractBatchManifestItem['completionStatus'] =>
  value === 'full' || value === 'incomplete' || value === 'failed' || value === 'skipped'

const parseExtractBatchManifestItem = (
  value: unknown
): ExtractBatchManifestItem | undefined => {
  if (
    !isRecord(value)
    || typeof value['input'] !== 'string'
    || !isInputFamily(value['inputFamily'])
    || !isExtractBatchCompletionStatus(value['completionStatus'])
    || (Object.hasOwn(value, 'extractRoute') && !isExtractRoute(value['extractRoute']))
    || (Object.hasOwn(value, 'childBatchEntry') && (
      !isRecord(value['childBatchEntry'])
      || !isExtractRoute(value['childBatchEntry']['route'])
      || typeof value['childBatchEntry']['index'] !== 'number'
      || !Number.isFinite(value['childBatchEntry']['index'])
    ))
  ) {
    return undefined
  }

  const childBatchEntry: ExtractBatchManifestItem['childBatchEntry'] = isRecord(value['childBatchEntry'])
    && isExtractRoute(value['childBatchEntry']['route'])
    && typeof value['childBatchEntry']['index'] === 'number'
    && Number.isFinite(value['childBatchEntry']['index'])
    ? {
        route: value['childBatchEntry']['route'],
        index: value['childBatchEntry']['index']
      }
    : undefined

  return {
    input: value['input'],
    inputFamily: value['inputFamily'],
    ...(isExtractRoute(value['extractRoute']) ? { extractRoute: value['extractRoute'] } : {}),
    ...(childBatchEntry ? { childBatchEntry } : {}),
    completionStatus: value['completionStatus'],
    ...(typeof value['skipReason'] === 'string' ? { skipReason: value['skipReason'] } : {}),
    ...(typeof value['outputDir'] === 'string' ? { outputDir: value['outputDir'] } : {})
  }
}

const parseExtractBatchManifest = (
  value: unknown
): ExtractBatchManifest | undefined => {
  if (
    !isRecord(value)
    || typeof value['createdAt'] !== 'string'
    || !Array.isArray(value['items'])
    || !isRecord(value['childBatches'])
  ) {
    return undefined
  }

  const items = value['items']
    .map(parseExtractBatchManifestItem)
    .filter((entry): entry is ExtractBatchManifestItem => entry !== undefined)

  return {
    schemaVersion: CURRENT_MANIFEST_VERSION_BY_KIND['extract-batch'],
    createdAt: value['createdAt'],
    items,
    childBatches: {
      ...(typeof value['childBatches']['media'] === 'string' ? { media: value['childBatches']['media'] } : {}),
      ...(typeof value['childBatches']['document'] === 'string' ? { document: value['childBatches']['document'] } : {}),
      ...(typeof value['childBatches']['article'] === 'string' ? { article: value['childBatches']['article'] } : {}),
      ...(typeof value['childBatches']['x-space'] === 'string' ? { 'x-space': value['childBatches']['x-space'] } : {})
    }
  }
}

export const writeRunManifest = async (
  outputDir: string,
  kind: RunManifestKind,
  metadata: Record<string, unknown>
): Promise<void> => {
  const manifest: RunManifest = {
    schemaVersion: CURRENT_MANIFEST_VERSION_BY_KIND.run,
    kind,
    metadata
  }
  await Bun.write(join(outputDir, 'run.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

export const readRunManifestEntry = async (
  outputDir: string,
  expectedKind: RunManifestKind
): Promise<Record<string, unknown> | undefined> => {
  return (await readRunManifest(outputDir, expectedKind))?.metadata
}

export const readRunManifest = async (
  outputDir: string,
  expectedKind?: RunManifestKind
): Promise<RunManifest | undefined> => {
  return unwrapVersionedManifest(await readRunManifestOutcome(outputDir, expectedKind))
}

export const readRunManifestOutcome = async (
  outputDir: string,
  expectedKind?: RunManifestKind
): Promise<VersionedManifestReadOutcome<RunManifest>> => {
  const runPath = join(outputDir, 'run.json')
  return await readVersionedManifest(runPath, 'run', (raw) => parseRunManifest(raw, expectedKind))
}

export const writeBatchManifest = async (
  batchDir: string,
  kind: BatchManifestKind,
  items: BatchManifestEntry[],
  source?: Record<string, unknown>
): Promise<void> => {
  const manifest: BatchManifest = {
    schemaVersion: CURRENT_MANIFEST_VERSION_BY_KIND.batch,
    kind,
    items,
    ...(source ? { source } : {})
  }
  await Bun.write(join(batchDir, 'batch.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

export const readBatchManifest = async (
  batchDir: string,
  expectedKind?: BatchManifestKind
): Promise<ParsedItemManifest<BatchManifest> | undefined> => {
  return unwrapVersionedManifest(await readBatchManifestOutcome(batchDir, expectedKind))
}

export const readBatchManifestOutcome = async (
  batchDir: string,
  expectedKind?: BatchManifestKind
): Promise<VersionedManifestReadOutcome<ParsedItemManifest<BatchManifest>>> => {
  const batchPath = join(batchDir, 'batch.json')
  return await readVersionedManifest(batchPath, 'batch', (raw) => {
    const manifest = parseBatchManifest(raw, expectedKind)
    if (!manifest || !isRecord(raw) || !Array.isArray(raw['items'])) {
      return undefined
    }
    const firstUnparseableEntryIndex = raw['items'].findIndex((entry) => !isRecord(entry))
    return {
      manifestPath: batchPath,
      manifest,
      rawItemCount: raw['items'].length,
      ...(firstUnparseableEntryIndex >= 0 ? { firstUnparseableEntryIndex } : {})
    }
  })
}

export const writeExtractBatchManifest = async (
  batchDir: string,
  manifest: ExtractBatchManifest
): Promise<void> => {
  await Bun.write(join(batchDir, 'extract-batch.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

export const readExtractBatchManifest = async (
  batchDir: string
): Promise<ParsedItemManifest<ExtractBatchManifest> | undefined> => {
  return unwrapVersionedManifest(await readExtractBatchManifestOutcome(batchDir))
}

export const readExtractBatchManifestOutcome = async (
  batchDir: string
): Promise<VersionedManifestReadOutcome<ParsedItemManifest<ExtractBatchManifest>>> => {
  const manifestPath = join(batchDir, 'extract-batch.json')
  return await readVersionedManifest(manifestPath, 'extract-batch', (raw) => {
    const manifest = parseExtractBatchManifest(raw)
    if (!manifest || !isRecord(raw) || !Array.isArray(raw['items'])) {
      return undefined
    }
    const firstUnparseableEntryIndex = raw['items'].findIndex((entry) => parseExtractBatchManifestItem(entry) === undefined)
    return {
      manifestPath,
      manifest,
      rawItemCount: raw['items'].length,
      ...(firstUnparseableEntryIndex >= 0 ? { firstUnparseableEntryIndex } : {})
    }
  })
}

export const writeProviderResult = async (
  providerDir: string,
  provider: string,
  model: string | undefined,
  metadata: Record<string, unknown>,
  result: Record<string, unknown>
): Promise<void> => {
  const envelope: ProviderResult = {
    schemaVersion: CURRENT_MANIFEST_VERSION_BY_KIND['provider-result'],
    kind: 'provider-result',
    provider,
    ...(model ? { model } : {}),
    metadata,
    result
  }

  await Bun.write(join(providerDir, 'result.json'), `${JSON.stringify(envelope, null, 2)}\n`)
}

export const readProviderResultEntry = async (
  providerDir: string
): Promise<ProviderResult | undefined> => {
  const resultPath = join(providerDir, 'result.json')
  const outcome = await readVersionedManifest(resultPath, 'provider-result', parseProviderResult)
  if (outcome.status === 'unsupported-version') {
    throw unsupportedManifestVersionError(outcome)
  }
  return unwrapVersionedManifest(outcome)
}
