import type { PipelineProviderState } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import { canonicalManifestJson, isAppendOnlyArray } from './guards'

const assertAudioProviderIdentity = (before: PipelineProviderState, after: PipelineProviderState): void => {
  if (
    before.operation !== after.operation
    || before.targetKey !== after.targetKey
    || before.transport !== after.transport
    || before.service !== after.service
    || before.model !== after.model
    || before.artifactDir !== after.artifactDir
    || canonicalManifestJson(before.options) !== canonicalManifestJson(after.options)
  ) {
    throw UsageError('An audio provider-state update cannot change operation-scoped identity, its artifact directory, or immutable provider options.')
  }
}

const permitsTerminalAudioArchive = (
  beforeProjection: Record<string, unknown>,
  afterProjection: Record<string, unknown>,
  after: PipelineProviderState
): boolean => {
  const compactArchive = afterProjection['archive']
  const compactSelected = afterProjection['selectedSuccess']
  const isTerminalArchiveCompaction = after.status === 'succeeded'
    && isRecord(compactArchive)
    && isRecord(compactSelected)
    && afterProjection['activeWork'] === undefined
    && Array.isArray(afterProjection['branchHistory'])
    && afterProjection['branchHistory'].length === 0
    && Array.isArray(afterProjection['readinessAttempts'])
    && afterProjection['readinessAttempts'].length === 0
    && Array.isArray(afterProjection['renderHistory'])
    && afterProjection['renderHistory'].length === 0
  if (isTerminalArchiveCompaction) {
    const priorSelected = beforeProjection['selectedSuccess']
    if (isRecord(priorSelected) && (
      priorSelected['renderIdentity'] !== compactSelected['renderIdentity']
      || priorSelected['resultIdentity'] !== compactSelected['resultIdentity']
      || priorSelected['audioRunId'] !== compactSelected['audioRunId']
    )) {
      throw UsageError('Canonical audio archive compaction cannot change the selected successful render.')
    }
    return true
  }
  return false
}

const assertAudioHistoryAppendOnly = (
  beforeProjection: Record<string, unknown>,
  afterProjection: Record<string, unknown>
): void => {
  for (const key of ['branchHistory', 'readinessAttempts', 'pointerEvents'] as const) {
    const oldEntries = beforeProjection[key]
    const nextEntries = afterProjection[key]
    if (!Array.isArray(oldEntries) || !Array.isArray(nextEntries) || !isAppendOnlyArray(oldEntries, nextEntries)) {
      throw UsageError(`Canonical audio ${key} is append-only.`)
    }
  }
  const oldRenders = beforeProjection['renderHistory']
  const nextRenders = afterProjection['renderHistory']
  if (!Array.isArray(oldRenders) || !Array.isArray(nextRenders) || oldRenders.length > nextRenders.length) {
    throw UsageError('Canonical audio renderHistory is append-only.')
  }
  for (const [index, oldRender] of oldRenders.entries()) {
    const nextRender = nextRenders[index]
    if (!isRecord(oldRender) || !isRecord(nextRender)) {
      throw UsageError('Canonical audio render history contains an invalid record.')
    }
    const { events: oldEvents, ...oldHeader } = oldRender
    const { events: nextEvents, ...nextHeader } = nextRender
    if (
      canonicalManifestJson(oldHeader) !== canonicalManifestJson(nextHeader)
      || !Array.isArray(oldEvents)
      || !Array.isArray(nextEvents)
      || !isAppendOnlyArray(oldEvents, nextEvents)
    ) {
      throw UsageError('Canonical audio render records and events are append-only.')
    }
  }
}

const assertAudioPointerTransition = (
  beforeProjection: Record<string, unknown>,
  afterProjection: Record<string, unknown>
): void => {
  const beforeActive = canonicalManifestJson(beforeProjection['activeWork'])
  const afterActive = canonicalManifestJson(afterProjection['activeWork'])
  const beforeSelected = beforeProjection['selectedSuccess']
  const afterSelected = afterProjection['selectedSuccess']
  const oldPointers = beforeProjection['pointerEvents'] as unknown[]
  const nextPointers = afterProjection['pointerEvents'] as unknown[]
  const appendedPointers = nextPointers.slice(oldPointers.length)
  if (beforeActive !== afterActive && appendedPointers.length === 0) {
    throw UsageError('Canonical audio activeWork may change only through an appended pointer event.')
  }
  if (beforeSelected !== undefined && afterSelected === undefined) {
    throw UsageError('Canonical audio selectedSuccess cannot be cleared by later work.')
  }
  if (canonicalManifestJson(beforeSelected) !== canonicalManifestJson(afterSelected)) {
    const pointer = appendedPointers.at(-1)
    if (
      !isRecord(pointer)
      || (pointer['action'] !== 'select-success' && pointer['action'] !== 'rollback-active')
      || !isRecord(afterSelected)
      || pointer['renderIdentity'] !== afterSelected['renderIdentity']
      || pointer['eventSequence'] !== afterSelected['eventSequence']
      || pointer['resultIdentity'] !== afterSelected['resultIdentity']
      || pointer['audioRunId'] !== afterSelected['audioRunId']
    ) {
      throw UsageError('Canonical audio selectedSuccess may change only through an appended exact success pointer.')
    }
  }
}

export const assertAppendOnlyAudioProjection = (
  before: PipelineProviderState,
  after: PipelineProviderState
): void => {
  assertAudioProviderIdentity(before, after)
  const namespace = before.operation === 'comic-audio' ? 'comicAudio' : before.operation === 'tts-synthesis' ? 'ttsAudio' : undefined
  if (!namespace) return
  const beforeProjection = before.result?.[namespace]
  const afterProjection = after.result?.[namespace]
  if (!isRecord(beforeProjection) || !isRecord(afterProjection)) {
    throw UsageError('An audio provider-state update requires its canonical projection.')
  }
  // Terminal archival intentionally bypasses append-only live-history checks.
  if (permitsTerminalAudioArchive(beforeProjection, afterProjection, after)) return
  assertAudioHistoryAppendOnly(beforeProjection, afterProjection)
  assertAudioPointerTransition(beforeProjection, afterProjection)
}
