import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { isRecord } from '~/utils/rest-client'
import { computeLegacySingleRenderIdentity } from '../step-4-tts/script-to-audio/contract-identity'
import { validateComicSourceIdentity } from '../step-8-comic/comic-utils/comic-audio-contracts'
import { aggregateComicStageStatus } from './comic-stage-status'
import type {
  CanonicalComicItemMetadata,
  ComicSourceIdentity,
  PipelineManifest,
  PipelineManifestChildLink,
  PipelineManifestItem,
  PipelineProviderState
} from '~/types'
import {
  canonicalManifestJson,
  hasOnlyKeys,
  hasPersistedKey,
  isExtractRoute,
  isInputFamily,
  isProcessCommand,
  isSafeRelativePath,
  isSha256,
  isStrictArtifactRelativePath,
  ITEM_STATUS_SET,
  PROVIDER_STATUS_SET
} from './guards'
import { parseAudioProjectionStatus } from './audio-projection-structure'

export const parseChildLink = (
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

export const parseProviderState = (
  rootDir: string,
  value: unknown
): PipelineProviderState | undefined => {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ['service', 'model', 'local', 'operation', 'targetKey', 'transport', 'artifactDir', 'status', 'attempts', 'options', 'metadata', 'result', 'error'])
    || typeof value['service'] !== 'string'
    || (value['model'] !== undefined && value['model'] !== null && typeof value['model'] !== 'string')
    || typeof value['artifactDir'] !== 'string'
    || !isSafeRelativePath(rootDir, value['artifactDir'])
    || typeof value['status'] !== 'string'
    || !PROVIDER_STATUS_SET.has(value['status'])
    || typeof value['attempts'] !== 'number'
    || !Number.isInteger(value['attempts'])
    || value['attempts'] < 0
    || !isRecord(value['options'])
    || !isRecord(value['metadata'])
    || (value['result'] !== undefined && !isRecord(value['result']))
    || (value['error'] !== undefined && !isRecord(value['error']))
    || (value['local'] !== undefined && typeof value['local'] !== 'boolean')
  ) {
    return undefined
  }

  const persistedAudioIdentityKeys = ['operation', 'targetKey', 'transport'].filter((key) => hasPersistedKey(value, key))
  if (persistedAudioIdentityKeys.length !== 0 && persistedAudioIdentityKeys.length !== 3) {
    return undefined
  }
  const operation = persistedAudioIdentityKeys.length === 3 ? value['operation'] : undefined
  const targetKey = persistedAudioIdentityKeys.length === 3 ? value['targetKey'] : undefined
  const transport = persistedAudioIdentityKeys.length === 3 ? value['transport'] : undefined
  if (
    persistedAudioIdentityKeys.length === 3
    && (
      typeof operation !== 'string'
      || operation.trim().length === 0
      || typeof targetKey !== 'string'
      || targetKey.trim().length === 0
      || typeof transport !== 'string'
      || transport.trim().length === 0
      || typeof value['model'] !== 'string'
      || targetKey !== canonicalTargetKey(operation, value['service'], value['model'], transport)
    )
  ) {
    return undefined
  }

  if (operation === 'tts-synthesis' || operation === 'comic-audio') {
    const expectedNamespace = operation === 'tts-synthesis' ? 'ttsAudio' : 'comicAudio'
    const forbiddenNamespace = operation === 'tts-synthesis' ? 'comicAudio' : 'ttsAudio'
    const result = value['result']
    const metadata = value['metadata']
    if (
      !isRecord(result)
      || !hasOnlyKeys(result, [expectedNamespace])
      || !isRecord(result[expectedNamespace])
      || result[forbiddenNamespace] !== undefined
      || !isRecord(metadata[expectedNamespace])
      || canonicalManifestJson(result[expectedNamespace]) !== canonicalManifestJson(metadata[expectedNamespace])
      || metadata[forbiddenNamespace] !== undefined
      || typeof targetKey !== 'string'
    ) {
      return undefined
    }
    const projected = parseAudioProjectionStatus(result[expectedNamespace], targetKey)
    if (!projected || projected.status !== value['status'] || projected.attempts !== value['attempts']) {
      return undefined
    }
  } else if (
    (isRecord(value['result']) && (value['result']['ttsAudio'] !== undefined || value['result']['comicAudio'] !== undefined))
    || value['metadata']['ttsAudio'] !== undefined
    || value['metadata']['comicAudio'] !== undefined
  ) {
    return undefined
  }

  return {
    service: value['service'],
    ...(value['model'] === null || typeof value['model'] === 'string' ? { model: value['model'] } : {}),
    ...(typeof value['local'] === 'boolean' ? { local: value['local'] } : {}),
    ...(typeof operation === 'string' ? { operation } : {}),
    ...(typeof targetKey === 'string' ? { targetKey } : {}),
    ...(typeof transport === 'string' ? { transport } : {}),
    artifactDir: value['artifactDir'],
    status: value['status'] as PipelineProviderState['status'],
    attempts: value['attempts'],
    options: value['options'],
    metadata: value['metadata'],
    ...(isRecord(value['result']) ? { result: value['result'] } : {}),
    ...(isRecord(value['error']) ? { error: value['error'] } : {})
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

export const attachLegacyTtsProviderIdentity = (
  item: PipelineManifestItem,
  provider: PipelineProviderState
): void => {
  if (provider.operation !== undefined || provider.targetKey !== undefined || provider.transport !== undefined) return
  const model = typeof provider.model === 'string' ? provider.model : ''
  const operation = 'tts-synthesis'
  const transport = 'legacy-single'
  const targetKey = canonicalTargetKey(operation, provider.service, model, transport)
  const outputByPath = new Map<string, string | 'unverified'>()
  for (const record of [provider.metadata, provider.result]) {
    if (!isRecord(record)) continue
    for (const pathKey of ['audioFileName', 'audioPath', 'outputPath'] as const) {
      const path = record[pathKey]
      if (typeof path !== 'string' || path.length === 0) continue
      const checksum = [
        record[`${pathKey}Sha256`],
        record['audioFileSha256'],
        record['audioSha256'],
        record['sha256'],
        record['checksum']
      ].find(isSha256) ?? 'unverified'
      const current = outputByPath.get(path)
      if (current === undefined || (current === 'unverified' && checksum !== 'unverified')) {
        outputByPath.set(path, checksum)
      }
    }
  }
  const legacyRenderIdentity = computeLegacySingleRenderIdentity({
    itemInput: item.input ?? '',
    targetKey,
    service: provider.service,
    model: provider.model ?? null,
    canonicalLegacyOptions: provider.options,
    artifactDir: provider.artifactDir,
    outputs: [...outputByPath].map(([path, sha256]) => ({ path, sha256 }))
  })
  Object.defineProperties(provider, {
    operation: { value: operation, enumerable: false, configurable: true },
    targetKey: { value: targetKey, enumerable: false, configurable: true },
    transport: { value: transport, enumerable: false, configurable: true },
    legacyRenderIdentity: {
      value: legacyRenderIdentity,
      enumerable: false,
      configurable: true
    }
  })
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

export const parseComicStageRecord = (
  value: unknown,
  providers: readonly PipelineProviderState[],
  operations: readonly string[]
): { requirement: 'not-requested' | 'required' | 'optional', status: PipelineManifestItem['status'] } | undefined => {
  if (!isRecord(value) || !hasOnlyKeys(value, ['requirement', 'status', 'execution', 'targetKeys', 'artifactRefs']) || !ITEM_STATUS_SET.has(value['status'] as string) || !Array.isArray(value['targetKeys']) || !Array.isArray(value['artifactRefs'])) return undefined
  if (value['artifactRefs'].some(ref => !isRecord(ref) || !hasOnlyKeys(ref, ['path', 'sha256']) || !isStrictArtifactRelativePath(ref['path']) || !isSha256(ref['sha256']))) return undefined
  const execution = value['execution']
  if (value['requirement'] === 'not-requested') {
    if (value['status'] !== 'skipped' || !isRecord(execution) || !hasOnlyKeys(execution, ['kind', 'reason']) || execution['kind'] !== 'none' || execution['reason'] !== 'not-requested' || value['targetKeys'].length !== 0 || value['artifactRefs'].length !== 0) return undefined
    return { requirement: 'not-requested', status: 'skipped' }
  }
  if (value['requirement'] !== 'required' && value['requirement'] !== 'optional') return undefined
  if (!isRecord(execution)) return undefined
  if (execution['kind'] === 'local') {
    if (!hasOnlyKeys(execution, ['kind', 'state', 'policyReason']) || !PROVIDER_STATUS_SET.has(execution['state'] as string) || value['targetKeys'].length !== 0) return undefined
    const state = execution['state'] as PipelineProviderState['status']
    const expected = state === 'succeeded' ? 'full' : state === 'skipped' ? 'skipped' : state === 'failed' ? 'failed' : 'incomplete'
    if (value['status'] !== expected || (state === 'skipped' && (typeof execution['policyReason'] !== 'string' || !execution['policyReason'].trim()))) return undefined
  } else if (execution['kind'] === 'provider-targets') {
    if (!hasOnlyKeys(execution, ['kind']) || value['targetKeys'].length === 0 || value['targetKeys'].some(key => typeof key !== 'string') || new Set(value['targetKeys'] as string[]).size !== value['targetKeys'].length) return undefined
    const owned = (value['targetKeys'] as string[]).map(key => providers.filter(provider => provider.targetKey === key && provider.operation !== undefined && operations.includes(provider.operation)))
    if (owned.some(matches => matches.length !== 1)) return undefined
    const statuses = owned.map(matches => (matches[0] as PipelineProviderState).status)
    const successCount = statuses.filter(status => status === 'succeeded').length
    const expected = statuses.every(status => status === 'skipped')
      ? 'skipped'
      : successCount > 0 && statuses.every(status => status === 'succeeded' || status === 'skipped')
        ? 'full'
        : successCount === 0 && statuses.every(status => status === 'failed' || status === 'skipped') && statuses.includes('failed')
          ? 'failed'
          : 'incomplete'
    if (value['status'] !== expected) return undefined
  } else return undefined
  return { requirement: value['requirement'], status: value['status'] as PipelineManifestItem['status'] }
}

export const expectedComicItemStatus = (
  item: PipelineManifestItem
): PipelineManifestItem['status'] | undefined => {
  const metadata = item.metadata['comic']
  if (!isRecord(metadata) || !hasOnlyKeys(metadata, ['schemaVersion', 'stages', 'audio', 'presentation']) || metadata['schemaVersion'] !== 1 || !isRecord(metadata['stages']) || !isRecord(metadata['audio']) || !hasOnlyKeys(metadata['stages'], ['structure', 'image', 'audio', 'presentation'])) return undefined
  const historicalPresentationStage = { requirement: 'not-requested', status: 'skipped', execution: { kind: 'none', reason: 'not-requested' }, targetKeys: [], artifactRefs: [] }
  const stages = [
    parseComicStageRecord(metadata['stages']['structure'], item.providers, ['comic-structure']),
    parseComicStageRecord(metadata['stages']['image'], item.providers, ['comic-image']),
    parseComicStageRecord(metadata['stages']['audio'], item.providers, ['comic-audio', 'sound-effect-generation']),
    parseComicStageRecord(metadata['stages']['presentation'] ?? historicalPresentationStage, item.providers, []),
  ]
  if (stages.some(stage => stage === undefined)) return undefined
  const audio = metadata['audio']
  if (!hasOnlyKeys(audio, ['sceneRunIdentity', 'structuredScript', 'dialoguePlanId', 'dialoguePlanRef', 'snapshotId', 'snapshotRef', 'selectedAudioRuns', 'publishedAudioRunId', 'mixPlanRef', 'finalTimelineRef', 'finalOutputRefs', 'soundscapePlanId', 'soundscapePlanRef', 'soundEffectRenderPlanRef', 'soundEffectRenderResultRef', 'selectedSoundscapeRuns'])) return undefined
  if (audio['sceneRunIdentity'] !== undefined && !isSha256(audio['sceneRunIdentity'])) return undefined
  if (audio['dialoguePlanId'] !== undefined && !isSha256(audio['dialoguePlanId'])) return undefined
  if (audio['snapshotId'] !== undefined && !isSha256(audio['snapshotId'])) return undefined
  if (audio['soundscapePlanId'] !== undefined && !isSha256(audio['soundscapePlanId'])) return undefined
  const structured = audio['structuredScript']
  if (structured !== undefined && (!isRecord(structured) || !hasOnlyKeys(structured, ['path', 'artifactSchemaVersion', 'sha256']) || structured['path'] !== 'metadata/structured-script.json' || structured['artifactSchemaVersion'] !== 5 || !isSha256(structured['sha256']))) return undefined
  for (const key of ['dialoguePlanRef', 'snapshotRef', 'mixPlanRef', 'finalTimelineRef', 'soundscapePlanRef', 'soundEffectRenderPlanRef', 'soundEffectRenderResultRef'] as const) {
    const ref = audio[key]
    if (ref !== undefined && (!isRecord(ref) || !hasOnlyKeys(ref, ['path', 'sha256']) || !isStrictArtifactRelativePath(ref['path']) || !isSha256(ref['sha256']))) return undefined
  }
  if (audio['finalOutputRefs'] !== undefined && (!Array.isArray(audio['finalOutputRefs']) || audio['finalOutputRefs'].some(ref => !isRecord(ref) || !hasOnlyKeys(ref, ['path', 'sha256']) || !isStrictArtifactRelativePath(ref['path']) || !isSha256(ref['sha256'])))) return undefined
  if (audio['selectedAudioRuns'] !== undefined && (!Array.isArray(audio['selectedAudioRuns']) || audio['selectedAudioRuns'].some(ref => !isRecord(ref) || !hasOnlyKeys(ref, ['targetKey', 'renderIdentity', 'audioRunId', 'audioRunRef', 'audioRunSha256']) || !Object.values(ref).every(value => typeof value === 'string') || !isSha256(ref['audioRunSha256'])))) return undefined
  if (audio['selectedSoundscapeRuns'] !== undefined && (!Array.isArray(audio['selectedSoundscapeRuns']) || audio['selectedSoundscapeRuns'].some(ref => {
    if (!isRecord(ref) || !hasOnlyKeys(ref, ['targetKey', 'dialogueAudioRunId', 'soundscapeAudioRunId', 'audioRunRef', 'audioRunSha256', 'masterRef'])) return true
    if (typeof ref['targetKey'] !== 'string' || !isSha256(ref['dialogueAudioRunId']) || !isSha256(ref['soundscapeAudioRunId']) || !isStrictArtifactRelativePath(ref['audioRunRef']) || !isSha256(ref['audioRunSha256'])) return true
    const masterRef = ref['masterRef']
    return !isRecord(masterRef) || !hasOnlyKeys(masterRef, ['path', 'sha256']) || !isStrictArtifactRelativePath(masterRef['path']) || !isSha256(masterRef['sha256'])
  }))) return undefined
  const presentation = metadata['presentation'] ?? {}
  if (!isRecord(presentation) || !hasOnlyKeys(presentation, ['selectedPresentationId', 'planRef', 'resolvedTimelineRef', 'runRef', 'finalOutputRefs'])) return undefined
  if (presentation['selectedPresentationId'] !== undefined && !isSha256(presentation['selectedPresentationId'])) return undefined
  for (const key of ['planRef', 'resolvedTimelineRef', 'runRef'] as const) {
    const ref = presentation[key]
    if (ref !== undefined && (!isRecord(ref) || !hasOnlyKeys(ref, ['path', 'sha256']) || !isStrictArtifactRelativePath(ref['path']) || !isSha256(ref['sha256']))) return undefined
  }
  if (presentation['finalOutputRefs'] !== undefined && (!Array.isArray(presentation['finalOutputRefs']) || presentation['finalOutputRefs'].some(ref => !isRecord(ref) || !hasOnlyKeys(ref, ['path', 'sha256']) || !isStrictArtifactRelativePath(ref['path']) || !isSha256(ref['sha256'])))) return undefined
  const presentationStageValue = metadata['stages']['presentation'] ?? historicalPresentationStage
  if (metadata['presentation'] !== undefined && Object.keys(presentation).length > 0) {
    if (!isRecord(presentationStageValue) || presentationStageValue['status'] !== 'full' || !Array.isArray(presentationStageValue['artifactRefs'])) return undefined
    const stageRefs = presentationStageValue['artifactRefs'] as unknown[]
    const envelopeRefs = [presentation['planRef'], presentation['resolvedTimelineRef'], presentation['runRef'], ...(Array.isArray(presentation['finalOutputRefs']) ? presentation['finalOutputRefs'] : [])]
    if (envelopeRefs.some(ref => !isRecord(ref) || !stageRefs.some(stageRef => isRecord(stageRef) && stageRef['path'] === ref['path'] && stageRef['sha256'] === ref['sha256']))) return undefined
  }
  const required = stages.filter(stage => stage?.requirement === 'required') as Array<{ requirement: 'required', status: PipelineManifestItem['status'] }>
  if (required.length === 0) return undefined
  return aggregateComicStageStatus(required)
}

export const parseManifest = (
  rootDir: string,
  value: unknown,
  allowLegacyTts: boolean
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
      if (!allowLegacyTts && item.providers.some((provider) => provider.operation === undefined)) {
        return undefined
      }
      if (item.providers.some((provider) => provider.operation !== undefined && provider.operation !== 'tts-synthesis')) {
        return undefined
      }
      const expectedStatus = expectedTtsItemStatus(item.providers)
      if (expectedStatus === undefined || item.status !== expectedStatus) return undefined
      for (const provider of item.providers) attachLegacyTtsProviderIdentity(item, provider)
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
