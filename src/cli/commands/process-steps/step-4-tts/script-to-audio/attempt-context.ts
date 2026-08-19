import { readdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import type {
  AccountCapabilityObservation,
  CanonicalAudioProviderProjection,
  ProviderBatchResult,
  ProviderReadinessResult,
  RenderAdmissionJournalSnapshot,
  AttemptContext,
  AttemptSlot,
  CreateCurrentTtsRenderAttemptOptions,
  CurrentTtsRecoveredGenerationSlot,
  ReadinessAuthorization,
  WrittenJson,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import {
  computePaidSpeechSlotHash,
  hashCanonicalTtsValue,
} from './contract-identity'
import {
  validateAccountCapabilityObservation,
  validateRenderAdmissionJournalSnapshot,
} from './contract-validation'
import {
  resolveStableTtsArtifactDir,
  resolveTtsOutputLayout,
} from './tts-output-layout'
import {
  LOCAL_ACTOR,
  withIdentity,
} from './attempt-shared'
import {
  contained,
  materializeRecoveredBatch,
  writeJsonCreateOnly,
  writeTextCreateOnly,
} from './attempt-io'
import {
  bindingIdentityHash,
  buildPureCurrentTtsRenderPlan,
  requestedOutput,
  stateForProjection,
  sumCosts,
} from './attempt-planning'
export const createAttemptContext = async (
  options: CreateCurrentTtsRenderAttemptOptions
): Promise<AttemptContext> => {
  const now = options.now ?? (() => new Date().toISOString())
  const purePlan = buildPureCurrentTtsRenderPlan(options)
  const {
    transport,
    targetKey,
    capability,
    capabilityFixtureHash,
    capabilityScopeHash,
    planned,
    voiceContextKey,
    outputProfileHash,
    synthesisSettingsHash,
    branchCandidate,
    branchPlan,
    strategyArtifacts,
    renderPlanId,
    renderIdentity,
    renderPlan,
  } = purePlan
  const artifactRoot = options.artifactRoot ?? (options.comicContext ? 'audio/providers' : 'providers')
  const compactArchive = Boolean(options.comicContext) || artifactRoot.replace(/\/+$/, '') === 'audio/providers'
  const layout = resolveTtsOutputLayout(artifactRoot, targetKey, renderIdentity)
  const targetRelativeDir = resolveStableTtsArtifactDir(artifactRoot, targetKey)
  const archiveRelativeDir = layout.artifactDir
  const targetDir = `${options.outputDir}/${targetRelativeDir}`
  const journalRelativePath = `${targetRelativeDir}/renders/${renderIdentity}/journal.jsonl`
  const paidSpeechSlotHash = (slot: AttemptSlot): string => slot.slotHash ?? computePaidSpeechSlotHash({
    dialoguePlanId: planned.dialoguePlan.dialoguePlanId,
    turnIds: slot.turnIds,
    providerText: slot.providerText,
    serializedVoiceHash: hashCanonicalTtsValue(slot.turnIds.map((turnId) => planned.turns.find((turn) => turn.canonical.turnId === turnId)?.voice.valueHash ?? '')),
    requestControlsHash: slot.expectedRequestControlsHash,
    outputFormat: requestedOutput(options),
    endpointKind: slot.expectedEndpointKind,
    serializerVersion: slot.expectedSerializerVersion,
  })
  for (const slot of planned.slots) slot.slotHash = paidSpeechSlotHash(slot)
  if ((options.recoveredSlots?.length ?? 0) > 0 && planned.strategy !== 'segmented') {
    throw CLIUsageError('Recovered TTS generation slots may seed only an immutable segmented render.')
  }
  const recoveredBySlot = new Map<string, CurrentTtsRecoveredGenerationSlot>()
  for (const recovered of options.recoveredSlots ?? []) {
    const slot = planned.slots.find((entry) => entry.generationSlotId === recovered.value.generationSlotId)
    if (
      !slot
      || recoveredBySlot.has(recovered.value.generationSlotId)
      || recovered.value.renderPlanId !== renderPlanId
      || recovered.value.renderIdentity !== renderIdentity
      || recovered.value.batchId !== slot.batchId
      || recovered.value.status !== 'succeeded'
      || recovered.value.outputs.length === 0
      || recovered.outputPaths.length !== recovered.value.outputs.length
    ) throw CLIUsageError('Recovered TTS batch output does not bind one exact immutable generation slot.')
    recoveredBySlot.set(recovered.value.generationSlotId, recovered)
  }
  const unresolvedSlots = planned.slots.filter((slot) => !recoveredBySlot.has(slot.generationSlotId))
  const localCompositionOnly = unresolvedSlots.length === 0
  const requestedSlotLimit = options.ttsOptions.ttsMaxGenerationSlots
  if (requestedSlotLimit !== undefined && (!Number.isSafeInteger(requestedSlotLimit) || requestedSlotLimit <= 0)) {
    throw CLIUsageError('TTS maximum generation slots must be a positive safe integer.')
  }
  if (requestedSlotLimit !== undefined && planned.strategy !== 'segmented') {
    throw CLIUsageError('Bounded generation-slot execution is supported only for segmented TTS renders.')
  }
  const renderRoot = `${targetDir}/renders/${renderIdentity}`
  for (const [slotId, recovered] of recoveredBySlot) {
    if (recovered.value.provenance !== 'slot-reuse') continue
    recoveredBySlot.set(slotId, {
      ...recovered,
      path: `${renderRoot}/slots/${recovered.value.slotHash}/provider-batch-result.json`,
    })
  }
  await Promise.all([...recoveredBySlot.values()].map(async (batch) => await materializeRecoveredBatch(options.outputDir, batch)))
  const attemptSlots = requestedSlotLimit === undefined ? unresolvedSlots : unresolvedSlots.slice(0, requestedSlotLimit)
  const attemptSlotIds = new Set(attemptSlots.map((slot) => slot.generationSlotId))
  const unresolvedBatchIds = [...new Set(attemptSlots.map((slot) => slot.batchId))]
  const unresolvedPlannedCost = sumCosts(attemptSlots.map((slot) => slot.plannedCost))
  const cumulativePlannedCost = sumCosts([
    options.retainedCumulativePlannedCost ?? { amounts: [] },
    unresolvedPlannedCost
  ])
  const branchRoot = `${targetDir}/branches/${branchPlan.branchPlanId}`
  const attemptsRoot = `${renderRoot}/attempts`
  const priorAttemptNumbers = (await readdir(attemptsRoot).catch(() => []))
    .flatMap((name) => /^attempt-(\d+)(?:-|$)/.exec(name)?.[1] ? [Number.parseInt(/^attempt-(\d+)(?:-|$)/.exec(name)?.[1] as string, 10)] : [])
    .filter(Number.isFinite)
  if (options.priorAttemptCount !== undefined && (!Number.isSafeInteger(options.priorAttemptCount) || options.priorAttemptCount < 0)) {
    throw CLIUsageError('Retained TTS provider attempt count must be a non-negative safe integer.')
  }
  const priorAttemptCount = options.priorAttemptCount
    ?? (priorAttemptNumbers.length > 0 ? Math.max(...priorAttemptNumbers) : 0)
  const attemptNumber = priorAttemptCount + 1
  const invocationId = `invocation-${randomUUID()}`
  const attemptRoot = `${attemptsRoot}/attempt-${String(attemptNumber).padStart(3, '0')}-${invocationId}`
  await writeJsonCreateOnly(options.outputDir, `${renderRoot}/source-identity.json`, planned.sourceIdentity)
  await writeJsonCreateOnly(options.outputDir, `${renderRoot}/dialogue-plan.json`, planned.dialoguePlan)
  await writeTextCreateOnly(options.outputDir, `${renderRoot}/${strategyArtifacts.normalizedDialogue.path}`, planned.normalizedText)
  await Promise.all(planned.turns.map(async (turn, index) => await writeTextCreateOnly(options.outputDir, `${renderRoot}/${strategyArtifacts.turns[index]?.path as string}`, turn.canonical.canonicalText)))
  await Promise.all(planned.slots.map(async (slot, index) => await writeTextCreateOnly(options.outputDir, `${renderRoot}/${strategyArtifacts.generationSlots[index]?.path as string}`, slot.providerText)))
  const capabilityFixtureFile = await writeJsonCreateOnly(options.outputDir, `${targetDir}/capability-fixtures/${capabilityFixtureHash}.json`, capability)
  const branchFile = await writeJsonCreateOnly(options.outputDir, `${branchRoot}/branch-plan.json`, branchPlan)
  const renderPlanFile = await writeJsonCreateOnly(options.outputDir, `${renderRoot}/render-plan.json`, renderPlan)
  const readinessCheckedAt = now()
  const accountScopeHash = hashCanonicalTtsValue({
    provider: options.target.service,
    transport,
    credentialScope: 'configured-provider-account'
  })
  const capabilityObservation = withIdentity({
    capabilityScopeHash,
    capabilityFixtureHash,
    accountScopeHash,
    state: 'available' as const,
    satisfiedRequirements: [],
    unmetRequirements: [],
    checkedAt: readinessCheckedAt,
    evidenceRefs: [contained(targetDir, capabilityFixtureFile.path)]
  }, 'observationHash') as AccountCapabilityObservation
  validateAccountCapabilityObservation(capabilityObservation, { capabilityScopeHash, capabilityFixtureHash, accountScopeHash })
  const readinessResult = withIdentity({
    schemaVersion: 1 as const,
    branchPlanId: branchPlan.branchPlanId,
    targetKey,
    status: 'ready' as const,
    capabilityFixture: { capabilityFixtureHash, path: contained(targetDir, capabilityFixtureFile.path), sha256: capabilityFixtureFile.sha256 },
    capabilityObservations: [capabilityObservation],
    candidateReadiness: [{ candidateId: branchCandidate.candidateId, strategy: planned.strategy, requiredCapabilityScopeHashes: [capabilityScopeHash], accountObservationHashes: [capabilityObservation.observationHash], status: 'ready' as const, errors: [] }],
    resolvedVoices: planned.turns.map((turn) => ({
      locatorHash: bindingIdentityHash(turn.binding),
      providerVoice: turn.binding.providerVoice,
      ...(turn.binding.kind === 'approved-snapshot' && turn.binding.providerRevision ? { providerRevision: turn.binding.providerRevision } : {}),
      externallyMutable: turn.binding.providerVoice.kind === 'remote-resource'
    })),
    checkedAt: readinessCheckedAt,
    errors: []
  }, 'readinessResultHash') as ProviderReadinessResult
  const priorReadinessArtifactNumbers = (await readdir(branchRoot).catch(() => []))
    .flatMap((name) => /^readiness-result-attempt-(\d+)\.json$/.exec(name)?.[1]
      ? [Number.parseInt(/^readiness-result-attempt-(\d+)\.json$/.exec(name)?.[1] as string, 10)]
      : [])
    .filter(Number.isFinite)
  const readinessArtifactNumber = (priorReadinessArtifactNumbers.length > 0
    ? Math.max(...priorReadinessArtifactNumbers)
    : 0) + 1
  const readinessFile = await writeJsonCreateOnly(
    options.outputDir,
    `${branchRoot}/readiness-result-attempt-${String(readinessArtifactNumber).padStart(3, '0')}.json`,
    readinessResult
  )
  const readinessAuthorization: ReadinessAuthorization = {
    readinessAttemptSequence: 1,
    branchPlanId: branchPlan.branchPlanId,
    branchCandidateId: branchCandidate.candidateId,
    readinessResultRef: contained(targetDir, readinessFile.path),
    readinessResultHash: readinessFile.sha256,
    accountObservationHashes: [capabilityObservation.observationHash]
  }
  const journalId = hashCanonicalTtsValue({ renderPlanId, renderIdentity, attempt: attemptNumber, invocationId })
  const journal = withIdentity({
    schemaVersion: 1 as const,
    journalId,
    renderPlanId,
    renderIdentity,
    invocationId,
    attempt: attemptNumber,
    plannedRequestCount: attemptSlots.length,
    plannedBatchIds: unresolvedBatchIds,
    plannedGenerationSlots: attemptSlots.map((slot) => ({ batchId: slot.batchId, generationSlotId: slot.generationSlotId })),
    requests: [],
    recordedBatchResults: [],
    capturedAt: now()
  }, 'snapshotId') as unknown as RenderAdmissionJournalSnapshot
  validateRenderAdmissionJournalSnapshot(journal)

  const preparedAt = journal.capturedAt
  const events: CanonicalAudioProviderProjection['renderHistory'][number]['events'] = [{
    sequence: 1,
    status: 'missing',
    at: preparedAt,
    attempt: 0
  }]
  const pointerEvents: CanonicalAudioProviderProjection['pointerEvents'] = [
    { sequence: 1, action: 'activate-branch', branchPlanId: branchPlan.branchPlanId, actor: LOCAL_ACTOR, at: preparedAt },
    { sequence: 2, action: 'project-branch-readiness', branchPlanId: branchPlan.branchPlanId, readinessAttemptSequence: 1, actor: LOCAL_ACTOR, at: readinessCheckedAt },
    { sequence: 3, action: 'activate-render', renderIdentity, eventSequence: 1, actor: LOCAL_ACTOR, at: preparedAt }
  ]

  const initialProjection: CanonicalAudioProviderProjection = {
    activeWork: {
      kind: 'render',
      renderIdentity,
      eventSequence: events.length,
      ...(planned.slots.some((slot) => recoveredBySlot.has(slot.generationSlotId))
        ? {
            completedSlotHashes: planned.slots.flatMap((slot) =>
              recoveredBySlot.has(slot.generationSlotId) ? [paidSpeechSlotHash(slot)] : [])
          }
        : {})
    },
    branchHistory: [{ sequence: 1, branchPlanId: branchPlan.branchPlanId, branchPlanRef: contained(targetDir, branchFile.path), branchPlanSha256: branchFile.sha256, createdAt: preparedAt }],
    readinessAttempts: [{ sequence: 1, branchPlanId: branchPlan.branchPlanId, readinessResultRef: contained(targetDir, readinessFile.path), readinessResultHash: readinessFile.sha256, accountObservationHashes: [capabilityObservation.observationHash], at: readinessCheckedAt, status: 'ready', admissionDisposition: 'eligible' }],
    renderHistory: [{ renderIdentity, renderPlanId, renderPlanRef: contained(targetDir, renderPlanFile.path), renderPlanSha256: renderPlanFile.sha256, voiceContextKey, synthesisSettingsHash, outputProfileHash, renderDir: contained(targetDir, renderRoot), events: events.map((event) => ({ ...event })) }],
    pointerEvents: pointerEvents.map((event) => ({ ...event }))
  }

  const preparedState = stateForProjection(options.target, targetKey, transport, targetRelativeDir, initialProjection)
  await options.onProviderState?.(preparedState)

  const recoveredBatchFiles: Array<WrittenJson<ProviderBatchResult>> = planned.slots.flatMap((slot) => {
    const recovered = recoveredBySlot.get(slot.generationSlotId)
    return recovered ? [{ value: recovered.value, path: recovered.path, sha256: recovered.sha256 }] : []
  })

  const executionSelection = requestedSlotLimit === undefined
    ? undefined
    : attemptSlots.map((slot) => {
        if (slot.turnIds.length !== 1) throw CLIUsageError('Bounded segmented execution requires each generation slot to bind exactly one dialogue turn.')
        return {
          generationSlotId: slot.generationSlotId,
          turnId: slot.turnIds[0] as string,
          providerSegmentIndex: slot.slotIndex
        }
      })

  return {
    options,
    purePlan,
    now,
    artifactRoot,
    compactArchive,
    layout,
    targetRelativeDir,
    archiveRelativeDir,
    targetDir,
    renderRoot,
    branchRoot,
    attemptsRoot,
    attemptRoot,
    journalRelativePath,
    paidSpeechSlotHash,
    recoveredBySlot,
    unresolvedSlots,
    localCompositionOnly,
    requestedSlotLimit,
    attemptSlots,
    attemptSlotIds,
    unresolvedBatchIds,
    unresolvedPlannedCost,
    cumulativePlannedCost,
    priorAttemptCount,
    attemptNumber,
    invocationId,
    branchFile,
    renderPlanFile,
    capabilityObservation,
    readinessResult,
    readinessFile,
    readinessAuthorization,
    journalId,
    journal,
    journalSequence: 1,
    journalFile: undefined,
    attemptReservation: undefined,
    events,
    pointerEvents,
    currentProjection: initialProjection,
    preparedState,
    mutation: Promise.resolve(),
    runtimeRequests: [],
    outputsBySlot: new Map(),
    recoveredBatchFiles,
    promotedBatchFiles: new Map(),
    closedProviderAttempt: undefined,
    terminalState: undefined,
    executionSelection,
  }
}
