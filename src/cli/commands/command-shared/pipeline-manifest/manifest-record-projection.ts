import { resolve } from 'node:path'
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
import { UsageError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import {
  isExtractRoute,
  isInputFamily,
  PROVIDER_STATUS_SET,
  resolveManifestRelativePath,
  toManifestRelativePath
} from './guards'
import {
  parseManifestItem
} from './manifest-parse'

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
    throw UsageError('Cannot construct an invalid canonical manifest item.')
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
    throw UsageError('Requested provider targets must be unique before canonical persistence.')
  }
  const rawStates = Array.isArray(record['providerStates'])
    ? record['providerStates'].filter((value): value is Record<string, unknown> => isRecord(value))
    : []
  const statesByKey = new Set<string>()
  const states = rawStates.map((state): PipelineProviderState => {
    const key = providerKey(state)
    if (!key || typeof state['service'] !== 'string') {
      throw UsageError('Cannot persist a provider state without a service identity.')
    }
    if (statesByKey.has(key)) {
      throw UsageError('Canonical provider states cannot duplicate one requested target.')
    }
    statesByKey.add(key)
    const request = requestedByKey.get(key)
    if (requested.length > 0 && !request) {
      throw UsageError('Canonical provider states must contain only explicitly requested targets.')
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
        : {})
    }
  })

  for (const request of requested) {
    const key = providerKey(request)
    if (!key || statesByKey.has(key) || typeof request['service'] !== 'string') {
      continue
    }
    if (request['operation'] === 'tts-synthesis' || request['operation'] === 'comic-audio') {
      throw UsageError('A requested audio target requires its real durable canonical provider state before persistence.')
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
    ...(provider.error ? { error: provider.error } : {})
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

export const matchesManifestProvider = (
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
