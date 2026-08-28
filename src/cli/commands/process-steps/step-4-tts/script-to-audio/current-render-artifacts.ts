import type {
  CanonicalAudioProviderProjection,
  PipelineProviderState,
  Step4Metadata,
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import { canonicalTtsJson } from './contract-identity'
import { projectCanonicalAudioProviderStatus } from './contract-validation'
import { appendCurrentTtsProjection } from './current-tts-projection-merge'

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
  if (
    (current.operation !== 'tts-synthesis' && current.operation !== 'comic-audio')
    || incoming.operation !== current.operation
    || incoming.targetKey !== current.targetKey
    || incoming.transport !== current.transport
    || incoming.service !== current.service
    || incoming.model !== current.model
    || (incoming.artifactDir !== current.artifactDir && !getTtsProjectionOrThrow(incoming).archive)
  ) {
    throw UsageError('TTS resume cannot change operation-scoped target identity or its stable artifact directory. Rebuild this TTS output with the current command before resuming it.')
  }
  const projection = appendCurrentTtsProjection(
    getTtsProjectionOrThrow(current),
    getTtsProjectionOrThrow(incoming)
  )
  const projected = projectCanonicalAudioProviderStatus(projection)
  const namespace = current.operation === 'comic-audio' ? 'comicAudio' : 'ttsAudio'
  return {
    ...current,
    artifactDir: incoming.artifactDir,
    status: projected.status,
    attempts: projected.attempts,
    metadata: { ...current.metadata, ...incoming.metadata, [namespace]: projection },
    result: { [namespace]: projection },
    ...(projected.status === 'failed'
      ? { error: incoming.error ?? current.error ?? { message: 'TTS resume failed.', retryable: true } }
      : { error: undefined })
  }
}
