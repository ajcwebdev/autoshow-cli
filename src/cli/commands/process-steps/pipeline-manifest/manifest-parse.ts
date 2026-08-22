import { isRecord } from '~/utils/rest-client'
import { validateComicSourceIdentity } from '../step-8-comic/comic-utils/comic-audio-contracts'
import type {
  CanonicalComicItemMetadata,
  ComicSourceIdentity,
  PipelineManifest,
  PipelineManifestChildLink,
  PipelineManifestItem,
  PipelineProviderState
} from '~/types'
import {
  hasOnlyKeys,
  isExtractRoute,
  isInputFamily,
  isProcessCommand,
  isSafeRelativePath,
  ITEM_STATUS_SET,
} from './guards'
import { expectedComicItemStatus } from './comic-metadata-status-parser'
import { parseProviderState } from './provider-state-parser'

const parseChildLink = (
  rootDir: string,
  value: unknown
): PipelineManifestChildLink | undefined => {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ['route', 'index', 'manifestDir'])
    || !isExtractRoute(value['route'])
    || typeof value['index'] !== 'number'
    || !Number.isInteger(value['index'])
    || value['index'] < 0
    || typeof value['manifestDir'] !== 'string'
    || !isSafeRelativePath(rootDir, value['manifestDir'])
  ) {
    return undefined
  }
  return {
    route: value['route'],
    index: value['index'],
    manifestDir: value['manifestDir']
  }
}

 export const parseManifestItem = (
  rootDir: string,
  value: unknown
): PipelineManifestItem | undefined => {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ['input', 'inputFamily', 'extractRoute', 'outputDir', 'child', 'status', 'metadata', 'providers'])
    || typeof value['status'] !== 'string'
    || !ITEM_STATUS_SET.has(value['status'])
    || !isRecord(value['metadata'])
    || !Array.isArray(value['providers'])
    || (value['input'] !== undefined && typeof value['input'] !== 'string')
    || (value['inputFamily'] !== undefined && !isInputFamily(value['inputFamily']))
    || (value['extractRoute'] !== undefined && !isExtractRoute(value['extractRoute']))
    || (value['outputDir'] !== undefined && (
      typeof value['outputDir'] !== 'string'
      || !isSafeRelativePath(rootDir, value['outputDir'])
    ))
    || (value['child'] !== undefined && parseChildLink(rootDir, value['child']) === undefined)
  ) {
    return undefined
  }
  const providers = value['providers'].map((provider) => parseProviderState(rootDir, provider))
  if (providers.some((provider) => provider === undefined)) {
    return undefined
  }

  const targetKeys = providers.flatMap((provider) => provider?.targetKey ? [provider.targetKey] : [])
  if (new Set(targetKeys).size !== targetKeys.length) {
    return undefined
  }
  const audioArtifactDirs = providers.flatMap((provider) => provider?.targetKey ? [provider.artifactDir] : [])
  if (new Set(audioArtifactDirs).size !== audioArtifactDirs.length) {
    return undefined
  }

  if (
    value['status'] === 'full'
    && providers.some((provider) => provider?.status !== 'succeeded' && provider?.status !== 'skipped')
  ) {
    return undefined
  }

  const child = value['child'] === undefined ? undefined : parseChildLink(rootDir, value['child'])
  return {
    ...(typeof value['input'] === 'string' ? { input: value['input'] } : {}),
    ...(isInputFamily(value['inputFamily']) ? { inputFamily: value['inputFamily'] } : {}),
    ...(isExtractRoute(value['extractRoute']) ? { extractRoute: value['extractRoute'] } : {}),
    ...(typeof value['outputDir'] === 'string' ? { outputDir: value['outputDir'] } : {}),
    ...(child ? { child } : {}),
    status: value['status'] as PipelineManifestItem['status'],
    metadata: value['metadata'],
    providers: providers as PipelineProviderState[]
  }
}

export const expectedTtsItemStatus = (providers: readonly PipelineProviderState[]): PipelineManifestItem['status'] | undefined => {
  if (providers.length === 0) return undefined
  const statuses = providers.map((provider) => provider.status)
  const successCount = statuses.filter((status) => status === 'succeeded').length
  if (statuses.every((status) => status === 'skipped')) return 'skipped'
  if (successCount > 0 && statuses.every((status) => status === 'succeeded' || status === 'skipped')) return 'full'
  if (successCount === 0 && statuses.every((status) => status === 'failed' || status === 'skipped') && statuses.includes('failed')) return 'failed'
  return 'incomplete'
}

 export const parseManifest = (
  rootDir: string,
  value: unknown
): PipelineManifest | undefined => {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ['command', 'scope', 'createdAt', 'updatedAt', 'source', 'items'])
    || !isProcessCommand(value['command'])
    || (value['scope'] !== 'single' && value['scope'] !== 'batch')
    || typeof value['createdAt'] !== 'string'
    || typeof value['updatedAt'] !== 'string'
    || Number.isNaN(Date.parse(value['createdAt']))
    || Number.isNaN(Date.parse(value['updatedAt']))
    || (value['source'] !== undefined && !isRecord(value['source']))
    || !Array.isArray(value['items'])
    || value['items'].length === 0
  ) {
    return undefined
  }

  const items = value['items'].map((item) => parseManifestItem(rootDir, item))
  if (
    items.some((item) => item === undefined)
    || (value['scope'] === 'single' && items.length !== 1)
    || items.some((item) => item?.child !== undefined && (
      value['scope'] !== 'batch'
      || value['command'] !== 'extract'
      || item.extractRoute !== item.child.route
    ))
  ) {
    return undefined
  }

  if (value['scope'] === 'batch') {
    const audioArtifactDirs = items.flatMap((item) => item?.providers.flatMap((provider) =>
      provider.operation === 'tts-synthesis' || provider.operation === 'comic-audio'
        ? [provider.artifactDir]
        : []
    ) ?? [])
    if (new Set(audioArtifactDirs).size !== audioArtifactDirs.length) return undefined
  }

  if (value['command'] === 'tts') {
    for (const item of items) {
      if (!item) return undefined
      if (item.providers.some((provider) => provider.operation === undefined)) {
        return undefined
      }
      if (item.providers.some((provider) => provider.operation !== undefined && provider.operation !== 'tts-synthesis')) {
        return undefined
      }
      const expectedStatus = expectedTtsItemStatus(item.providers)
      if (expectedStatus === undefined || item.status !== expectedStatus) return undefined
    }
  }

  if (value['command'] === 'comic') {
    if (value['scope'] !== 'single' || items.length !== 1 || !isRecord(value['source'])) return undefined
    try {
      validateComicSourceIdentity(value['source'] as unknown as ComicSourceIdentity)
    } catch {
      return undefined
    }
    const item = items[0]
    if (!item || item.input !== value['source']['canonicalPath'] || item.outputDir !== '.') return undefined
    const expectedStatus = expectedComicItemStatus(item)
    if (!expectedStatus || item.status !== expectedStatus) return undefined
    const targetOwners = new Map<string, number>()
    const comic = item.metadata['comic'] as unknown as CanonicalComicItemMetadata
    comic.stages.presentation ??= { requirement: 'not-requested', status: 'skipped', execution: { kind: 'none', reason: 'not-requested' }, targetKeys: [], artifactRefs: [] }
    comic.presentation ??= {}
    for (const stage of Object.values(comic.stages)) for (const targetKey of stage.targetKeys) targetOwners.set(targetKey, (targetOwners.get(targetKey) ?? 0) + 1)
    if ([...targetOwners.values()].some(count => count !== 1)) return undefined
    if (item.providers.some(provider => provider.operation?.startsWith('comic-') && !targetOwners.has(provider.targetKey ?? ''))) return undefined
  }

  return {
    command: value['command'],
    scope: value['scope'],
    createdAt: value['createdAt'],
    updatedAt: value['updatedAt'],
    ...(isRecord(value['source']) ? { source: value['source'] } : {}),
    items: items as PipelineManifestItem[]
  }
}
