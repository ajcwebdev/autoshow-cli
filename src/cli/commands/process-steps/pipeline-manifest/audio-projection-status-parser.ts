import type { PipelineProviderState } from '~/types'
import { isRecord } from '~/utils/rest-client'
import { hasOnlyKeys, PROVIDER_STATUS_SET } from './guards'

type ProjectionStatus = { status: PipelineProviderState['status'], attempts: number }

type AudioProjectionEnvelope = {
  value: Record<string, unknown>
  branchHistory: unknown[]
  readinessAttempts: unknown[]
  renderHistory: unknown[]
}

const parseEnvelope = (value: unknown): AudioProjectionEnvelope | undefined => {
  if (
    !isRecord(value)
    || !hasOnlyKeys(value, ['activeWork', 'selectedSuccess', 'archive', 'branchHistory', 'readinessAttempts', 'renderHistory', 'pointerEvents'])
    || !Array.isArray(value['branchHistory'])
    || !Array.isArray(value['readinessAttempts'])
    || !Array.isArray(value['renderHistory'])
    || !Array.isArray(value['pointerEvents'])
  ) return undefined
  return {
    value,
    branchHistory: value['branchHistory'],
    readinessAttempts: value['readinessAttempts'],
    renderHistory: value['renderHistory'],
  }
}

const parseCompactArchiveSuccess = (envelope: AudioProjectionEnvelope): ProjectionStatus | undefined => {
  const archive = envelope.value['archive']
  const selected = envelope.value['selectedSuccess']
  if (!isRecord(archive) || !isRecord(selected) || envelope.value['activeWork'] !== undefined) return undefined
  if (
    archive['schemaVersion'] !== 1
    || !isRecord(archive['renderRef'])
    || !isRecord(archive['timelineRef'])
    || !isRecord(archive['finalRef'])
    || !Number.isInteger(archive['slotCount'])
    || typeof selected['renderIdentity'] !== 'string'
    || typeof selected['resultIdentity'] !== 'string'
    || typeof selected['audioRunId'] !== 'string'
  ) return undefined
  return { status: 'succeeded', attempts: 0 }
}

const parsePolicySkip = (
  envelope: AudioProjectionEnvelope,
  active: Record<string, unknown>,
  targetKey: string
): ProjectionStatus | undefined => {
  if (active['kind'] !== 'policy-skip') return undefined
  const evidence = active['evidence']
  if (
    !hasOnlyKeys(active, ['kind', 'evidence'])
    || !isRecord(evidence)
    || evidence['schemaVersion'] !== 1
    || typeof evidence['skipId'] !== 'string'
    || typeof evidence['targetKey'] !== 'string'
    || evidence['targetKey'] !== targetKey
    || (evidence['reasonCode'] !== 'user-requested' && evidence['reasonCode'] !== 'project-policy' && evidence['reasonCode'] !== 'rights-policy')
    || typeof evidence['reason'] !== 'string'
    || evidence['reason'].trim().length === 0
    || envelope.branchHistory.length !== 0
    || envelope.readinessAttempts.length !== 0
    || envelope.renderHistory.length !== 0
    || envelope.value['selectedSuccess'] !== undefined
  ) return undefined
  return { status: 'skipped', attempts: 0 }
}

const exactReference = (
  values: readonly unknown[],
  predicate: (record: Record<string, unknown>) => boolean
): Record<string, unknown> | undefined => {
  const matches = values.filter(value => isRecord(value) && predicate(value))
  return matches.length === 1 ? matches[0] as Record<string, unknown> : undefined
}

const parseActiveBranch = (
  envelope: AudioProjectionEnvelope,
  active: Record<string, unknown>
): ProjectionStatus | undefined => {
  if (active['kind'] !== 'branch') return undefined
  if (
    !hasOnlyKeys(active, ['kind', 'branchPlanId', 'readinessAttemptSequence'])
    || typeof active['branchPlanId'] !== 'string'
    || (active['readinessAttemptSequence'] !== undefined && (!Number.isInteger(active['readinessAttemptSequence']) || (active['readinessAttemptSequence'] as number) < 0))
  ) return undefined
  if (active['readinessAttemptSequence'] === undefined) return { status: 'missing', attempts: 0 }
  const readiness = exactReference(envelope.readinessAttempts, attempt =>
    attempt['sequence'] === active['readinessAttemptSequence']
    && attempt['branchPlanId'] === active['branchPlanId']
  )
  if (readiness?.['status'] === 'ready' && readiness['admissionDisposition'] === 'eligible') return { status: 'missing', attempts: 0 }
  if (
    (readiness?.['status'] === 'ready' && readiness['admissionDisposition'] === 'peer-blocked')
    || (readiness?.['status'] === 'blocked' && readiness['admissionDisposition'] === 'self-blocked')
  ) return { status: 'failed', attempts: 0 }
  return undefined
}

const parseActiveRender = (
  envelope: AudioProjectionEnvelope,
  active: Record<string, unknown>
): ProjectionStatus | undefined => {
  if (
    active['kind'] !== 'render'
    || !hasOnlyKeys(active, ['kind', 'renderIdentity', 'eventSequence', 'journalPath', 'completedSlotHashes'])
    || typeof active['renderIdentity'] !== 'string'
    || !Number.isInteger(active['eventSequence'])
  ) return undefined
  const render = exactReference(envelope.renderHistory, candidate => candidate['renderIdentity'] === active['renderIdentity'])
  if (!render || !Array.isArray(render['events'])) return undefined
  const event = exactReference(render['events'], candidate => candidate['sequence'] === active['eventSequence'])
  if (
    !event
    || typeof event['status'] !== 'string'
    || !PROVIDER_STATUS_SET.has(event['status'])
    || !Number.isInteger(event['attempt'])
    || (event['attempt'] as number) < 0
  ) return undefined
  const status = event['status'] as PipelineProviderState['status']
  if (status === 'skipped') return undefined
  if (status === 'succeeded') {
    const triples = [
      ['providerRenderResultIdentity', 'providerRenderResultRef', 'providerRenderResultSha256'],
      ['audioRunId', 'audioRunRef', 'audioRunSha256'],
    ] as const
    if (triples.some(keys => keys.some(key => typeof event[key] !== 'string'))) return undefined
    const selected = envelope.value['selectedSuccess']
    if (
      !isRecord(selected)
      || selected['renderIdentity'] !== active['renderIdentity']
      || selected['eventSequence'] !== active['eventSequence']
      || selected['resultIdentity'] !== event['providerRenderResultIdentity']
      || selected['audioRunId'] !== event['audioRunId']
    ) return undefined
  }
  return { status, attempts: event['attempt'] as number }
}

export const parseAudioProjectionStatusVariants = (
  value: unknown,
  targetKey: string,
  validateStructure: (projection: Record<string, unknown>, targetKey: string) => boolean
): ProjectionStatus | undefined => {
  const envelope = parseEnvelope(value)
  if (!envelope) return undefined
  const archive = parseCompactArchiveSuccess(envelope)
  if (archive) return archive
  const active = envelope.value['activeWork']
  if (!isRecord(active) || !validateStructure(envelope.value, targetKey)) return undefined
  return parsePolicySkip(envelope, active, targetKey)
    ?? parseActiveBranch(envelope, active)
    ?? parseActiveRender(envelope, active)
}
