import type {
  CanonicalAudioProviderProjection,
  PipelineProviderState,
  Step4Metadata,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { canonicalTtsJson } from './contract-identity'
import { projectCanonicalAudioProviderStatus } from './contract-validation'

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
    incoming.archive
    && incoming.selectedSuccess
    && !incoming.activeWork
    && current.branchHistory.length === 0
    && current.readinessAttempts.length === 0
    && current.renderHistory.length === 0
  ) return incoming
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
  const existingPointerOccurrences = new Map<string, number>()
  for (const event of pointerEvents) {
    const identity = pointerIdentity(event)
    existingPointerOccurrences.set(identity, (existingPointerOccurrences.get(identity) ?? 0) + 1)
  }
  const incomingPointerOccurrences = new Map<string, number>()
  const reactivatedBranches = new Set<string>()
  const incomingActiveRenderPointerIdentity = incoming.activeWork?.kind === 'render'
    ? canonicalTtsJson({
        action: 'activate-render',
        renderIdentity: incoming.activeWork.renderIdentity,
        eventSequence: eventSequenceByIncoming.get(`${incoming.activeWork.renderIdentity}\0${incoming.activeWork.eventSequence}`)
          ?? incoming.activeWork.eventSequence
      })
    : undefined
  let reactivatedRender = false
  for (const event of remappedIncomingPointers) {
    const identity = pointerIdentity(event as CanonicalAudioProviderProjection['pointerEvents'][number])
    const occurrence = (incomingPointerOccurrences.get(identity) ?? 0) + 1
    incomingPointerOccurrences.set(identity, occurrence)
    const existingOccurrences = existingPointerOccurrences.get(identity) ?? 0
    const isBranchReactivation = event.action === 'activate-branch'
      && branchesWithNewReadiness.has(event.branchPlanId)
      && !reactivatedBranches.has(event.branchPlanId)
    const isRenderReactivation = event.action === 'activate-render'
      && branchesWithNewReadiness.size > 0
      && identity === incomingActiveRenderPointerIdentity
      && !reactivatedRender
    if (occurrence <= existingOccurrences && !isBranchReactivation && !isRenderReactivation) continue
    pointerEvents.push({ ...event, sequence: pointerSequence++ } as CanonicalAudioProviderProjection['pointerEvents'][number])
    existingPointerOccurrences.set(identity, Math.max(occurrence, existingOccurrences + 1))
    if (isBranchReactivation && event.action === 'activate-branch') reactivatedBranches.add(event.branchPlanId)
    if (isRenderReactivation) reactivatedRender = true
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

  const archive = incoming.archive ?? current.archive
  return {
    ...(activeWork ? { activeWork } : {}),
    ...(selectedSuccess ? { selectedSuccess } : {}),
    ...(archive ? { archive } : {}),
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
    (current.operation !== 'tts-synthesis' && current.operation !== 'comic-audio')
    || incoming.operation !== current.operation
    || incoming.targetKey !== current.targetKey
    || incoming.transport !== current.transport
    || incoming.service !== current.service
    || incoming.model !== current.model
    || (incoming.artifactDir !== current.artifactDir && !getTtsProjectionOrThrow(incoming).archive)
  ) {
    throw CLIUsageError('TTS resume cannot change operation-scoped target identity or its stable artifact directory. Rebuild this TTS output with the current command before resuming it.')
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
