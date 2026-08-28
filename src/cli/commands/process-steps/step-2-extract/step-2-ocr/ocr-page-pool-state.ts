import type { OcrPoolAttemptUsage, OcrPoolClaim, OcrPoolClassifiedFailure, OcrPoolLaneState, OcrPoolLedger, OcrPoolPageAttempt, OcrPoolPageLedgerEntry, OcrPoolProcessedPage, OcrPoolState, OcrPoolTargetState, OcrTarget, RunOcrPagePoolOptions } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { getOcrTargetKey } from './ocr-run-state'
import { normalizePositiveInt } from '~/utils/value-helpers'

const invariantError = (message: string): Error =>
  InfraError(`OCR page-pool invariant failed: ${message}`, { stage: 'ocr:page-pool' })

const targetKeyFromAttempt = (attempt: Pick<OcrPoolPageAttempt, 'provider' | 'model'>): string =>
  getOcrTargetKey({ service: attempt.provider, model: attempt.model })

const copyUsage = (usage: OcrPoolAttemptUsage): OcrPoolAttemptUsage => ({
  ...(typeof usage.requestedReasoningEffort === 'string' ? { requestedReasoningEffort: usage.requestedReasoningEffort } : {}),
  ...(typeof usage.effectiveReasoningEffort === 'string' ? { effectiveReasoningEffort: usage.effectiveReasoningEffort } : {}),
  ...(typeof usage.promptTokens === 'number' ? { promptTokens: usage.promptTokens } : {}),
  ...(typeof usage.completionTokens === 'number' ? { completionTokens: usage.completionTokens } : {}),
  ...(typeof usage.providerCostCents === 'number' ? { providerCostCents: usage.providerCostCents } : {}),
  ...(typeof usage.providerCostSource === 'string' ? { providerCostSource: usage.providerCostSource } : {}),
  ...(usage.providerUsage ? { providerUsage: usage.providerUsage } : {})
})

const buildInitialTelemetry = (): OcrPoolLedger['telemetry'] => ({
  queueDepth: 0,
  queueDepthPeak: 0,
  claims: 0,
  acceptedPages: 0,
  requeues: 0,
  handoffs: 0,
  exhaustedPages: 0,
  duplicateCommitsPrevented: 0,
  ambiguousAttempts: 0,
  interruptedClaimsRecovered: 0,
  retiredTargets: [],
  retiredLanes: [],
  retryPressure: 0,
  pauseTimeMs: 0,
  targetActivePeaks: {},
  laneCaps: {},
  targetPageShare: {},
  targetThroughputPagesPerMinute: {}
})

const recoveredInterruptedClaimCount = (restored: OcrPoolLedger | undefined): number =>
  restored?.pages.reduce((count, page) =>
    count + (page.status === 'claimed' && page.attempts.some((attempt) =>
      attempt.claimId === page.claim?.claimId && attempt.status === 'running'
    ) ? 1 : 0), 0) ?? 0

const restorePages = (
  totalPages: number,
  restored: OcrPoolLedger | undefined,
  now: number
): OcrPoolPageLedgerEntry[] => {
  const restoredByPage = new Map(restored?.pages.map((page) => [page.pageNumber, structuredClone(page)]) ?? [])
  return Array.from({ length: totalPages }, (_, index): OcrPoolPageLedgerEntry => {
    const pageNumber = index + 1
    const existing = restoredByPage.get(pageNumber)
    if (!existing) return { pageNumber, status: 'pending', attempts: [] }
    if (existing.status === 'accepted' && existing.accepted) return existing
    if (existing.status === 'claimed') {
      const running = existing.attempts.find((attempt) =>
        attempt.claimId === existing.claim?.claimId && attempt.status === 'running'
      )
      if (running) {
        running.status = 'interrupted'
        running.finishedAtMs = now
        running.durationMs = Math.max(0, now - running.startedAtMs)
        running.failureScope = 'page'
        running.failure = { category: 'interrupted', message: 'The process stopped while this page claim was in flight.' }
      }
    }
    return { ...existing, status: 'pending', claim: undefined, accepted: undefined }
  })
}

const restoreTargets = (
  options: RunOcrPagePoolOptions
): OcrPoolTargetState[] => {
  const restoredByKey = new Map(options.restoredLedger?.targets.map((target) => [target.targetKey, target]) ?? [])
  return options.requestedTargets.map((target): OcrPoolTargetState => {
    const targetKey = getOcrTargetKey(target)
    const previous = restoredByKey.get(targetKey)
    return {
      service: target.service,
      model: target.model,
      targetKey,
      laneKey: options.getLaneKey(target),
      local: target.service === 'tesseract',
      status: previous?.status === 'retired' ? 'retired' : 'eligible',
      attempts: previous?.attempts ?? 0,
      acceptedPages: previous?.acceptedPages ?? 0,
      active: 0,
      activePeak: previous?.activePeak ?? 0,
      ...(previous?.lastFailure ? { lastFailure: previous.lastFailure } : {})
    }
  })
}

const restoreLanes = (
  options: RunOcrPagePoolOptions,
  targets: OcrPoolTargetState[],
  targetByKey: Map<string, OcrTarget>
): OcrPoolLaneState[] => {
  const restoredByKey = new Map(options.restoredLedger?.lanes.map((lane) => [lane.laneKey, lane]) ?? [])
  const lanes = new Map<string, OcrPoolLaneState>()
  for (const target of targets) {
    const targetValue = targetByKey.get(target.targetKey)
    const existing = lanes.get(target.laneKey)
    if (existing) {
      if (targetValue) existing.cap = Math.max(existing.cap, normalizePositiveInt(options.getTargetConcurrency(targetValue)))
      continue
    }
    const previous = restoredByKey.get(target.laneKey)
    lanes.set(target.laneKey, {
      laneKey: target.laneKey,
      service: target.service,
      local: target.local,
      cap: targetValue ? normalizePositiveInt(options.getTargetConcurrency(targetValue)) : previous?.cap ?? 1,
      status: previous?.status === 'retired' ? 'retired' : 'eligible',
      active: 0,
      activePeak: previous?.activePeak ?? 0,
      ...(previous?.lastFailure ? { lastFailure: previous.lastFailure } : {})
    })
  }
  return [...lanes.values()]
}

const restoreTelemetry = (
  restored: OcrPoolLedger | undefined,
  interruptedClaims: number
): OcrPoolLedger['telemetry'] => ({
  ...buildInitialTelemetry(),
  ...(restored
    ? {
        queueDepthPeak: restored.telemetry.queueDepthPeak,
        claims: restored.telemetry.claims,
        acceptedPages: restored.telemetry.acceptedPages,
        requeues: restored.telemetry.requeues,
        handoffs: restored.telemetry.handoffs,
        duplicateCommitsPrevented: restored.telemetry.duplicateCommitsPrevented,
        ambiguousAttempts: restored.telemetry.ambiguousAttempts,
        interruptedClaimsRecovered: restored.telemetry.interruptedClaimsRecovered + interruptedClaims,
        retiredTargets: [...restored.telemetry.retiredTargets],
        retiredLanes: [...restored.telemetry.retiredLanes],
        retryPressure: restored.telemetry.retryPressure,
        pauseTimeMs: restored.telemetry.pauseTimeMs,
        targetActivePeaks: { ...restored.telemetry.targetActivePeaks },
        laneCaps: { ...restored.telemetry.laneCaps },
        targetPageShare: { ...restored.telemetry.targetPageShare },
        targetThroughputPagesPerMinute: { ...restored.telemetry.targetThroughputPagesPerMinute },
        ...(restored.telemetry.gatingTarget ? { gatingTarget: restored.telemetry.gatingTarget } : {})
      }
    : {})
})

const refreshLedgerTelemetry = (ledger: OcrPoolLedger): void => {
  ledger.telemetry.queueDepth = ledger.pages.filter((page) => page.status === 'pending').length
  ledger.telemetry.queueDepthPeak = Math.max(ledger.telemetry.queueDepthPeak, ledger.telemetry.queueDepth)
  ledger.telemetry.acceptedPages = ledger.pages.filter((page) => page.status === 'accepted').length
  ledger.telemetry.exhaustedPages = ledger.pages.filter((page) => page.status === 'exhausted').length
  ledger.telemetry.retiredTargets = ledger.targets.filter((target) => target.status === 'retired').map((target) => target.targetKey).sort()
  ledger.telemetry.retiredLanes = ledger.lanes.filter((lane) => lane.status === 'retired').map((lane) => lane.laneKey).sort()
}

const wasHistoricallyAttempted = (page: OcrPoolPageLedgerEntry, targetKey: string): boolean =>
  page.attempts.some((attempt) =>
    attempt.status !== 'interrupted'
    && attempt.status !== 'running'
    && targetKeyFromAttempt(attempt) === targetKey
  )

const isOcrPoolTargetEligibleForPage = (
  state: OcrPoolState,
  page: OcrPoolPageLedgerEntry,
  targetKey: string
): boolean => {
  const target = state.targetStates.get(targetKey)
  const lane = target ? state.laneStates.get(target.laneKey) : undefined
  if (!target || !lane || !state.runnableKeys.has(targetKey) || target.status === 'retired' || lane.status === 'retired') return false
  if (state.attemptedThisRun.get(page.pageNumber)?.has(targetKey)) return false
  return state.reenabledKeys.has(targetKey) || !wasHistoricallyAttempted(page, targetKey)
}

const hasEligibleTarget = (state: OcrPoolState, page: OcrPoolPageLedgerEntry): boolean =>
  state.ledger.targets.some((target) => isOcrPoolTargetEligibleForPage(state, page, target.targetKey))

const assertPageInvariant = (page: OcrPoolPageLedgerEntry): void => {
  if (page.status === 'claimed') {
    const running = page.attempts.filter((attempt) => attempt.status === 'running' && attempt.claimId === page.claim?.claimId)
    if (!page.claim || running.length !== 1) throw invariantError(`page ${page.pageNumber} must have one current running claim`)
  } else if (page.claim) {
    throw invariantError(`page ${page.pageNumber} has a claim outside claimed status`)
  }
  if (page.status === 'accepted') {
    const acceptedAttempts = page.attempts.filter((attempt) => attempt.status === 'accepted')
    if (!page.accepted || acceptedAttempts.length > 1) throw invariantError(`page ${page.pageNumber} must have exactly one accepted result`)
  } else if (page.accepted) {
    throw invariantError(`page ${page.pageNumber} has accepted data outside accepted status`)
  }
}

const assertOcrPoolStateInvariants = (state: OcrPoolState): void => {
  for (const page of state.ledger.pages) assertPageInvariant(page)
  for (const lane of state.ledger.lanes) {
    const targetActive = state.ledger.targets
      .filter((target) => target.laneKey === lane.laneKey)
      .reduce((sum, target) => sum + target.active, 0)
    if (lane.active !== targetActive || lane.active < 0) throw invariantError(`lane ${lane.laneKey} active accounting diverged`)
  }
  const acceptedPages = state.ledger.pages.filter((page) => page.status === 'accepted').length
  const exhaustedPages = state.ledger.pages.filter((page) => page.status === 'exhausted').length
  if (state.ledger.telemetry.acceptedPages !== acceptedPages) throw invariantError('accepted-page telemetry diverged')
  if (state.ledger.telemetry.exhaustedPages !== exhaustedPages) throw invariantError('exhausted-page telemetry diverged')
}

export const reenableOcrPoolTarget = (state: OcrPoolState, targetKey: string): boolean => {
  const target = state.targetStates.get(targetKey)
  if (!target) return false
  const lane = state.laneStates.get(target.laneKey)
  if (!lane) throw invariantError(`target ${targetKey} references missing lane ${target.laneKey}`)
  if (lane.status === 'retired') {
    lane.status = 'eligible'
    delete lane.lastFailure
  }
  target.status = 'eligible'
  delete target.lastFailure
  refreshLedgerTelemetry(state.ledger)
  assertOcrPoolStateInvariants(state)
  return true
}

export const createOcrPoolState = (options: RunOcrPagePoolOptions): OcrPoolState => {
  const now = options.now ?? Date.now
  const startedAtMs = now()
  const totalPages = Math.max(1, Math.floor(options.totalPages))
  const targetByKey = new Map(options.requestedTargets.map((target) => [getOcrTargetKey(target), target]))
  const targets = restoreTargets(options)
  const lanes = restoreLanes(options, targets, targetByKey)
  const ledger: OcrPoolLedger = {
    mode: 'pool',
    totalPages,
    status: 'running',
    pages: restorePages(totalPages, options.restoredLedger, startedAtMs),
    targets,
    lanes,
    telemetry: restoreTelemetry(options.restoredLedger, recoveredInterruptedClaimCount(options.restoredLedger))
  }
  const state: OcrPoolState = {
    ledger,
    targetByKey,
    targetStates: new Map(targets.map((target) => [target.targetKey, target])),
    laneStates: new Map(lanes.map((lane) => [lane.laneKey, lane])),
    runnableKeys: new Set(options.targetsToRun.map(getOcrTargetKey)),
    reenabledKeys: new Set((options.reenabledTargets ?? []).map(getOcrTargetKey)),
    attemptedThisRun: new Map(),
    targetCaps: new Map(options.targetsToRun.map((target) => [getOcrTargetKey(target), normalizePositiveInt(options.getTargetConcurrency(target))])),
    acceptedThisRun: new Map(),
    startedAtMs,
    now,
    createClaimId: options.createClaimId ?? (() => crypto.randomUUID()),
    getAttemptArtifactDir: options.getAttemptArtifactDir
  }
  for (const key of state.reenabledKeys) reenableOcrPoolTarget(state, key)
  for (const page of ledger.pages) {
    if (page.status === 'exhausted' && hasEligibleTarget(state, page)) page.status = 'pending'
  }
  refreshLedgerTelemetry(ledger)
  for (const lane of lanes) ledger.telemetry.laneCaps[lane.laneKey] = lane.cap
  assertOcrPoolStateInvariants(state)
  return state
}

const peersWithCapacity = (
  state: OcrPoolState,
  admittedKeys: ReadonlySet<string>
): OcrPoolTargetState[] =>
  [...admittedKeys]
    .map((key) => state.targetStates.get(key))
    .filter((target): target is OcrPoolTargetState =>
      target !== undefined
      && target.status !== 'retired'
      && state.laneStates.get(target.laneKey)?.status !== 'retired'
      && target.active < (state.targetCaps.get(target.targetKey) ?? 1)
    )

export const claimOcrPoolPage = (
  state: OcrPoolState,
  target: OcrTarget,
  admittedKeys: ReadonlySet<string>
): OcrPoolClaim | undefined => {
  const targetKey = getOcrTargetKey(target)
  const targetState = state.targetStates.get(targetKey)
  const lane = targetState ? state.laneStates.get(targetState.laneKey) : undefined
  if (!targetState || !lane || targetState.status === 'retired' || lane.status === 'retired' || lane.active >= lane.cap) return undefined
  const lowestPeerActive = peersWithCapacity(state, admittedKeys).reduce(
    (lowest, peer) => Math.min(lowest, peer.active),
    Number.POSITIVE_INFINITY
  )
  if (targetState.active > lowestPeerActive) return undefined
  const page = state.ledger.pages.find((candidate) =>
    candidate.status === 'pending' && isOcrPoolTargetEligibleForPage(state, candidate, targetKey)
  )
  if (!page) return undefined
  const previousAttempt = page.attempts.at(-1)
  if (previousAttempt && targetKeyFromAttempt(previousAttempt) !== targetKey) state.ledger.telemetry.handoffs += 1
  const attemptNumber = page.attempts.length + 1
  const claimId = state.createClaimId()
  const claimedAtMs = state.now()
  const attempt: OcrPoolPageAttempt = {
    attempt: attemptNumber,
    claimId,
    provider: target.service,
    model: target.model,
    laneKey: lane.laneKey,
    status: 'running',
    startedAtMs: claimedAtMs,
    artifactDir: state.getAttemptArtifactDir(page.pageNumber, target, attemptNumber)
  }
  page.attempts.push(attempt)
  page.status = 'claimed'
  page.claim = { claimId, targetKey, laneKey: lane.laneKey, attempt: attemptNumber, claimedAtMs }
  const attempted = state.attemptedThisRun.get(page.pageNumber) ?? new Set<string>()
  attempted.add(targetKey)
  state.attemptedThisRun.set(page.pageNumber, attempted)
  targetState.status = 'running'
  targetState.attempts += 1
  targetState.active += 1
  targetState.activePeak = Math.max(targetState.activePeak, targetState.active)
  lane.active += 1
  lane.activePeak = Math.max(lane.activePeak, lane.active)
  state.ledger.telemetry.claims += 1
  refreshLedgerTelemetry(state.ledger)
  assertOcrPoolStateInvariants(state)
  return { page, attempt, target, targetState, lane }
}

const finishClaimActivity = (claim: OcrPoolClaim): void => {
  if (claim.targetState.active < 1 || claim.lane.active < 1) {
    throw invariantError(`claim ${claim.attempt.claimId} active accounting underflowed`)
  }
  claim.targetState.active -= 1
  claim.lane.active -= 1
}

const releaseRetiredClaims = (
  state: OcrPoolState,
  matches: (page: OcrPoolPageLedgerEntry) => boolean,
  finishedAtMs: number,
  classified: OcrPoolClassifiedFailure
): void => {
  for (const page of state.ledger.pages) {
    if (page.status !== 'claimed' || !page.claim || !matches(page)) continue
    const runningAttempt = page.attempts.find((attempt) =>
      attempt.claimId === page.claim?.claimId && attempt.status === 'running'
    )
    if (!runningAttempt) throw invariantError(`page ${page.pageNumber} is missing its running retirement claim`)
    runningAttempt.status = 'interrupted'
    runningAttempt.finishedAtMs = finishedAtMs
    runningAttempt.durationMs = Math.max(0, finishedAtMs - runningAttempt.startedAtMs)
    runningAttempt.failureScope = classified.scope
    runningAttempt.failure = classified.failure
    page.status = 'pending'
    delete page.claim
    state.ledger.telemetry.requeues += 1
  }
}

export const retireOcrPoolTarget = (
  state: OcrPoolState,
  targetKey: string,
  classified: OcrPoolClassifiedFailure,
  finishedAtMs: number
): void => {
  const target = state.targetStates.get(targetKey)
  if (!target) throw invariantError(`cannot retire missing target ${targetKey}`)
  target.status = 'retired'
  target.lastFailure = classified.failure
  releaseRetiredClaims(state, (page) => page.claim?.targetKey === targetKey, finishedAtMs, classified)
  refreshLedgerTelemetry(state.ledger)
  assertOcrPoolStateInvariants(state)
}

export const retireOcrPoolLane = (
  state: OcrPoolState,
  laneKey: string,
  classified: OcrPoolClassifiedFailure,
  finishedAtMs: number
): void => {
  const lane = state.laneStates.get(laneKey)
  if (!lane) throw invariantError(`cannot retire missing lane ${laneKey}`)
  lane.status = 'retired'
  lane.lastFailure = classified.failure
  for (const target of state.ledger.targets) {
    if (target.laneKey !== laneKey) continue
    target.status = 'retired'
    target.lastFailure = classified.failure
  }
  releaseRetiredClaims(state, (page) => page.claim?.laneKey === laneKey, finishedAtMs, classified)
  refreshLedgerTelemetry(state.ledger)
  assertOcrPoolStateInvariants(state)
}

export const recordOcrPoolClaimFailure = (
  state: OcrPoolState,
  claim: OcrPoolClaim,
  classified: OcrPoolClassifiedFailure,
  finishedAtMs: number
): void => {
  if (claim.attempt.status !== 'running' && claim.attempt.status !== 'interrupted') {
    throw invariantError(`claim ${claim.attempt.claimId} failed from ${claim.attempt.status} status`)
  }
  claim.attempt.status = classified.ambiguous ? 'ambiguous' : 'failed'
  claim.attempt.finishedAtMs = finishedAtMs
  claim.attempt.durationMs = Math.max(0, finishedAtMs - claim.attempt.startedAtMs)
  claim.attempt.failureScope = classified.scope
  claim.attempt.failure = classified.failure
  Object.assign(claim.attempt, copyUsage(classified))
  if (classified.ambiguous) state.ledger.telemetry.ambiguousAttempts += 1
  if (claim.page.status === 'claimed' && claim.page.claim?.claimId === claim.attempt.claimId && !claim.page.accepted) {
    claim.page.status = 'pending'
    delete claim.page.claim
    state.ledger.telemetry.requeues += 1
  }
  claim.targetState.lastFailure = classified.failure
  if (classified.scope === 'target') retireOcrPoolTarget(state, claim.targetState.targetKey, classified, finishedAtMs)
  if (classified.scope === 'lane') retireOcrPoolLane(state, claim.lane.laneKey, classified, finishedAtMs)
  finishClaimActivity(claim)
  refreshLedgerTelemetry(state.ledger)
  assertOcrPoolStateInvariants(state)
}

const currentClaimMatches = (claim: OcrPoolClaim): boolean =>
  claim.page.status === 'claimed'
  && claim.page.claim?.claimId === claim.attempt.claimId
  && claim.page.accepted === undefined

export const rejectStaleOcrPoolResult = (
  state: OcrPoolState,
  claim: OcrPoolClaim,
  processed: OcrPoolProcessedPage,
  finishedAtMs: number
): void => {
  if (currentClaimMatches(claim)) throw invariantError(`claim ${claim.attempt.claimId} is current and cannot be rejected as stale`)
  if (claim.attempt.status !== 'running' && claim.attempt.status !== 'interrupted') {
    throw invariantError(`claim ${claim.attempt.claimId} became stale from ${claim.attempt.status} status`)
  }
  claim.attempt.status = 'interrupted'
  claim.attempt.finishedAtMs = finishedAtMs
  claim.attempt.durationMs = Math.max(0, finishedAtMs - claim.attempt.startedAtMs)
  claim.attempt.failureScope ??= 'page'
  claim.attempt.failure ??= { category: 'stale-result', message: 'The page claim was no longer current when this response completed.' }
  Object.assign(claim.attempt, copyUsage(processed))
  state.ledger.telemetry.duplicateCommitsPrevented += 1
  finishClaimActivity(claim)
  refreshLedgerTelemetry(state.ledger)
  assertOcrPoolStateInvariants(state)
}

export const commitAcceptedOcrPoolResult = (
  state: OcrPoolState,
  claim: OcrPoolClaim,
  processed: OcrPoolProcessedPage,
  finishedAtMs: number
): void => {
  if (!currentClaimMatches(claim)) throw invariantError(`claim ${claim.attempt.claimId} is stale and cannot commit`)
  if (claim.attempt.status !== 'running') throw invariantError(`claim ${claim.attempt.claimId} committed outside running status`)
  claim.attempt.status = 'accepted'
  claim.attempt.finishedAtMs = finishedAtMs
  claim.attempt.durationMs = Math.max(0, finishedAtMs - claim.attempt.startedAtMs)
  Object.assign(claim.attempt, copyUsage(processed))
  claim.page.status = 'accepted'
  delete claim.page.claim
  claim.page.accepted = {
    provider: claim.target.service,
    model: claim.target.model,
    ...(processed.requestedReasoningEffort ? { requestedReasoningEffort: processed.requestedReasoningEffort } : {}),
    ...(processed.effectiveReasoningEffort ? { effectiveReasoningEffort: processed.effectiveReasoningEffort } : {}),
    attempt: claim.attempt.attempt,
    acceptedAtMs: finishedAtMs,
    durationMs: claim.attempt.durationMs,
    artifactDir: claim.attempt.artifactDir,
    result: { ...processed.result, pageNumber: claim.page.pageNumber },
    ...copyUsage(processed)
  }
  claim.targetState.acceptedPages += 1
  const accepted = state.acceptedThisRun.get(claim.targetState.targetKey)
  state.acceptedThisRun.set(claim.targetState.targetKey, {
    count: (accepted?.count ?? 0) + 1,
    lastAcceptedAtMs: Math.max(accepted?.lastAcceptedAtMs ?? state.startedAtMs, finishedAtMs)
  })
  finishClaimActivity(claim)
  refreshLedgerTelemetry(state.ledger)
  assertOcrPoolStateInvariants(state)
}

export const markOcrPoolTerminalPages = (state: OcrPoolState): void => {
  if (state.ledger.pages.some((page) => page.status === 'claimed')) return
  for (const page of state.ledger.pages) {
    if (page.status === 'pending' && !hasEligibleTarget(state, page)) page.status = 'exhausted'
  }
  refreshLedgerTelemetry(state.ledger)
  assertOcrPoolStateInvariants(state)
}

export const snapshotOcrPoolLedger = (state: OcrPoolState): OcrPoolLedger =>
  structuredClone(state.ledger)

export const finalizeOcrPoolLedger = (state: OcrPoolState): OcrPoolLedger => {
  const ledger = snapshotOcrPoolLedger(state)
  for (const target of ledger.targets) {
    if (target.status !== 'retired') target.status = 'succeeded'
    ledger.telemetry.targetActivePeaks[target.targetKey] = target.activePeak
    const acceptedPages = ledger.pages.filter((page) =>
      page.accepted && getOcrTargetKey({ service: page.accepted.provider, model: page.accepted.model }) === target.targetKey
    )
    const acceptedThisRun = state.acceptedThisRun.get(target.targetKey)
    const elapsedMs = acceptedThisRun ? acceptedThisRun.lastAcceptedAtMs - state.startedAtMs : 0
    ledger.telemetry.targetPageShare[target.targetKey] = ledger.totalPages > 0 ? acceptedPages.length / ledger.totalPages : 0
    ledger.telemetry.targetThroughputPagesPerMinute[target.targetKey] = acceptedThisRun && elapsedMs > 0
      ? acceptedThisRun.count / (elapsedMs / 60_000)
      : ledger.telemetry.targetThroughputPagesPerMinute[target.targetKey] ?? null
  }
  ledger.telemetry.gatingTarget = Object.entries(ledger.telemetry.targetThroughputPagesPerMinute)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]))[0]?.[0]
  refreshLedgerTelemetry(ledger)
  ledger.status = ledger.telemetry.acceptedPages === ledger.totalPages ? 'full' : 'incomplete'
  return ledger
}
