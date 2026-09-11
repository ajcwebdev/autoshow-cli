import type { CanonicalAudioProviderProjection } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { canonicalTtsJson } from './contract-identity'

type Branch = CanonicalAudioProviderProjection['branchHistory'][number]
type ReadinessAttempt = CanonicalAudioProviderProjection['readinessAttempts'][number]
type Render = CanonicalAudioProviderProjection['renderHistory'][number]
type RenderEvent = Render['events'][number]
type PointerEvent = CanonicalAudioProviderProjection['pointerEvents'][number]

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

const mergeBranchHistory = (
  current: readonly Branch[],
  incoming: readonly Branch[]
): Branch[] => {
  const branchHistory = [...current]
  let sequence = nextSequence(branchHistory)
  for (const entry of incoming) {
    const existing = branchHistory.find((candidate) => candidate.branchPlanId === entry.branchPlanId)
    if (existing) {
      if (existing.branchPlanSha256 !== entry.branchPlanSha256) {
        throw UsageError(`TTS resume found conflicting branch-plan evidence for ${entry.branchPlanId}.`)
      }
      continue
    }
    branchHistory.push({ ...entry, sequence: sequence++ })
  }
  return branchHistory
}

const mergeReadinessHistory = (
  current: readonly ReadinessAttempt[],
  incoming: readonly ReadinessAttempt[]
): {
  readinessAttempts: ReadinessAttempt[]
  readinessSequenceByIncoming: Map<number, number>
  branchesWithNewReadiness: Set<string>
} => {
  const readinessAttempts = [...current]
  const readinessSequenceByIncoming = new Map<number, number>()
  const branchesWithNewReadiness = new Set<string>()
  let sequence = nextSequence(readinessAttempts)
  for (const entry of incoming) {
    const existing = readinessAttempts.find((candidate) =>
      candidate.branchPlanId === entry.branchPlanId
      && candidate.readinessResultRef === entry.readinessResultRef
      && candidate.readinessResultHash === entry.readinessResultHash
    )
    if (existing) {
      readinessSequenceByIncoming.set(entry.sequence, existing.sequence)
      continue
    }
    readinessSequenceByIncoming.set(entry.sequence, sequence)
    readinessAttempts.push({ ...entry, sequence: sequence++ })
    branchesWithNewReadiness.add(entry.branchPlanId)
  }
  return { readinessAttempts, readinessSequenceByIncoming, branchesWithNewReadiness }
}

const remapEventReadiness = (
  event: RenderEvent,
  readinessSequenceByIncoming: ReadonlyMap<number, number>
): RenderEvent => event.readinessAuthorization
  ? {
      ...event,
      readinessAuthorization: {
        ...event.readinessAuthorization,
        readinessAttemptSequence: readinessSequenceByIncoming.get(event.readinessAuthorization.readinessAttemptSequence)
          ?? event.readinessAuthorization.readinessAttemptSequence
      }
    }
  : event

const assertMatchingRenderHeader = (current: Render, incoming: Render): void => {
  const header = (render: Render) => ({
    renderPlanId: render.renderPlanId,
    renderPlanSha256: render.renderPlanSha256,
    voiceContextKey: render.voiceContextKey,
    synthesisSettingsHash: render.synthesisSettingsHash,
    outputProfileHash: render.outputProfileHash
  })
  if (canonicalTtsJson(header(current)) !== canonicalTtsJson(header(incoming))) {
    throw UsageError(`TTS resume found conflicting immutable render evidence for ${incoming.renderIdentity}.`)
  }
}

const appendEventsToExistingRender = (
  currentRender: Render,
  incomingRender: Render,
  readinessSequenceByIncoming: ReadonlyMap<number, number>,
  eventSequenceByIncoming: Map<string, number>
): void => {
  assertMatchingRenderHeader(currentRender, incomingRender)
  const remappedIncomingEvents = incomingRender.events.map((event) => remapEventReadiness(event, readinessSequenceByIncoming))
  const hasBootstrapMissing = remappedIncomingEvents[0]?.status === 'missing'
  if (hasBootstrapMissing) {
    eventSequenceByIncoming.set(
      `${incomingRender.renderIdentity}\0${incomingRender.events[0]?.sequence as number}`,
      currentRender.events.find((event) => event.status === 'missing')?.sequence ?? 1
    )
  }
  const incomingEventsToAppend = hasBootstrapMissing ? remappedIncomingEvents.slice(1) : remappedIncomingEvents
  const overlap = suffixPrefixOverlap(
    currentRender.events.map(withoutSequence),
    incomingEventsToAppend.map(withoutSequence)
  )
  const overlapStart = currentRender.events.length - overlap
  let sequence = nextSequence(currentRender.events)
  for (const [index, event] of incomingEventsToAppend.entries()) {
    const sourceEvent = incomingRender.events[index + (hasBootstrapMissing ? 1 : 0)] as RenderEvent
    if (index < overlap) {
      eventSequenceByIncoming.set(
        `${incomingRender.renderIdentity}\0${sourceEvent.sequence}`,
        (currentRender.events[overlapStart + index] as RenderEvent).sequence
      )
      continue
    }
    eventSequenceByIncoming.set(`${incomingRender.renderIdentity}\0${sourceEvent.sequence}`, sequence)
    currentRender.events.push({ ...event, sequence: sequence++ })
  }
}

const mergeRenderHistory = (
  current: readonly Render[],
  incoming: readonly Render[],
  readinessSequenceByIncoming: ReadonlyMap<number, number>
): { renderHistory: Render[], eventSequenceByIncoming: Map<string, number> } => {
  const renderHistory = current.map((render) => ({ ...render, events: [...render.events] }))
  const eventSequenceByIncoming = new Map<string, number>()
  for (const incomingRender of incoming) {
    const currentRender = renderHistory.find((render) => render.renderIdentity === incomingRender.renderIdentity)
    if (currentRender) {
      appendEventsToExistingRender(currentRender, incomingRender, readinessSequenceByIncoming, eventSequenceByIncoming)
      continue
    }
    const events = incomingRender.events.map((incomingEvent, index) => {
      const event = remapEventReadiness(incomingEvent, readinessSequenceByIncoming)
      const sequence = index + 1
      eventSequenceByIncoming.set(`${incomingRender.renderIdentity}\0${incomingEvent.sequence}`, sequence)
      return { ...event, sequence }
    })
    renderHistory.push({ ...incomingRender, events })
  }
  return { renderHistory, eventSequenceByIncoming }
}

const pointerIdentity = (event: PointerEvent): string => {
  if (event.action === 'activate-branch') return canonicalTtsJson({ action: event.action, branchPlanId: event.branchPlanId })
  if (event.action === 'project-branch-readiness') return canonicalTtsJson({ action: event.action, branchPlanId: event.branchPlanId, readinessAttemptSequence: event.readinessAttemptSequence })
  if (event.action === 'activate-render') return canonicalTtsJson({ action: event.action, renderIdentity: event.renderIdentity, eventSequence: event.eventSequence })
  if (event.action === 'select-success') return canonicalTtsJson({ action: event.action, renderIdentity: event.renderIdentity, eventSequence: event.eventSequence, resultIdentity: event.resultIdentity, audioRunId: event.audioRunId })
  return canonicalTtsJson(withoutSequence(event))
}

const remapPointerEvents = (
  incoming: CanonicalAudioProviderProjection,
  readinessSequenceByIncoming: ReadonlyMap<number, number>,
  eventSequenceByIncoming: ReadonlyMap<string, number>
): PointerEvent[] => incoming.pointerEvents.map((event) => {
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
  } as PointerEvent
})

const mergePointerHistory = (
  current: CanonicalAudioProviderProjection,
  incoming: CanonicalAudioProviderProjection,
  branchesWithNewReadiness: ReadonlySet<string>,
  readinessSequenceByIncoming: ReadonlyMap<number, number>,
  eventSequenceByIncoming: ReadonlyMap<string, number>
): PointerEvent[] => {
  const pointerEvents = [...current.pointerEvents]
  let sequence = nextSequence(pointerEvents)
  const incomingPointers = remapPointerEvents(incoming, readinessSequenceByIncoming, eventSequenceByIncoming)
  const existingOccurrences = new Map<string, number>()
  for (const event of pointerEvents) {
    const identity = pointerIdentity(event)
    existingOccurrences.set(identity, (existingOccurrences.get(identity) ?? 0) + 1)
  }
  const incomingOccurrences = new Map<string, number>()
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
  for (const event of incomingPointers) {
    const identity = pointerIdentity(event)
    const occurrence = (incomingOccurrences.get(identity) ?? 0) + 1
    incomingOccurrences.set(identity, occurrence)
    const existingCount = existingOccurrences.get(identity) ?? 0
    const isBranchReactivation = event.action === 'activate-branch'
      && branchesWithNewReadiness.has(event.branchPlanId)
      && !reactivatedBranches.has(event.branchPlanId)
    const isRenderReactivation = event.action === 'activate-render'
      && branchesWithNewReadiness.size > 0
      && identity === incomingActiveRenderPointerIdentity
      && !reactivatedRender
    if (occurrence <= existingCount && !isBranchReactivation && !isRenderReactivation) continue
    pointerEvents.push({ ...event, sequence: sequence++ } as PointerEvent)
    existingOccurrences.set(identity, Math.max(occurrence, existingCount + 1))
    if (isBranchReactivation && event.action === 'activate-branch') reactivatedBranches.add(event.branchPlanId)
    if (isRenderReactivation) reactivatedRender = true
  }
  return pointerEvents
}

const remapTerminalState = (
  current: CanonicalAudioProviderProjection,
  incoming: CanonicalAudioProviderProjection,
  readinessSequenceByIncoming: ReadonlyMap<number, number>,
  eventSequenceByIncoming: ReadonlyMap<string, number>
): Pick<CanonicalAudioProviderProjection, 'activeWork' | 'selectedSuccess' | 'archive'> => {
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
    ...(archive ? { archive } : {})
  }
}

export const appendCurrentTtsProjection = (
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

  const branchHistory = mergeBranchHistory(current.branchHistory, incoming.branchHistory)
  const readiness = mergeReadinessHistory(current.readinessAttempts, incoming.readinessAttempts)
  const renders = mergeRenderHistory(current.renderHistory, incoming.renderHistory, readiness.readinessSequenceByIncoming)
  const pointerEvents = mergePointerHistory(
    current,
    incoming,
    readiness.branchesWithNewReadiness,
    readiness.readinessSequenceByIncoming,
    renders.eventSequenceByIncoming
  )
  return {
    ...remapTerminalState(current, incoming, readiness.readinessSequenceByIncoming, renders.eventSequenceByIncoming),
    branchHistory,
    readinessAttempts: readiness.readinessAttempts,
    renderHistory: renders.renderHistory,
    pointerEvents
  }
}
