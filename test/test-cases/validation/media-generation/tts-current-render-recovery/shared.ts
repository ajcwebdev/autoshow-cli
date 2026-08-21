import { join } from 'node:path'
import type {
  CanonicalAudioProviderProjection,
  PipelineProviderState,
  RenderAdmissionJournalSnapshot,
  TtsOptions,
  TtsTarget
} from '~/types'
import { createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import { createTtsFixtureTarget } from '../../../../test-utils/tts-fixture-target'
import { requireDefined } from '../../../../test-utils/value-assertions'

export const DIALOGUE_OPTIONS: TtsOptions = {
  ttsDialogueFormat: 'labeled',
  ttsSpeakers: ['Host=alloy', 'Guest=echo'],
  ttsChunkConcurrency: 1
}

export const syntheticRecoveryAudio = (
  sourceIndex = 0,
  durationSeconds = 0.1
): Uint8Array => createSyntheticWavBytes({
  durationSeconds,
  amplitude: 0.2,
  frequencyHz: sourceIndex === 0 ? 280 : 420
})

export const createFixtureTarget = (
  onRun: () => void,
  mode: 'success' | 'accepted-error'
): TtsTarget => createTtsFixtureTarget({
  mode: mode === 'success' ? { kind: 'success' } : { kind: 'failAfterAdmission' },
  model: 'fixture-recovery-model',
  voice: 'alloy',
  onRun: () => onRun(),
  providerRequestId: () => 'local-recovery-fixture',
  audioBytes: () => syntheticRecoveryAudio(0, 0.15)
})

export const createAmbiguousAdmissionFixtureTarget = (attempts: number[]): TtsTarget => createTtsFixtureTarget({
  mode: { kind: 'ambiguousRetry', attempts, succeedOnAttempt: 3, maxAttempts: 4 },
  model: 'fixture-ambiguous-admission-model',
  voice: 'alloy',
  providerRequestId: (_sourceIndex, attempt) => `authorized-retry-${attempt}`,
  audioBytes: () => syntheticRecoveryAudio(0, 0.15)
})

export const createDialogueFixtureTarget = (
  calls: number[],
  model = 'fixture-dialogue-recovery-model',
  acceptedErrorSourceIndex?: number
): TtsTarget => createTtsFixtureTarget({
  mode: acceptedErrorSourceIndex === undefined
    ? { kind: 'success' }
    : { kind: 'failAfterAdmission', sourceIndex: acceptedErrorSourceIndex },
  model,
  multiSpeakerStrategy: 'segment-and-concat',
  onRun: (sourceIndex) => { calls.push(sourceIndex) },
  providerRequestId: (sourceIndex) => `dialogue-${sourceIndex}`,
  audioBytes: (sourceIndex) => syntheticRecoveryAudio(sourceIndex)
})

export const createRejectedDialogueFixtureTarget = (
  calls: number[],
  model = 'fixture-dialogue-recovery-model'
): TtsTarget => createTtsFixtureTarget({
  mode: { kind: 'reject' },
  model,
  multiSpeakerStrategy: 'segment-and-concat',
  onRun: (sourceIndex) => { calls.push(sourceIndex) },
  audioBytes: (sourceIndex) => syntheticRecoveryAudio(sourceIndex)
})

export const crashAfterPromotedResult = (state: PipelineProviderState): PipelineProviderState => {
  const projection = structuredClone(state.result?.['ttsAudio']) as CanonicalAudioProviderProjection
  const render = requireDefined(projection.renderHistory[0], 'recovery fixture render')
  const running = [...render.events].reverse().find((event) => event.status === 'running' && event.providerRenderResultRef === undefined)
  const promoted = [...render.events].reverse().find((event) => event.status === 'running' && event.admissionJournalRef)
  const selected = requireDefined(promoted ?? running, 'recovery fixture running event')
  render.events = render.events.filter((event) => event.sequence <= selected.sequence)
  projection.activeWork = { kind: 'render', renderIdentity: render.renderIdentity, eventSequence: selected.sequence }
  delete projection.selectedSuccess
  projection.pointerEvents = projection.pointerEvents.filter((event) =>
    event.action !== 'select-success'
    && (event.action !== 'activate-render' || event.renderIdentity !== render.renderIdentity || event.eventSequence <= selected.sequence))
  return {
    ...state,
    status: 'running',
    attempts: selected.attempt,
    metadata: { ...state.metadata, ttsAudio: projection },
    result: { ttsAudio: projection },
    error: undefined
  }
}

export const journalEventForState = (state: PipelineProviderState) => {
  const projection = state.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
  const pointer = projection?.activeWork?.kind === 'render' ? projection.activeWork : projection?.selectedSuccess
  if (!projection || !pointer) return undefined
  const render = projection.renderHistory.find((entry) => entry.renderIdentity === pointer.renderIdentity)
  return render?.events.find((entry) => entry.sequence === pointer.eventSequence)
}

export const latestJournalForState = async (
  rootDir: string,
  state: PipelineProviderState
): Promise<RenderAdmissionJournalSnapshot | undefined> => {
  const event = journalEventForState(state)
  if (!event?.admissionJournalRef) return undefined
  return await Bun.file(join(rootDir, state.artifactDir, event.admissionJournalRef)).json()
}
