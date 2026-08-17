import { runProviderTargetScheduler } from '~/cli/commands/process-steps/provider-target-scheduler'
import type { IndexedOcrTarget, OcrPoolAttemptUsage, OcrPoolLaneState, OcrPoolLedger, OcrPoolPageAttempt, OcrPoolPageLedgerEntry, OcrPoolTargetState, OcrTarget, RunOcrPagePoolOptions, TargetSchedulerConcurrency } from '~/types'
import { getOcrTargetKey } from './ocr-run-state'
import { InfraError } from '~/utils/error-handler'
import { randomUUID } from 'node:crypto'
import { resolveHostedOcrLaneKey } from './ocr-utils/hosted-ocr-scheduler'

export const isLocalOcrTarget = (
  target: Pick<OcrTarget, 'service'>
): target is Pick<OcrTarget, 'service'> & { service: 'tesseract' } =>
  target.service === 'tesseract'

const getHostedOcrExecutionPriority = (target: OcrTarget): number => {
  if (target.service === 'kimi') return 90
  if (target.service === 'deepinfra') return 85
  if (target.service === 'anthropic') return 80
  if (target.service === 'gemini') return 75
  if (target.service === 'openai') return 70
  if (target.service === 'mistral') return 60
  if (target.service === 'glm') return 55
  return 0
}

const buildIndexedOcrTargetsToRun = (
  requestedTargets: OcrTarget[],
  targetsToRun: OcrTarget[]
): IndexedOcrTarget[] => {
  const availableIndicesByKey = new Map<string, number[]>()
  requestedTargets.forEach((target, index) => {
    const key = getOcrTargetKey(target)
    const indices = availableIndicesByKey.get(key) ?? []
    indices.push(index)
    availableIndicesByKey.set(key, indices)
  })

  return targetsToRun.flatMap((target) => {
    const indices = availableIndicesByKey.get(getOcrTargetKey(target))
    const index = indices?.shift()
    return index === undefined ? [] : [{ index, target }]
  })
}

export const runOcrProviderTargetPools = async (
  requestedTargets: OcrTarget[],
  targetsToRun: OcrTarget[],
  concurrency: TargetSchedulerConcurrency,
  worker: (index: number, target: OcrTarget) => Promise<void>
): Promise<void> => {
  const indexedTargets = buildIndexedOcrTargetsToRun(requestedTargets, targetsToRun)
  const scheduled = await runProviderTargetScheduler<IndexedOcrTarget, void>({
    entries: indexedTargets.map((entry) => ({
      index: entry.index,
      target: entry,
      priority: isLocalOcrTarget(entry.target) ? 0 : getHostedOcrExecutionPriority(entry.target)
    })),
    concurrency,
    getPool: (entry) => isLocalOcrTarget(entry.target) ? 'local' : 'hosted',
    runTarget: async (_index, entry) => {
      await worker(entry.index, entry.target)
    }
  })
  if (scheduled.failures.length > 0) {
    throw InfraError(scheduled.failures.map(({ target, message }) =>
      `${target.target.service}/${target.target.model}: ${message}`
    ).join('; '), { stage: 'ocr:pool' })
  }
}

const cloneLedger = (ledger: OcrPoolLedger): OcrPoolLedger => structuredClone(ledger)

const normalizePositiveInt = (value: number): number =>
  Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1

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

const buildRestoredPages = (
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

const buildTargetStates = (
  requestedTargets: OcrTarget[],
  getLaneKey: RunOcrPagePoolOptions['getLaneKey'],
  restored: OcrPoolLedger | undefined
): OcrPoolTargetState[] => {
  const restoredByKey = new Map(restored?.targets.map((target) => [target.targetKey, target]) ?? [])
  return requestedTargets.map((target): OcrPoolTargetState => {
    const targetKey = getOcrTargetKey(target)
    const previous = restoredByKey.get(targetKey)
    return {
      service: target.service,
      model: target.model,
      targetKey,
      laneKey: getLaneKey(target),
      local: isLocalOcrTarget(target),
      status: previous?.status === 'retired' ? 'retired' : 'eligible',
      attempts: previous?.attempts ?? 0,
      acceptedPages: previous?.acceptedPages ?? 0,
      active: 0,
      activePeak: previous?.activePeak ?? 0,
      ...(previous?.lastFailure ? { lastFailure: previous.lastFailure } : {})
    }
  })
}

const buildLaneStates = (
  targets: OcrPoolTargetState[],
  getTargetConcurrency: RunOcrPagePoolOptions['getTargetConcurrency'],
  targetByKey: Map<string, OcrTarget>,
  restored: OcrPoolLedger | undefined
): OcrPoolLaneState[] => {
  const restoredByKey = new Map(restored?.lanes.map((lane) => [lane.laneKey, lane]) ?? [])
  const lanes = new Map<string, OcrPoolLaneState>()
  for (const target of targets) {
    const existing = lanes.get(target.laneKey)
    const targetValue = targetByKey.get(target.targetKey)
    if (existing) {
      if (targetValue) existing.cap = Math.max(existing.cap, normalizePositiveInt(getTargetConcurrency(targetValue)))
      continue
    }
    const previous = restoredByKey.get(target.laneKey)
    lanes.set(target.laneKey, {
      laneKey: target.laneKey,
      service: target.service,
      local: target.local,
      cap: targetValue ? normalizePositiveInt(getTargetConcurrency(targetValue)) : previous?.cap ?? 1,
      status: previous?.status === 'retired' ? 'retired' : 'eligible',
      active: 0,
      activePeak: previous?.activePeak ?? 0,
      ...(previous?.lastFailure ? { lastFailure: previous.lastFailure } : {})
    })
  }
  return [...lanes.values()]
}

export const defaultOcrPoolLaneKey = (target: OcrTarget): string =>
  isLocalOcrTarget(target)
    ? 'local:tesseract'
    : resolveHostedOcrLaneKey(target.service as import('~/types').HostedOcrService)

export const runOcrPagePool = async (
  options: RunOcrPagePoolOptions
): Promise<OcrPoolLedger> => {
  const now = options.now ?? Date.now
  const createClaimId = options.createClaimId ?? randomUUID
  const totalPages = Math.max(1, Math.floor(options.totalPages))
  const targetByKey = new Map(options.requestedTargets.map((target) => [getOcrTargetKey(target), target]))
  const runnableKeys = new Set(options.targetsToRun.map(getOcrTargetKey))
  const reenabledKeys = new Set((options.reenabledTargets ?? []).map(getOcrTargetKey))
  const startedAtMs = now()
  const recoveredInterruptedClaims = options.restoredLedger?.pages.reduce((count, page) =>
    count + (page.status === 'claimed' && page.attempts.some((attempt) =>
      attempt.claimId === page.claim?.claimId && attempt.status === 'running'
    ) ? 1 : 0), 0) ?? 0
  const pages = buildRestoredPages(totalPages, options.restoredLedger, startedAtMs)
  const targets = buildTargetStates(options.requestedTargets, options.getLaneKey, options.restoredLedger)
  const targetStates = new Map(targets.map((target) => [target.targetKey, target]))
  const lanes = buildLaneStates(targets, options.getTargetConcurrency, targetByKey, options.restoredLedger)
  const laneStates = new Map(lanes.map((lane) => [lane.laneKey, lane]))
  for (const key of reenabledKeys) {
    const target = targetStates.get(key)
    if (!target) continue
    const lane = laneStates.get(target.laneKey)
    if (lane?.status === 'retired') {
      lane.status = 'eligible'
      delete lane.lastFailure
    }
    target.status = 'eligible'
    delete target.lastFailure
  }

  const telemetry = {
    ...buildInitialTelemetry(),
    ...(options.restoredLedger
      ? {
          queueDepthPeak: options.restoredLedger.telemetry.queueDepthPeak,
          claims: options.restoredLedger.telemetry.claims,
          acceptedPages: options.restoredLedger.telemetry.acceptedPages,
          requeues: options.restoredLedger.telemetry.requeues,
          handoffs: options.restoredLedger.telemetry.handoffs,
          duplicateCommitsPrevented: options.restoredLedger.telemetry.duplicateCommitsPrevented,
          ambiguousAttempts: options.restoredLedger.telemetry.ambiguousAttempts,
          interruptedClaimsRecovered: options.restoredLedger.telemetry.interruptedClaimsRecovered + recoveredInterruptedClaims,
          retiredTargets: [...options.restoredLedger.telemetry.retiredTargets],
          retiredLanes: [...options.restoredLedger.telemetry.retiredLanes],
          retryPressure: options.restoredLedger.telemetry.retryPressure,
          pauseTimeMs: options.restoredLedger.telemetry.pauseTimeMs,
          targetActivePeaks: { ...options.restoredLedger.telemetry.targetActivePeaks },
          laneCaps: { ...options.restoredLedger.telemetry.laneCaps },
          targetPageShare: { ...options.restoredLedger.telemetry.targetPageShare },
          targetThroughputPagesPerMinute: { ...options.restoredLedger.telemetry.targetThroughputPagesPerMinute },
          ...(options.restoredLedger.telemetry.gatingTarget ? { gatingTarget: options.restoredLedger.telemetry.gatingTarget } : {})
        }
      : {})
  }
  const ledger: OcrPoolLedger = {
    mode: 'pool',
    totalPages,
    status: 'running',
    pages,
    targets,
    lanes,
    telemetry
  }
  const attemptedThisRun = new Map<number, Set<string>>()
  const targetCaps = new Map(options.targetsToRun.map((target) => [
    getOcrTargetKey(target),
    normalizePositiveInt(options.getTargetConcurrency(target))
  ]))
  const acceptedThisRun = new Map<string, { count: number, lastAcceptedAtMs: number }>()
  const admittedKeys = new Set<string>()
  let checkpointWrite = Promise.resolve()
  let stateGeneration = 0
  const waiters = new Set<() => void>()

  const notifyStateChange = (): void => {
    stateGeneration += 1
    for (const resolve of waiters) resolve()
    waiters.clear()
  }
  const waitForStateChange = async (generation: number): Promise<void> => {
    if (generation !== stateGeneration) return
    await new Promise<void>((resolve) => waiters.add(resolve))
  }
  const persist = async (): Promise<void> => {
    if (!options.onCheckpoint) return
    const snapshot = cloneLedger(ledger)
    checkpointWrite = checkpointWrite.then(async () => await options.onCheckpoint?.(snapshot))
    await checkpointWrite
  }
  const updateQueueTelemetry = (): void => {
    telemetry.queueDepth = pages.filter((page) => page.status === 'pending').length
    telemetry.queueDepthPeak = Math.max(telemetry.queueDepthPeak, telemetry.queueDepth)
    telemetry.acceptedPages = pages.filter((page) => page.status === 'accepted').length
    telemetry.exhaustedPages = pages.filter((page) => page.status === 'exhausted').length
    telemetry.retiredTargets = targets.filter((target) => target.status === 'retired').map((target) => target.targetKey).sort()
    telemetry.retiredLanes = lanes.filter((lane) => lane.status === 'retired').map((lane) => lane.laneKey).sort()
  }
  const wasHistoricallyAttempted = (page: OcrPoolPageLedgerEntry, targetKey: string): boolean =>
    page.attempts.some((attempt) =>
      attempt.status !== 'interrupted'
      && attempt.status !== 'running'
      && targetKeyFromAttempt(attempt) === targetKey
    )
  const isTargetEligibleForPage = (page: OcrPoolPageLedgerEntry, targetKey: string): boolean => {
    const target = targetStates.get(targetKey)
    const lane = target ? laneStates.get(target.laneKey) : undefined
    if (!target || !lane || !runnableKeys.has(targetKey) || target.status === 'retired' || lane.status === 'retired') return false
    if (attemptedThisRun.get(page.pageNumber)?.has(targetKey)) return false
    return reenabledKeys.has(targetKey) || !wasHistoricallyAttempted(page, targetKey)
  }
  const hasEligibleTarget = (page: OcrPoolPageLedgerEntry): boolean =>
    options.targetsToRun.some((target) => isTargetEligibleForPage(page, getOcrTargetKey(target)))
  const markTerminalPages = (): void => {
    const hasActiveClaims = pages.some((page) => page.status === 'claimed')
    if (hasActiveClaims) return
    for (const page of pages) {
      if (page.status === 'pending' && !hasEligibleTarget(page)) page.status = 'exhausted'
    }
    updateQueueTelemetry()
  }

  for (const page of pages) {
    if (page.status === 'exhausted' && hasEligibleTarget(page)) page.status = 'pending'
  }
  updateQueueTelemetry()
  for (const lane of lanes) telemetry.laneCaps[lane.laneKey] = lane.cap

  const claimPage = (target: OcrTarget): { page: OcrPoolPageLedgerEntry, attempt: OcrPoolPageAttempt } | undefined => {
    const targetKey = getOcrTargetKey(target)
    const targetState = targetStates.get(targetKey)
    const lane = targetState ? laneStates.get(targetState.laneKey) : undefined
    if (!targetState || !lane || targetState.status === 'retired' || lane.status === 'retired' || lane.active >= lane.cap) return undefined
    const peersWithCapacity = [...admittedKeys]
      .map((key) => targetStates.get(key))
      .filter((state): state is OcrPoolTargetState =>
        state !== undefined
        && state.status !== 'retired'
        && laneStates.get(state.laneKey)?.status !== 'retired'
        && state.active < (targetCaps.get(state.targetKey) ?? 1)
      )
    const lowestPeerActive = peersWithCapacity.reduce(
      (lowest, state) => Math.min(lowest, state.active),
      Number.POSITIVE_INFINITY
    )
    if (targetState.active > lowestPeerActive) return undefined
    const page = pages.find((candidate) => candidate.status === 'pending' && isTargetEligibleForPage(candidate, targetKey))
    if (!page) return undefined
    const previousAttempt = page.attempts.at(-1)
    if (previousAttempt && targetKeyFromAttempt(previousAttempt) !== targetKey) telemetry.handoffs += 1
    const attemptNumber = page.attempts.length + 1
    const claimId = createClaimId()
    const claimedAtMs = now()
    const artifactDir = options.getAttemptArtifactDir(page.pageNumber, target, attemptNumber)
    const attempt: OcrPoolPageAttempt = {
      attempt: attemptNumber,
      claimId,
      provider: target.service,
      model: target.model,
      laneKey: lane.laneKey,
      status: 'running',
      startedAtMs: claimedAtMs,
      artifactDir
    }
    page.attempts.push(attempt)
    page.status = 'claimed'
    page.claim = { claimId, targetKey, laneKey: lane.laneKey, attempt: attemptNumber, claimedAtMs }
    const attempted = attemptedThisRun.get(page.pageNumber) ?? new Set<string>()
    attempted.add(targetKey)
    attemptedThisRun.set(page.pageNumber, attempted)
    targetState.status = 'running'
    targetState.attempts += 1
    targetState.active += 1
    targetState.activePeak = Math.max(targetState.activePeak, targetState.active)
    lane.active += 1
    lane.activePeak = Math.max(lane.activePeak, lane.active)
    telemetry.claims += 1
    updateQueueTelemetry()
    notifyStateChange()
    return { page, attempt }
  }

  const finishActive = (targetState: OcrPoolTargetState, lane: OcrPoolLaneState): void => {
    targetState.active = Math.max(0, targetState.active - 1)
    lane.active = Math.max(0, lane.active - 1)
  }

  const runClaim = async (target: OcrTarget, claimed: { page: OcrPoolPageLedgerEntry, attempt: OcrPoolPageAttempt }): Promise<void> => {
    const { page, attempt } = claimed
    const targetKey = getOcrTargetKey(target)
    const targetState = targetStates.get(targetKey) as OcrPoolTargetState
    const lane = laneStates.get(targetState.laneKey) as OcrPoolLaneState
    await persist()
    let processed: Awaited<ReturnType<RunOcrPagePoolOptions['processPage']>>
    try {
      processed = await options.processPage({
        pageNumber: page.pageNumber,
        target,
        attempt: attempt.attempt,
        claimId: attempt.claimId,
        artifactDir: attempt.artifactDir
      })
    } catch (error) {
      const classified = options.classifyFailure(error, target)
      const finishedAtMs = now()
      attempt.status = classified.ambiguous ? 'ambiguous' : 'failed'
      attempt.finishedAtMs = finishedAtMs
      attempt.durationMs = Math.max(0, finishedAtMs - attempt.startedAtMs)
      attempt.failureScope = classified.scope
      attempt.failure = classified.failure
      Object.assign(attempt, copyUsage(classified))
      if (classified.ambiguous) telemetry.ambiguousAttempts += 1
      if (page.status === 'claimed' && page.claim?.claimId === attempt.claimId && !page.accepted) {
        page.status = 'pending'
        delete page.claim
        telemetry.requeues += 1
      }
      const releaseRetiredClaims = (matches: (candidate: OcrPoolPageLedgerEntry) => boolean): void => {
        for (const candidate of pages) {
          if (candidate.status !== 'claimed' || !candidate.claim || !matches(candidate)) continue
          const runningAttempt = candidate.attempts.find((entry) =>
            entry.claimId === candidate.claim?.claimId && entry.status === 'running'
          )
          if (runningAttempt) {
            runningAttempt.status = 'interrupted'
            runningAttempt.finishedAtMs = finishedAtMs
            runningAttempt.durationMs = Math.max(0, finishedAtMs - runningAttempt.startedAtMs)
            runningAttempt.failureScope = classified.scope
            runningAttempt.failure = classified.failure
          }
          candidate.status = 'pending'
          delete candidate.claim
          telemetry.requeues += 1
        }
      }
      targetState.lastFailure = classified.failure
      if (classified.scope === 'target') {
        targetState.status = 'retired'
        releaseRetiredClaims((candidate) => candidate.claim?.targetKey === targetKey)
      } else if (classified.scope === 'lane') {
        lane.status = 'retired'
        lane.lastFailure = classified.failure
        for (const laneTarget of targets) {
          if (laneTarget.laneKey === lane.laneKey) {
            laneTarget.status = 'retired'
            laneTarget.lastFailure = classified.failure
          }
        }
        releaseRetiredClaims((candidate) => candidate.claim?.laneKey === lane.laneKey)
      }
      finishActive(targetState, lane)
      markTerminalPages()
      updateQueueTelemetry()
      notifyStateChange()
      await persist()
      return
    }

    const finishedAtMs = now()
    if (page.status !== 'claimed' || page.claim?.claimId !== attempt.claimId || page.accepted) {
      attempt.status = 'interrupted'
      attempt.finishedAtMs = finishedAtMs
      attempt.durationMs = Math.max(0, finishedAtMs - attempt.startedAtMs)
      attempt.failureScope ??= 'page'
      attempt.failure ??= { category: 'stale-result', message: 'The page claim was no longer current when this response completed.' }
      Object.assign(attempt, copyUsage(processed))
      telemetry.duplicateCommitsPrevented += 1
      finishActive(targetState, lane)
      notifyStateChange()
      await persist()
      return
    }
    attempt.status = 'accepted'
    attempt.finishedAtMs = finishedAtMs
    attempt.durationMs = Math.max(0, finishedAtMs - attempt.startedAtMs)
    Object.assign(attempt, copyUsage(processed))
    page.status = 'accepted'
    delete page.claim
    page.accepted = {
      provider: target.service,
      model: target.model,
      ...(processed.requestedReasoningEffort ? { requestedReasoningEffort: processed.requestedReasoningEffort } : {}),
      ...(processed.effectiveReasoningEffort ? { effectiveReasoningEffort: processed.effectiveReasoningEffort } : {}),
      attempt: attempt.attempt,
      acceptedAtMs: finishedAtMs,
      durationMs: attempt.durationMs,
      artifactDir: attempt.artifactDir,
      result: { ...processed.result, pageNumber: page.pageNumber },
      ...copyUsage(processed)
    }
    targetState.acceptedPages += 1
    const acceptedRunState = acceptedThisRun.get(targetKey)
    acceptedThisRun.set(targetKey, {
      count: (acceptedRunState?.count ?? 0) + 1,
      lastAcceptedAtMs: Math.max(acceptedRunState?.lastAcceptedAtMs ?? startedAtMs, finishedAtMs)
    })
    finishActive(targetState, lane)
    updateQueueTelemetry()
    notifyStateChange()
    await persist()
  }

  const runTarget = async (target: OcrTarget): Promise<void> => {
    const concurrency = normalizePositiveInt(options.getTargetConcurrency(target))
    const targetKey = getOcrTargetKey(target)
    admittedKeys.add(targetKey)
    notifyStateChange()
    await Promise.resolve()
    const runWorker = async (): Promise<void> => {
      while (true) {
        const generation = stateGeneration
        const claimed = claimPage(target)
        if (claimed) {
          await runClaim(target, claimed)
          continue
        }
        const targetState = targetStates.get(getOcrTargetKey(target))
        const lane = targetState ? laneStates.get(targetState.laneKey) : undefined
        if (!targetState || !lane || targetState.status === 'retired' || lane.status === 'retired') return
        const activeClaims = pages.some((page) => page.status === 'claimed')
        if (!activeClaims) return
        await waitForStateChange(generation)
      }
    }
    try {
      await Promise.all(Array.from({ length: concurrency }, runWorker))
    } finally {
      admittedKeys.delete(targetKey)
      notifyStateChange()
    }
  }

  await persist()
  const scheduled = await runProviderTargetScheduler<IndexedOcrTarget, void>({
    entries: buildIndexedOcrTargetsToRun(options.requestedTargets, options.targetsToRun).map((entry) => ({
      index: entry.index,
      target: entry,
      priority: isLocalOcrTarget(entry.target) ? 0 : getHostedOcrExecutionPriority(entry.target)
    })),
    concurrency: { provider: options.providerConcurrency, local: options.localConcurrency },
    getPool: (entry) => isLocalOcrTarget(entry.target) ? 'local' : 'hosted',
    runTarget: async (_index, entry) => await runTarget(entry.target)
  })
  if (scheduled.failures.length > 0) {
    throw InfraError(scheduled.failures.map((failure) => failure.message).join('; '), { stage: 'ocr:page-pool' })
  }

  markTerminalPages()
  for (const target of targets) {
    if (target.status !== 'retired') target.status = 'succeeded'
    telemetry.targetActivePeaks[target.targetKey] = target.activePeak
    const accepted = pages.filter((page) => page.accepted && getOcrTargetKey({
      service: page.accepted.provider,
      model: page.accepted.model
    }) === target.targetKey)
    const acceptedRunState = acceptedThisRun.get(target.targetKey)
    const elapsedMs = acceptedRunState
      ? acceptedRunState.lastAcceptedAtMs - startedAtMs
      : 0
    telemetry.targetPageShare[target.targetKey] = totalPages > 0 ? accepted.length / totalPages : 0
    telemetry.targetThroughputPagesPerMinute[target.targetKey] = acceptedRunState && elapsedMs > 0
      ? acceptedRunState.count / (elapsedMs / 60_000)
      : options.restoredLedger?.telemetry.targetThroughputPagesPerMinute[target.targetKey] ?? null
  }
  telemetry.gatingTarget = Object.entries(telemetry.targetThroughputPagesPerMinute)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]))[0]?.[0]
  updateQueueTelemetry()
  ledger.status = telemetry.acceptedPages === totalPages ? 'full' : 'incomplete'
  await persist()
  return cloneLedger(ledger)
}
