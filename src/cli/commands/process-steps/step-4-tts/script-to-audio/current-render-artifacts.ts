import type {
  CanonicalAudioProviderProjection,
  PipelineProviderState,
  Step4Metadata,
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import { canonicalTtsJson } from './contract-identity'
import { projectCanonicalAudioProviderStatus } from './contract-validation'
import { appendCurrentTtsProjection } from './current-tts-projection-merge'
import { buildCompactTerminalProjection } from './attempt-success-builders'

const compactTerminalProjection = (
  projection: CanonicalAudioProviderProjection
): CanonicalAudioProviderProjection => {
  if (!projection.archive || !projection.selectedSuccess || projection.activeWork) return projection
  const selected = projection.selectedSuccess
  const selectedAt = [...projection.pointerEvents].reverse().find((pointer) =>
    (pointer.action === 'select-success' || pointer.action === 'rollback-active')
    && pointer.renderIdentity === selected.renderIdentity
    && pointer.resultIdentity === selected.resultIdentity
    && pointer.audioRunId === selected.audioRunId
  )?.at ?? new Date(0).toISOString()
  return buildCompactTerminalProjection({
    renderIdentity: selected.renderIdentity,
    resultIdentity: selected.resultIdentity,
    audioRunId: selected.audioRunId,
    archive: projection.archive,
    at: selectedAt,
  })
}

export const serializeTtsMetadataEntries = (
  entries: readonly Step4Metadata[]
): Step4Metadata[] => entries.map((entry) => {
  const {
    ttsAudio: _ttsAudio,
    hostedConcurrency: _hostedConcurrency,
    ...compact
  } = entry
  return compact
})

export const compactSucceededTtsProviderState = (
  state: PipelineProviderState
): PipelineProviderState => {
  const namespace = state.operation === 'comic-audio' ? 'comicAudio' : state.operation === 'tts-synthesis' ? 'ttsAudio' : undefined
  if (!namespace || state.status !== 'succeeded') return state
  const projection = getTtsProjectionOrThrow(state)
  const compact = compactTerminalProjection(projection)
  if (compact === projection) return state
  return {
    ...state,
    metadata: { ...state.metadata, [namespace]: compact },
    result: { ...state.result, [namespace]: compact },
  }
}

export const buildCurrentTtsProviderState = (
  metadata: Step4Metadata
): PipelineProviderState => {
  if (
    metadata.operation !== 'tts-synthesis'
    || !metadata.targetKey
    || !metadata.transport
    || !metadata.artifactDir
    || !metadata.ttsAudio
  ) {
    throw UsageError(`TTS metadata for ${metadata.ttsService}/${metadata.ttsModel} is missing canonical render evidence.`)
  }
  const projected = projectCanonicalAudioProviderStatus(metadata.ttsAudio)
  return {
    service: metadata.ttsService,
    model: metadata.ttsModel,
    local: false,
    operation: metadata.operation,
    targetKey: metadata.targetKey,
    transport: metadata.transport,
    artifactDir: metadata.artifactDir,
    status: projected.status,
    attempts: projected.attempts,
    options: {},
    metadata: { ttsAudio: metadata.ttsAudio },
    result: { ttsAudio: metadata.ttsAudio }
  }
}

const getTtsProjectionOrThrow = (
  state: PipelineProviderState
): CanonicalAudioProviderProjection => {
  const namespace = state.operation === 'comic-audio' ? 'comicAudio' : 'ttsAudio'
  const resultProjection = state.result?.[namespace]
  const metadataProjection = state.metadata[namespace]
  if (
    !resultProjection
    || !metadataProjection
    || canonicalTtsJson(resultProjection) !== canonicalTtsJson(metadataProjection)
  ) {
    throw UsageError(`TTS provider state ${state.targetKey ?? `${state.service}/${state.model ?? ''}`} is missing one canonical projection.`)
  }
  return resultProjection as CanonicalAudioProviderProjection
}

export const getCurrentTtsJournalAttemptKey = (
  state: PipelineProviderState
): string | undefined => {
  const projection = getTtsProjectionOrThrow(state)
  const active = projection.activeWork
  if (active?.kind !== 'render' || !active.journalPath) return undefined
  const render = projection.renderHistory.find((entry) => entry.renderIdentity === active.renderIdentity)
  const event = render?.events.find((entry) => entry.sequence === active.eventSequence)
  if (
    event?.status !== 'running'
    || !event.admissionJournalRef
    || !event.admissionJournalSha256
    || !event.admissionJournalSnapshotId
  ) return undefined
  return `${state.targetKey ?? `${state.service}/${state.model ?? ''}`}\0${active.renderIdentity}\0${event.attempt}\0${active.journalPath}`
}

export const appendCurrentTtsProviderState = (
  current: PipelineProviderState,
  incoming: PipelineProviderState
): PipelineProviderState => {
  const incomingProjection = getTtsProjectionOrThrow(incoming)
  if (
    (current.operation !== 'tts-synthesis' && current.operation !== 'comic-audio')
    || incoming.operation !== current.operation
    || incoming.targetKey !== current.targetKey
    || incoming.transport !== current.transport
    || incoming.service !== current.service
    || incoming.model !== current.model
    || (incoming.artifactDir !== current.artifactDir && !incomingProjection.archive)
  ) {
    throw UsageError('TTS resume cannot change operation-scoped target identity or its stable artifact directory. Rebuild this TTS output with the current command before resuming it.')
  }
  const projection = incomingProjection.archive
    && incomingProjection.selectedSuccess
    && !incomingProjection.activeWork
    && incomingProjection.branchHistory.length === 0
    && incomingProjection.readinessAttempts.length === 0
    && incomingProjection.renderHistory.length === 0
    ? incomingProjection
    : appendCurrentTtsProjection(
        getTtsProjectionOrThrow(current),
        incomingProjection
      )
  const projected = projectCanonicalAudioProviderStatus(projection)
  const namespace = current.operation === 'comic-audio' ? 'comicAudio' : 'ttsAudio'
  return compactSucceededTtsProviderState({
    ...current,
    artifactDir: current.artifactDir,
    status: projected.status,
    attempts: projected.attempts,
    metadata: { ...current.metadata, ...incoming.metadata, [namespace]: projection },
    result: { [namespace]: projection },
    ...(projected.status === 'failed'
      ? { error: incoming.error ?? current.error ?? { message: 'TTS resume failed.', retryable: true } }
      : { error: undefined })
  })
}
