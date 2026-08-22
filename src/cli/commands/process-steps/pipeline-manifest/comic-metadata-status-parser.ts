import type { PipelineManifestItem, PipelineProviderState } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { aggregateComicStageStatus } from './comic-stage-status'
import { hasOnlyKeys, isSha256, isStrictArtifactRelativePath, ITEM_STATUS_SET, PROVIDER_STATUS_SET } from './guards'

type ComicStage = {
  requirement: 'not-requested' | 'required' | 'optional'
  status: PipelineManifestItem['status']
}

const isArtifactRef = (value: unknown): value is Record<string, unknown> =>
  isRecord(value)
  && hasOnlyKeys(value, ['path', 'sha256'])
  && isStrictArtifactRelativePath(value['path'])
  && isSha256(value['sha256'])

const isArtifactRefList = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.every(isArtifactRef)

const providerTargetStageStatus = (
  targetKeys: string[],
  providers: readonly PipelineProviderState[],
  operations: readonly string[]
): PipelineManifestItem['status'] | undefined => {
  const owned = targetKeys.map(key => providers.filter(provider => provider.targetKey === key && provider.operation !== undefined && operations.includes(provider.operation)))
  if (owned.some(matches => matches.length !== 1)) return undefined
  const statuses = owned.map(matches => (matches[0] as PipelineProviderState).status)
  const successCount = statuses.filter(status => status === 'succeeded').length
  if (statuses.every(status => status === 'skipped')) return 'skipped'
  if (successCount > 0 && statuses.every(status => status === 'succeeded' || status === 'skipped')) return 'full'
  if (successCount === 0 && statuses.every(status => status === 'failed' || status === 'skipped') && statuses.includes('failed')) return 'failed'
  return 'incomplete'
}

const parseComicStageRecord = (
  value: unknown,
  providers: readonly PipelineProviderState[],
  operations: readonly string[]
): ComicStage | undefined => {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ['requirement', 'status', 'execution', 'targetKeys', 'artifactRefs'])
    || !ITEM_STATUS_SET.has(value['status'] as string)
    || !Array.isArray(value['targetKeys'])
    || !isArtifactRefList(value['artifactRefs'])
  ) return undefined
  const execution = value['execution']
  if (value['requirement'] === 'not-requested') {
    if (
      value['status'] !== 'skipped'
      || !isRecord(execution)
      || !hasOnlyKeys(execution, ['kind', 'reason'])
      || execution['kind'] !== 'none'
      || execution['reason'] !== 'not-requested'
      || value['targetKeys'].length !== 0
      || value['artifactRefs'].length !== 0
    ) return undefined
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
    if (
      !hasOnlyKeys(execution, ['kind'])
      || value['targetKeys'].length === 0
      || value['targetKeys'].some(key => typeof key !== 'string')
      || new Set(value['targetKeys'] as string[]).size !== value['targetKeys'].length
    ) return undefined
    const expected = providerTargetStageStatus(value['targetKeys'] as string[], providers, operations)
    if (expected === undefined || value['status'] !== expected) return undefined
  } else return undefined
  return { requirement: value['requirement'], status: value['status'] as PipelineManifestItem['status'] }
}

const validatesOptionalArtifactRef = (envelope: Record<string, unknown>, key: string): boolean =>
  envelope[key] === undefined || isArtifactRef(envelope[key])

const parseAudioEnvelope = (value: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(value) || !hasOnlyKeys(value, ['sceneRunIdentity', 'structuredScript', 'dialoguePlanId', 'dialoguePlanRef', 'snapshotId', 'snapshotRef', 'selectedAudioRuns', 'publishedAudioRunId', 'mixPlanRef', 'finalTimelineRef', 'finalOutputRefs', 'soundscapePlanId', 'soundscapePlanRef', 'soundEffectRenderPlanRef', 'soundEffectRenderResultRef', 'selectedSoundscapeRuns'])) return undefined
  for (const key of ['sceneRunIdentity', 'dialoguePlanId', 'snapshotId', 'soundscapePlanId'] as const) {
    if (value[key] !== undefined && !isSha256(value[key])) return undefined
  }
  const structured = value['structuredScript']
  if (structured !== undefined && (!isRecord(structured) || !hasOnlyKeys(structured, ['path', 'artifactSchemaVersion', 'sha256']) || structured['path'] !== 'metadata/structured-script.json' || structured['artifactSchemaVersion'] !== 5 || !isSha256(structured['sha256']))) return undefined
  for (const key of ['dialoguePlanRef', 'snapshotRef', 'mixPlanRef', 'finalTimelineRef', 'soundscapePlanRef', 'soundEffectRenderPlanRef', 'soundEffectRenderResultRef'] as const) {
    if (!validatesOptionalArtifactRef(value, key)) return undefined
  }
  if (value['finalOutputRefs'] !== undefined && !isArtifactRefList(value['finalOutputRefs'])) return undefined
  if (value['selectedAudioRuns'] !== undefined && (!Array.isArray(value['selectedAudioRuns']) || value['selectedAudioRuns'].some(ref => !isRecord(ref) || !hasOnlyKeys(ref, ['targetKey', 'renderIdentity', 'audioRunId', 'audioRunRef', 'audioRunSha256']) || !Object.values(ref).every(field => typeof field === 'string') || !isSha256(ref['audioRunSha256'])))) return undefined
  if (value['selectedSoundscapeRuns'] !== undefined && (!Array.isArray(value['selectedSoundscapeRuns']) || value['selectedSoundscapeRuns'].some(ref => {
    if (!isRecord(ref) || !hasOnlyKeys(ref, ['targetKey', 'dialogueAudioRunId', 'soundscapeAudioRunId', 'audioRunRef', 'audioRunSha256', 'masterRef'])) return true
    if (typeof ref['targetKey'] !== 'string' || !isSha256(ref['dialogueAudioRunId']) || !isSha256(ref['soundscapeAudioRunId']) || !isStrictArtifactRelativePath(ref['audioRunRef']) || !isSha256(ref['audioRunSha256'])) return true
    return !isArtifactRef(ref['masterRef'])
  }))) return undefined
  return value
}

const parsePresentationEnvelope = (value: unknown): Record<string, unknown> | undefined => {
  const presentation = value ?? {}
  if (!isRecord(presentation) || !hasOnlyKeys(presentation, ['selectedPresentationId', 'planRef', 'resolvedTimelineRef', 'runRef', 'finalOutputRefs'])) return undefined
  if (presentation['selectedPresentationId'] !== undefined && !isSha256(presentation['selectedPresentationId'])) return undefined
  for (const key of ['planRef', 'resolvedTimelineRef', 'runRef'] as const) {
    if (!validatesOptionalArtifactRef(presentation, key)) return undefined
  }
  if (presentation['finalOutputRefs'] !== undefined && !isArtifactRefList(presentation['finalOutputRefs'])) return undefined
  return presentation
}

const validatesPresentationStageBinding = (
  presentation: Record<string, unknown>,
  presentationStageValue: unknown,
  wasPersisted: boolean
): boolean => {
  if (!wasPersisted || Object.keys(presentation).length === 0) return true
  if (!isRecord(presentationStageValue) || presentationStageValue['status'] !== 'full' || !Array.isArray(presentationStageValue['artifactRefs'])) return false
  const stageRefs = presentationStageValue['artifactRefs']
  const envelopeRefs = [presentation['planRef'], presentation['resolvedTimelineRef'], presentation['runRef'], ...(Array.isArray(presentation['finalOutputRefs']) ? presentation['finalOutputRefs'] : [])]
  return envelopeRefs.every(ref => isRecord(ref) && stageRefs.some(stageRef => isRecord(stageRef) && stageRef['path'] === ref['path'] && stageRef['sha256'] === ref['sha256']))
}

export const expectedComicItemStatus = (
  item: PipelineManifestItem
): PipelineManifestItem['status'] | undefined => {
  const metadata = item.metadata['comic']
  if (
    !isRecord(metadata)
    || !hasOnlyKeys(metadata, ['schemaVersion', 'stages', 'audio', 'presentation'])
    || metadata['schemaVersion'] !== 1
    || !isRecord(metadata['stages'])
    || !hasOnlyKeys(metadata['stages'], ['structure', 'image', 'audio', 'presentation'])
  ) return undefined
  const stages = [
    parseComicStageRecord(metadata['stages']['structure'], item.providers, ['comic-structure']),
    parseComicStageRecord(metadata['stages']['image'], item.providers, ['comic-image']),
    parseComicStageRecord(metadata['stages']['audio'], item.providers, ['comic-audio', 'sound-effect-generation']),
    parseComicStageRecord(metadata['stages']['presentation'], item.providers, []),
  ]
  if (stages.some(stage => stage === undefined)) return undefined
  if (!parseAudioEnvelope(metadata['audio'])) return undefined
  const presentation = parsePresentationEnvelope(metadata['presentation'])
  if (!presentation || !validatesPresentationStageBinding(presentation, metadata['stages']['presentation'], metadata['presentation'] !== undefined)) return undefined
  const required = stages.filter(stage => stage?.requirement === 'required') as Array<{ requirement: 'required', status: PipelineManifestItem['status'] }>
  return required.length > 0 ? aggregateComicStageStatus(required) : undefined
}
