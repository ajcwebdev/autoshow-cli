import type {
  CanonicalAudioProviderProjection,
  PipelineProviderState,
  ProtectedAssetRef,
  ProviderRenderStrategy,
  Step4Metadata,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { canonicalTtsJson } from './contract-identity'
import { projectCanonicalAudioProviderStatus } from './contract-validation'

export type CurrentTtsObservedVoice = {
  kind: 'provider-id' | 'reference-asset' | 'local-model-voice'
  value?: string | undefined
  valueHash: string
  protectedAsset?: ProtectedAssetRef | undefined
  authorizationRef?: string | undefined
}

export type CurrentTtsObservedTurn = {
  turnId: string
  sourceIndex: number
  speaker: string
  text: string
  voice: CurrentTtsObservedVoice
  outputPath?: string | undefined
}

export type CurrentTtsRenderArtifacts = {
  artifactDir: string
  operation: 'tts-synthesis'
  targetKey: string
  transport: string
  renderIdentity: string
  resultIdentity: string
  audioRunId: string
  strategy: ProviderRenderStrategy
  projection: CanonicalAudioProviderProjection
}

const rebaseArtifactPath = (prefix: string, path: string): string =>
  path === '.' ? prefix : `${prefix}/${path}`

export const rebaseCurrentTtsProjectionArtifactRefs = (
  projection: CanonicalAudioProviderProjection,
  prefix: string
): CanonicalAudioProviderProjection => ({
  ...projection,
  branchHistory: projection.branchHistory.map((entry) => ({
    ...entry,
    branchPlanRef: rebaseArtifactPath(prefix, entry.branchPlanRef)
  })),
  readinessAttempts: projection.readinessAttempts.map((entry) => ({
    ...entry,
    readinessResultRef: rebaseArtifactPath(prefix, entry.readinessResultRef)
  })),
  renderHistory: projection.renderHistory.map((render) => ({
    ...render,
    renderPlanRef: rebaseArtifactPath(prefix, render.renderPlanRef),
    renderDir: rebaseArtifactPath(prefix, render.renderDir),
    events: render.events.map((event) => ({
      ...event,
      ...(event.readinessAuthorization ? { readinessAuthorization: { ...event.readinessAuthorization, readinessResultRef: rebaseArtifactPath(prefix, event.readinessAuthorization.readinessResultRef) } } : {}),
      ...(event.admissionJournalRef ? { admissionJournalRef: rebaseArtifactPath(prefix, event.admissionJournalRef) } : {}),
      ...(event.providerRenderResultRef ? { providerRenderResultRef: rebaseArtifactPath(prefix, event.providerRenderResultRef) } : {}),
      ...(event.outputRefs ? { outputRefs: event.outputRefs.map((ref) => ({ ...ref, path: rebaseArtifactPath(prefix, ref.path) })) } : {}),
      ...(event.takeSelections ? { takeSelections: event.takeSelections.map((ref) => ({ ...ref, path: rebaseArtifactPath(prefix, ref.path) })) } : {}),
      ...(event.continuationCheckpoints ? { continuationCheckpoints: event.continuationCheckpoints.map((ref) => ({ ...ref, path: rebaseArtifactPath(prefix, ref.path) })) } : {}),
      ...(event.cacheEvidenceRefs ? { cacheEvidenceRefs: event.cacheEvidenceRefs.map((ref) => ({ ...ref, path: rebaseArtifactPath(prefix, ref.path) })) } : {}),
      ...(event.consumedSelectionRebuild ? {
        consumedSelectionRebuild: {
          ...event.consumedSelectionRebuild,
          path: rebaseArtifactPath(prefix, event.consumedSelectionRebuild.path)
        }
      } : {}),
      ...(event.audioRunRef ? { audioRunRef: rebaseArtifactPath(prefix, event.audioRunRef) } : {}),
      ...(event.batchProgress ? { batchProgress: event.batchProgress.map((batch) => ({
        ...batch,
        generationSlots: batch.generationSlots.map((slot) => slot.source === 'provider-dispatch'
          ? {
              ...slot,
              batchInvocationPlan: { ...slot.batchInvocationPlan, path: rebaseArtifactPath(prefix, slot.batchInvocationPlan.path) },
              ...(slot.batchResult ? { batchResult: { ...slot.batchResult, path: rebaseArtifactPath(prefix, slot.batchResult.path) } } : {})
            }
          : {
              ...slot,
              materializationPlan: { ...slot.materializationPlan, path: rebaseArtifactPath(prefix, slot.materializationPlan.path) },
              batchResult: { ...slot.batchResult, path: rebaseArtifactPath(prefix, slot.batchResult.path) }
            }),
        ...(batch.currentTakeSelection ? { currentTakeSelection: { ...batch.currentTakeSelection, path: rebaseArtifactPath(prefix, batch.currentTakeSelection.path) } } : {}),
        ...(batch.continuationCheckpoint ? { continuationCheckpoint: { ...batch.continuationCheckpoint, path: rebaseArtifactPath(prefix, batch.continuationCheckpoint.path) } } : {})
      })) } : {})
    }))
  }))
})

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
    throw CLIUsageError(`TTS metadata for ${metadata.ttsService}/${metadata.ttsModel} is missing canonical render evidence.`)
  }
  const projected = projectCanonicalAudioProviderStatus(metadata.ttsAudio)
  return {
    service: metadata.ttsService,
    model: metadata.ttsModel,
    local: metadata.ttsService === 'kitten',
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
  const resultProjection = state.result?.['ttsAudio']
  const metadataProjection = state.metadata['ttsAudio']
  if (
    !resultProjection
    || !metadataProjection
    || canonicalTtsJson(resultProjection) !== canonicalTtsJson(metadataProjection)
  ) {
    throw CLIUsageError(`TTS provider state ${state.targetKey ?? `${state.service}/${state.model ?? ''}`} is missing one canonical projection.`)
  }
  return resultProjection as CanonicalAudioProviderProjection
}

const nextSequence = (values: readonly { sequence: number }[]): number =>
  values.reduce((maximum, entry) => Math.max(maximum, entry.sequence), 0) + 1

const withoutSequence = <T extends { sequence: number }>(value: T): Omit<T, 'sequence'> => {
  const { sequence: _sequence, ...rest } = value
  return rest
}

const suffixPrefixOverlap = <T,>(current: readonly T[], incoming: readonly T[]): number => {
  const maximum = Math.min(current.length, incoming.length)
  for (let length = maximum; length > 0; length -= 1) {
    const currentSuffix = current.slice(current.length - length)
    const incomingPrefix = incoming.slice(0, length)
    if (canonicalTtsJson(currentSuffix) === canonicalTtsJson(incomingPrefix)) return length
  }
  return 0
}

const appendCurrentTtsProjection = (
  current: CanonicalAudioProviderProjection,
  incoming: CanonicalAudioProviderProjection
): CanonicalAudioProviderProjection => {
  if (
    current.branchHistory.length === 0
    && current.readinessAttempts.length === 0
    && current.renderHistory.length === 0
    && current.activeWork?.kind === 'branch'
  ) return incoming
  const branchHistory = [...current.branchHistory]
  let branchSequence = nextSequence(branchHistory)
  for (const entry of incoming.branchHistory) {
    const existing = branchHistory.find((candidate) => candidate.branchPlanId === entry.branchPlanId)
    if (existing) {
      if (existing.branchPlanSha256 !== entry.branchPlanSha256) {
        throw CLIUsageError(`TTS resume found conflicting branch-plan evidence for ${entry.branchPlanId}.`)
      }
      continue
    }
    branchHistory.push({ ...entry, sequence: branchSequence++ })
  }

  const readinessAttempts = [...current.readinessAttempts]
  const readinessSequenceByIncoming = new Map<number, number>()
  const branchesWithNewReadiness = new Set<string>()
  let readinessSequence = nextSequence(readinessAttempts)
  for (const entry of incoming.readinessAttempts) {
    const existing = readinessAttempts.find((candidate) =>
      candidate.branchPlanId === entry.branchPlanId
      && candidate.readinessResultRef === entry.readinessResultRef
      && candidate.readinessResultHash === entry.readinessResultHash
    )
    if (existing) {
      readinessSequenceByIncoming.set(entry.sequence, existing.sequence)
    } else {
      readinessSequenceByIncoming.set(entry.sequence, readinessSequence)
      readinessAttempts.push({ ...entry, sequence: readinessSequence++ })
      branchesWithNewReadiness.add(entry.branchPlanId)
    }
  }

  const renderHistory = current.renderHistory.map((render) => ({
    ...render,
    events: [...render.events]
  }))
  const eventSequenceByIncoming = new Map<string, number>()
  const remapEventReadiness = (
    event: CanonicalAudioProviderProjection['renderHistory'][number]['events'][number]
  ): CanonicalAudioProviderProjection['renderHistory'][number]['events'][number] => event.readinessAuthorization
    ? {
        ...event,
        readinessAuthorization: {
          ...event.readinessAuthorization,
          readinessAttemptSequence: readinessSequenceByIncoming.get(event.readinessAuthorization.readinessAttemptSequence)
            ?? event.readinessAuthorization.readinessAttemptSequence
        }
      }
    : event
  for (const incomingRender of incoming.renderHistory) {
    const currentRender = renderHistory.find((render) => render.renderIdentity === incomingRender.renderIdentity)
    if (currentRender) {
      const currentHeader = {
        renderPlanId: currentRender.renderPlanId,
        renderPlanSha256: currentRender.renderPlanSha256,
        voiceContextKey: currentRender.voiceContextKey,
        synthesisSettingsHash: currentRender.synthesisSettingsHash,
        outputProfileHash: currentRender.outputProfileHash
      }
      const incomingHeader = {
        renderPlanId: incomingRender.renderPlanId,
        renderPlanSha256: incomingRender.renderPlanSha256,
        voiceContextKey: incomingRender.voiceContextKey,
        synthesisSettingsHash: incomingRender.synthesisSettingsHash,
        outputProfileHash: incomingRender.outputProfileHash
      }
      if (canonicalTtsJson(currentHeader) !== canonicalTtsJson(incomingHeader)) {
        throw CLIUsageError(`TTS resume found conflicting immutable render evidence for ${incomingRender.renderIdentity}.`)
      }
      const remappedIncomingEvents = incomingRender.events.map(remapEventReadiness)
      const hasBootstrapMissing = remappedIncomingEvents[0]?.status === 'missing'
      if (hasBootstrapMissing) {
        eventSequenceByIncoming.set(
          `${incomingRender.renderIdentity}\0${incomingRender.events[0]?.sequence as number}`,
          currentRender.events.find((event) => event.status === 'missing')?.sequence ?? 1
        )
      }
      const incomingEventsToAppend = hasBootstrapMissing ? remappedIncomingEvents.slice(1) : remappedIncomingEvents
      const currentComparable = currentRender.events.map(withoutSequence)
      const incomingComparable = incomingEventsToAppend.map(withoutSequence)
      const overlap = suffixPrefixOverlap(currentComparable, incomingComparable)
      const overlapStart = currentRender.events.length - overlap
      let eventSequence = nextSequence(currentRender.events)
      for (const [index, event] of incomingEventsToAppend.entries()) {
        const sourceEvent = incomingRender.events[index + (hasBootstrapMissing ? 1 : 0)] as typeof event
        if (index < overlap) {
          eventSequenceByIncoming.set(`${incomingRender.renderIdentity}\0${sourceEvent.sequence}`, (currentRender.events[overlapStart + index] as typeof event).sequence)
          continue
        }
        eventSequenceByIncoming.set(`${incomingRender.renderIdentity}\0${sourceEvent.sequence}`, eventSequence)
        currentRender.events.push({ ...event, sequence: eventSequence++ })
      }
      continue
    }

    const events = incomingRender.events.map((incomingEvent, index) => {
      const event = remapEventReadiness(incomingEvent)
      const sequence = index + 1
      eventSequenceByIncoming.set(`${incomingRender.renderIdentity}\0${incomingEvent.sequence}`, sequence)
      return { ...event, sequence }
    })
    renderHistory.push({ ...incomingRender, events })
  }

  const pointerEvents = [...current.pointerEvents]
  let pointerSequence = nextSequence(pointerEvents)
  const remappedIncomingPointers = incoming.pointerEvents.map((event) => {
    const eventSequence = 'renderIdentity' in event && 'eventSequence' in event
      ? eventSequenceByIncoming.get(`${event.renderIdentity}\0${event.eventSequence}`)
      : undefined
    const readinessAttemptSequence = event.action === 'project-branch-readiness'
      ? readinessSequenceByIncoming.get(event.readinessAttemptSequence)
      : undefined
    return {
      ...event,
      ...(eventSequence !== undefined ? { eventSequence } : {}),
      ...(readinessAttemptSequence !== undefined ? { readinessAttemptSequence } : {})
    }
  })
  const pointerIdentity = (event: CanonicalAudioProviderProjection['pointerEvents'][number]): string => {
    if (event.action === 'activate-branch') return canonicalTtsJson({ action: event.action, branchPlanId: event.branchPlanId })
    if (event.action === 'project-branch-readiness') return canonicalTtsJson({ action: event.action, branchPlanId: event.branchPlanId, readinessAttemptSequence: event.readinessAttemptSequence })
    if (event.action === 'activate-render') return canonicalTtsJson({ action: event.action, renderIdentity: event.renderIdentity, eventSequence: event.eventSequence })
    if (event.action === 'select-success') return canonicalTtsJson({ action: event.action, renderIdentity: event.renderIdentity, eventSequence: event.eventSequence, resultIdentity: event.resultIdentity, audioRunId: event.audioRunId })
    return canonicalTtsJson(withoutSequence(event))
  }
  const existingPointerIdentities = new Set(pointerEvents.map(pointerIdentity))
  const reactivatedBranches = new Set<string>()
  for (const event of remappedIncomingPointers) {
    const identity = pointerIdentity(event as CanonicalAudioProviderProjection['pointerEvents'][number])
    const latestIdentity = pointerEvents.length > 0
      ? pointerIdentity(pointerEvents[pointerEvents.length - 1] as CanonicalAudioProviderProjection['pointerEvents'][number])
      : undefined
    const isBranchReactivation = event.action === 'activate-branch'
      && branchesWithNewReadiness.has(event.branchPlanId)
      && !reactivatedBranches.has(event.branchPlanId)
      && latestIdentity !== identity
    const isRenderReactivation = event.action === 'activate-render' && latestIdentity !== identity
    const isExplicitReactivation = isBranchReactivation || isRenderReactivation
    if (existingPointerIdentities.has(identity) && !isExplicitReactivation) continue
    pointerEvents.push({ ...event, sequence: pointerSequence++ } as CanonicalAudioProviderProjection['pointerEvents'][number])
    if (isBranchReactivation && event.action === 'activate-branch') reactivatedBranches.add(event.branchPlanId)
    existingPointerIdentities.add(identity)
  }

  const activeWork = incoming.activeWork?.kind === 'render'
    ? {
        ...incoming.activeWork,
        eventSequence: eventSequenceByIncoming.get(`${incoming.activeWork.renderIdentity}\0${incoming.activeWork.eventSequence}`)
          ?? incoming.activeWork.eventSequence
      }
    : incoming.activeWork?.kind === 'branch' && incoming.activeWork.readinessAttemptSequence !== undefined
      ? {
          ...incoming.activeWork,
          readinessAttemptSequence: readinessSequenceByIncoming.get(incoming.activeWork.readinessAttemptSequence)
            ?? incoming.activeWork.readinessAttemptSequence
        }
      : incoming.activeWork
  const selectedSuccess = incoming.selectedSuccess
    ? {
        ...incoming.selectedSuccess,
        eventSequence: eventSequenceByIncoming.get(`${incoming.selectedSuccess.renderIdentity}\0${incoming.selectedSuccess.eventSequence}`)
          ?? incoming.selectedSuccess.eventSequence
      }
    : current.selectedSuccess

  return {
    ...(activeWork ? { activeWork } : {}),
    ...(selectedSuccess ? { selectedSuccess } : {}),
    branchHistory,
    readinessAttempts,
    renderHistory,
    pointerEvents
  }
}

export const appendCurrentTtsProviderState = (
  current: PipelineProviderState,
  incoming: PipelineProviderState
): PipelineProviderState => {
  if (
    current.operation !== 'tts-synthesis'
    || incoming.operation !== current.operation
    || incoming.targetKey !== current.targetKey
    || incoming.transport !== current.transport
    || incoming.service !== current.service
    || incoming.model !== current.model
    || incoming.artifactDir !== current.artifactDir
  ) {
    throw CLIUsageError('TTS resume cannot change operation-scoped target identity or its stable artifact directory. Rebuild this TTS output with the current command before resuming it.')
  }
  const projection = appendCurrentTtsProjection(
    getTtsProjectionOrThrow(current),
    getTtsProjectionOrThrow(incoming)
  )
  const projected = projectCanonicalAudioProviderStatus(projection)
  return {
    ...current,
    status: projected.status,
    attempts: projected.attempts,
    metadata: { ...current.metadata, ...incoming.metadata, ttsAudio: projection },
    result: { ttsAudio: projection },
    ...(projected.status === 'failed'
      ? { error: incoming.error ?? current.error ?? { message: 'TTS resume failed.', retryable: true } }
      : { error: undefined })
  }
}
