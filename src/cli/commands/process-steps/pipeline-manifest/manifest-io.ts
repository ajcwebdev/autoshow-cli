import { rename, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  ExtractRoute,
  InputFamily,
  ManifestProviderSelector,
  PipelineItemRecord,
  PipelineManifest,
  PipelineManifestChildLink,
  PipelineManifestItem,
  PipelineProviderState,
  ProcessCommand
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import {
  isExtractRoute,
  isInputFamily,
  resolveManifestRelativePath,
  toManifestRelativePath,
  PROVIDER_STATUS_SET
} from './guards'
import {
  expectedTtsItemStatus,
  parseManifest,
  parseManifestItem
} from './manifest-parse'
import { assertAppendOnlyAudioProjection, assertAppendOnlyManifestAudioState } from './audio-projection-structure'
import { verifyManifestProjectionArtifacts } from './projection-artifact-graph'

export const PIPELINE_MANIFEST_FILE = 'manifest.json'

export const invalidManifestError = (manifestPath: string): Error =>
  CLIUsageError(`Invalid canonical manifest at ${manifestPath}. Re-run the pipeline to regenerate this output.`)

export const readManifestUnlocked = async (
  rootDir: string
): Promise<PipelineManifest | undefined> => {
  const manifestPath = join(rootDir, PIPELINE_MANIFEST_FILE)
  if (!await Bun.file(manifestPath).exists()) {
    return undefined
  }

  let raw: unknown
  try {
    raw = await Bun.file(manifestPath).json() as unknown
  } catch (error) {
    throw CLIUsageError(`Malformed canonical manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`, undefined, error instanceof Error ? { cause: error } : {})
  }
  const manifest = parseManifest(rootDir, raw, true)
  if (!manifest || !await verifyManifestProjectionArtifacts(rootDir, manifest)) {
    throw invalidManifestError(manifestPath)
  }
  return manifest
}

export const manifestQueues = new Map<string, Promise<void>>()

export const withManifestLock = async <T>(
  rootDir: string,
  action: () => Promise<T>
): Promise<T> => {
  const key = resolve(rootDir)
  const previous = manifestQueues.get(key) ?? Promise.resolve()
  let release = (): void => {}
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate
  })
  const queued = previous.catch(() => undefined).then(async () => await gate)
  manifestQueues.set(key, queued)
  await previous.catch(() => undefined)
  try {
    return await action()
  } finally {
    release()
    if (manifestQueues.get(key) === queued) {
      manifestQueues.delete(key)
    }
  }
}

export const writeManifestUnlocked = async (
  rootDir: string,
  manifest: PipelineManifest,
  previous?: PipelineManifest | undefined
): Promise<PipelineManifest> => {
  const manifestPath = join(rootDir, PIPELINE_MANIFEST_FILE)
  const next = {
    ...manifest,
    updatedAt: new Date().toISOString()
  }
  const retainsLegacyTts = previous?.command === 'tts'
    && previous.items.some((item) => item.providers.some((provider) =>
      provider.legacyRenderIdentity?.startsWith('legacy:')
    ))
  const parsed = parseManifest(rootDir, next, retainsLegacyTts === true)
  if (!parsed || !await verifyManifestProjectionArtifacts(rootDir, parsed)) {
    throw invalidManifestError(manifestPath)
  }
  if (previous) assertAppendOnlyManifestAudioState(previous, parsed)

  const tempPath = join(rootDir, `.${PIPELINE_MANIFEST_FILE}.${process.pid}.${randomUUID()}.tmp`)
  try {
    await Bun.write(tempPath, `${JSON.stringify(parsed, null, 2)}\n`)
    await rename(tempPath, manifestPath)
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined)
  }
  return parsed
}

export const readManifest = async (
  rootDir: string
): Promise<PipelineManifest | undefined> => await readManifestUnlocked(rootDir)

export const writeManifest = async (
  rootDir: string,
  manifest: PipelineManifest
): Promise<PipelineManifest> =>
  await withManifestLock(rootDir, async () => {
    const current = await readManifestUnlocked(rootDir)
    return await writeManifestUnlocked(rootDir, manifest, current)
  })

export const updateManifest = async (
  rootDir: string,
  update: (manifest: PipelineManifest) => PipelineManifest | Promise<PipelineManifest>
): Promise<PipelineManifest> =>
  await withManifestLock(rootDir, async () => {
    const current = await readManifestUnlocked(rootDir)
    if (!current) {
      throw CLIUsageError(`Missing canonical manifest at ${join(rootDir, PIPELINE_MANIFEST_FILE)}`)
    }
    return await writeManifestUnlocked(rootDir, await update(current), current)
  })

export const createManifest = (
  command: ProcessCommand,
  scope: PipelineManifest['scope'],
  items: PipelineManifestItem[],
  source?: Record<string, unknown>
): PipelineManifest => {
  const now = new Date().toISOString()
  return {
    command,
    scope,
    createdAt: now,
    updatedAt: now,
    ...(source ? { source } : {}),
    items
  }
}

export const createManifestItem = (
  rootDir: string,
  input: Omit<PipelineManifestItem, 'outputDir' | 'child' | 'providers'> & {
    outputDir?: string | undefined
    child?: Omit<PipelineManifestChildLink, 'manifestDir'> & { manifestDir: string } | undefined
    providers?: PipelineProviderState[] | undefined
  }
): PipelineManifestItem => {
  const item: PipelineManifestItem = {
    ...(input.input !== undefined ? { input: input.input } : {}),
    ...(input.inputFamily !== undefined ? { inputFamily: input.inputFamily } : {}),
    ...(input.extractRoute !== undefined ? { extractRoute: input.extractRoute } : {}),
    ...(input.outputDir !== undefined ? { outputDir: toManifestRelativePath(rootDir, input.outputDir) } : {}),
    ...(input.child
      ? {
          child: {
            route: input.child.route,
            index: input.child.index,
            manifestDir: toManifestRelativePath(rootDir, input.child.manifestDir)
          }
        }
      : {}),
    status: input.status,
    metadata: input.metadata,
    providers: (input.providers ?? []).map((provider) => ({
      ...provider,
      artifactDir: toManifestRelativePath(rootDir, provider.artifactDir)
    }))
  }
  const parsed = parseManifestItem(rootDir, item)
  if (!parsed) {
    throw CLIUsageError('Cannot construct an invalid canonical manifest item.')
  }
  return parsed
}

const providerKey = (value: Record<string, unknown>): string | undefined =>
  typeof value['targetKey'] === 'string'
    ? `target\u0000${value['targetKey']}`
    : typeof value['service'] === 'string'
      ? `${value['service']}\u0000${typeof value['model'] === 'string' ? value['model'] : ''}`
    : undefined

const providerOptions = (value: Record<string, unknown>): Record<string, unknown> => {
  const options = { ...value }
  delete options['service']
  delete options['model']
  delete options['local']
  delete options['operation']
  delete options['targetKey']
  delete options['transport']
  delete options['artifactDir']
  delete options['status']
  delete options['attempts']
  delete options['lastError']
  delete options['error']
  delete options['metadata']
  delete options['result']
  return options
}

const findProviderMetadata = (
  record: Record<string, unknown>,
  service: string,
  model: string | null | undefined
): Record<string, unknown> | undefined => {
  const rawStep2 = record['step2']
  const entries = (Array.isArray(rawStep2) ? rawStep2 : rawStep2 === undefined ? [] : [rawStep2])
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
  return entries.find((entry) =>
    (entry['transcriptionService'] === service && (model == null || entry['transcriptionModel'] === model))
    || (entry['ocrService'] === service && (model == null || entry['ocrModel'] === model))
    || (entry['service'] === service && (model == null || entry['model'] === model))
    || (typeof entry['extractionMethod'] === 'string' && entry['extractionMethod'] === `html+${service}`)
  )
}

const createProviderStatesFromRecord = (
  rootDir: string,
  record: Record<string, unknown>
): PipelineProviderState[] => {
  const requested = Array.isArray(record['requestedProviders'])
    ? record['requestedProviders'].filter((value): value is Record<string, unknown> => isRecord(value))
    : []
  const requestedEntries = requested.flatMap((value) => {
    const key = providerKey(value)
    return key ? [[key, value] as const] : []
  })
  const requestedByKey = new Map(requestedEntries)
  if (requestedByKey.size !== requestedEntries.length) {
    throw CLIUsageError('Requested provider targets must be unique before canonical persistence.')
  }
  const rawStates = Array.isArray(record['providerStates'])
    ? record['providerStates'].filter((value): value is Record<string, unknown> => isRecord(value))
    : []
  const statesByKey = new Set<string>()
  const states = rawStates.map((state): PipelineProviderState => {
    const key = providerKey(state)
    if (!key || typeof state['service'] !== 'string') {
      throw CLIUsageError('Cannot persist a provider state without a service identity.')
    }
    if (statesByKey.has(key)) {
      throw CLIUsageError('Canonical provider states cannot duplicate one requested target.')
    }
    statesByKey.add(key)
    const request = requestedByKey.get(key)
    if (requested.length > 0 && !request) {
      throw CLIUsageError('Canonical provider states must contain only explicitly requested targets.')
    }
    const status = typeof state['status'] === 'string' && PROVIDER_STATUS_SET.has(state['status'])
      ? state['status'] as PipelineProviderState['status']
      : 'missing'
    const artifactDir = typeof state['artifactDir'] === 'string' ? state['artifactDir'] : '.'
    return {
      service: state['service'],
      ...(typeof state['model'] === 'string' || state['model'] === null ? { model: state['model'] } : {}),
      ...(typeof state['local'] === 'boolean' ? { local: state['local'] } : {}),
      ...(typeof state['operation'] === 'string' ? { operation: state['operation'] } : {}),
      ...(typeof state['targetKey'] === 'string' ? { targetKey: state['targetKey'] } : {}),
      ...(typeof state['transport'] === 'string' ? { transport: state['transport'] } : {}),
      artifactDir: toManifestRelativePath(rootDir, artifactDir),
      status,
      attempts: typeof state['attempts'] === 'number' && Number.isInteger(state['attempts']) && state['attempts'] >= 0
        ? state['attempts']
        : 0,
      options: isRecord(state['options'])
        ? state['options']
        : request
          ? providerOptions(request)
          : {},
      metadata: isRecord(state['metadata'])
        ? state['metadata']
        : findProviderMetadata(record, state['service'], typeof state['model'] === 'string' || state['model'] === null ? state['model'] : undefined) ?? {},
      ...(isRecord(state['result']) ? { result: state['result'] } : {}),
      ...(isRecord(state['error'])
        ? { error: state['error'] }
        : isRecord(state['lastError'])
          ? { error: state['lastError'] }
          : {})
    }
  })

  for (const request of requested) {
    const key = providerKey(request)
    if (!key || statesByKey.has(key) || typeof request['service'] !== 'string') {
      continue
    }
    if (request['operation'] === 'tts-synthesis' || request['operation'] === 'comic-audio') {
      throw CLIUsageError('A requested audio target requires its real durable canonical provider state before persistence.')
    }
    states.push({
      service: request['service'],
      ...(typeof request['model'] === 'string' || request['model'] === null ? { model: request['model'] } : {}),
      ...(typeof request['local'] === 'boolean' ? { local: request['local'] } : {}),
      ...(typeof request['operation'] === 'string' ? { operation: request['operation'] } : {}),
      ...(typeof request['targetKey'] === 'string' ? { targetKey: request['targetKey'] } : {}),
      ...(typeof request['transport'] === 'string' ? { transport: request['transport'] } : {}),
      artifactDir: '.',
      status: 'missing',
      attempts: 0,
      options: providerOptions(request),
      metadata: {}
    })
  }
  return states
}

export const createPipelineItemFromRecord = (
  rootDir: string,
  record: PipelineItemRecord,
  options: {
    status?: PipelineManifestItem['status'] | undefined
    input?: string | undefined
    inputFamily?: InputFamily | undefined
    extractRoute?: ExtractRoute | undefined
    outputDir?: string | undefined
    child?: PipelineManifestChildLink | undefined
  } = {}
): PipelineManifestItem => {
  const metadata = { ...record }
  for (const key of [
    'input',
    'inputFamily',
    'extractRoute',
    'outputDir',
    'childBatchEntry',
    'completionStatus',
    'status',
    'requestedProviders',
    'providerStates',
    'missingProviders',
    'blockedProviders'
  ]) {
    delete metadata[key]
  }
  const providers = createProviderStatesFromRecord(rootDir, record)
  if (providers.length > 0 && record['ocrProviderMode'] !== 'pool') {
    delete metadata['step2']
  }

  const storedStatus = record['completionStatus'] === 'full'
    || record['completionStatus'] === 'incomplete'
    || record['completionStatus'] === 'failed'
    || record['completionStatus'] === 'skipped'
    ? record['completionStatus']
    : record['status'] === 'failed'
      ? 'failed'
      : record['status'] === 'completed'
        ? 'full'
        : undefined
  const child = options.child
  const rawInputFamily = options.inputFamily ?? record['inputFamily']
  const rawRoute = options.extractRoute ?? record['extractRoute']
  return createManifestItem(rootDir, {
    ...(options.input !== undefined
      ? { input: options.input }
      : typeof record['input'] === 'string'
        ? { input: record['input'] }
        : {}),
    ...(isInputFamily(rawInputFamily) ? { inputFamily: rawInputFamily } : {}),
    ...(isExtractRoute(rawRoute) ? { extractRoute: rawRoute } : {}),
    ...(options.outputDir !== undefined
      ? { outputDir: options.outputDir }
      : typeof record['outputDir'] === 'string'
        ? { outputDir: record['outputDir'] }
        : {}),
    ...(child ? { child } : {}),
    status: options.status ?? storedStatus ?? 'incomplete',
    metadata,
    providers
  })
}

export const derivePipelineItemRecord = (
  rootDir: string,
  item: PipelineManifestItem
): PipelineItemRecord => {
  const requestedProviders = item.providers.map((provider) => ({
    service: provider.service,
    ...(provider.model !== undefined ? { model: provider.model } : {}),
    ...(provider.local !== undefined ? { local: provider.local } : {}),
    ...(provider.operation !== undefined ? { operation: provider.operation } : {}),
    ...(provider.targetKey !== undefined ? { targetKey: provider.targetKey } : {}),
    ...(provider.transport !== undefined ? { transport: provider.transport } : {}),
    ...provider.options
  }))
  const providerStates = item.providers.map((provider) => ({
    service: provider.service,
    ...(provider.model !== undefined ? { model: provider.model } : {}),
    ...(provider.local !== undefined ? { local: provider.local } : {}),
    ...(provider.operation !== undefined ? { operation: provider.operation } : {}),
    ...(provider.targetKey !== undefined ? { targetKey: provider.targetKey } : {}),
    ...(provider.transport !== undefined ? { transport: provider.transport } : {}),
    artifactDir: provider.artifactDir,
    status: provider.status,
    attempts: provider.attempts,
    options: provider.options,
    metadata: provider.metadata,
    ...(provider.result ? { result: provider.result } : {}),
    ...(provider.error ? { lastError: provider.error } : {})
  }))
  const missingProviders = requestedProviders.filter((_, index) => {
    const status = item.providers[index]?.status
    return status === 'missing' || status === 'failed'
  })
  const blockedProviders = requestedProviders.filter((_, index) => {
    const error = item.providers[index]?.error
    return error?.['retryable'] === false || typeof error?.['blockedReason'] === 'string'
  })
  const successfulMetadata = item.providers
    .filter((provider) => provider.status === 'succeeded' && Object.keys(provider.metadata).length > 0)
    .map((provider) => provider.metadata)

  return {
    ...item.metadata,
    ...(item.input !== undefined ? { input: item.input } : {}),
    ...(item.inputFamily !== undefined ? { inputFamily: item.inputFamily } : {}),
    ...(item.extractRoute !== undefined ? { extractRoute: item.extractRoute } : {}),
    ...(successfulMetadata.length === 1
      ? { step2: successfulMetadata[0] }
      : successfulMetadata.length > 1
        ? { step2: successfulMetadata }
        : {}),
    outputDir: item.outputDir !== undefined
      ? resolveManifestRelativePath(rootDir, item.outputDir)
      : resolve(rootDir),
    ...(item.child ? { childBatchEntry: { route: item.child.route, index: item.child.index } } : {}),
    completionStatus: item.status,
    requestedProviders,
    providerStates,
    missingProviders,
    blockedProviders
  }
}

export const readSinglePipelineItemRecord = async (
  rootDir: string,
  expected: {
    command?: ProcessCommand | undefined
    extractRoute?: ExtractRoute | undefined
  } = {}
): Promise<PipelineItemRecord | undefined> => {
  const manifest = await readManifest(rootDir)
  if (
    !manifest
    || manifest.scope !== 'single'
    || manifest.items.length !== 1
    || (expected.command !== undefined && manifest.command !== expected.command)
  ) {
    return undefined
  }
  const item = manifest.items[0]
  if (!item || (expected.extractRoute !== undefined && item.extractRoute !== expected.extractRoute)) {
    return undefined
  }
  return derivePipelineItemRecord(rootDir, item)
}

const matchesManifestProvider = (
  rootDir: string,
  provider: PipelineProviderState,
  selector: ManifestProviderSelector
): boolean =>
  provider.service === selector.service
  && (!Object.hasOwn(selector, 'model') || provider.model === selector.model)
  && (selector.operation === undefined || provider.operation === selector.operation)
  && (selector.targetKey === undefined || provider.targetKey === selector.targetKey)
  && (selector.transport === undefined || provider.transport === selector.transport)
  && (selector.artifactDir === undefined
    || provider.artifactDir === toManifestRelativePath(rootDir, selector.artifactDir))

export const readSingleManifestProviderState = async (
  rootDir: string,
  selector: ManifestProviderSelector
): Promise<PipelineProviderState | undefined> => {
  const manifest = await readManifest(rootDir)
  if (!manifest || manifest.scope !== 'single' || manifest.items.length !== 1) {
    return undefined
  }
  return manifest.items[0]?.providers.find((provider) =>
    matchesManifestProvider(rootDir, provider, selector)
  )
}

export const updateSingleManifestProviderState = async (
  rootDir: string,
  selector: ManifestProviderSelector,
  update: (provider: PipelineProviderState) => PipelineProviderState | Promise<PipelineProviderState>
): Promise<PipelineProviderState> => {
  let updatedProvider: PipelineProviderState | undefined
  await updateManifest(rootDir, async (manifest) => {
    if (manifest.scope !== 'single' || manifest.items.length !== 1) {
      throw CLIUsageError(`Canonical manifest at ${join(rootDir, PIPELINE_MANIFEST_FILE)} is not a single-run manifest.`)
    }
    const item = manifest.items[0]
    if (!item) {
      throw invalidManifestError(join(rootDir, PIPELINE_MANIFEST_FILE))
    }
    const providerIndex = item.providers.findIndex((provider) =>
      matchesManifestProvider(rootDir, provider, selector)
    )
    const provider = item.providers[providerIndex]
    if (!provider) {
      throw CLIUsageError(`Canonical manifest at ${join(rootDir, PIPELINE_MANIFEST_FILE)} has no matching ${selector.service} provider state.`)
    }
    const nextProvider = await update(provider)
    if (!matchesManifestProvider(rootDir, nextProvider, selector)) {
      throw CLIUsageError('A manifest provider-state update cannot change the selected provider identity or artifact path.')
    }
    assertAppendOnlyAudioProjection(provider, nextProvider)
    updatedProvider = nextProvider
    const providers = item.providers.slice()
    providers[providerIndex] = nextProvider
    const items = manifest.items.slice()
    const reducedTtsStatus = manifest.command === 'tts' ? expectedTtsItemStatus(providers) : undefined
    if (manifest.command === 'tts' && reducedTtsStatus === undefined) {
      throw CLIUsageError('A requested TTS item must retain at least one canonical provider state.')
    }
    items[0] = { ...item, providers, ...(reducedTtsStatus ? { status: reducedTtsStatus } : {}) }
    return { ...manifest, items }
  })
  if (!updatedProvider) {
    throw CLIUsageError(`Canonical manifest at ${join(rootDir, PIPELINE_MANIFEST_FILE)} was not updated.`)
  }
  return updatedProvider
}

export const writePipelineItemRecords = async (
  rootDir: string,
  command: ProcessCommand,
  scope: PipelineManifest['scope'],
  records: PipelineItemRecord[],
  options: {
    extractRoute?: ExtractRoute | undefined
    source?: Record<string, unknown> | undefined
  } = {}
): Promise<PipelineManifest> => {
  if (scope === 'single' && records.length !== 1) {
    throw CLIUsageError('A single-run canonical manifest must contain exactly one item record.')
  }
  const current = await readManifest(rootDir)
  const next = createManifest(
    command,
    scope,
    records.map((record) => createPipelineItemFromRecord(rootDir, record, {
      ...(options.extractRoute ? { extractRoute: options.extractRoute } : {}),
      ...(scope === 'single' ? { outputDir: rootDir } : {})
    })),
    options.source
  )
  return await writeManifest(rootDir, {
    ...next,
    ...(current ? { createdAt: current.createdAt } : {})
  })
}
