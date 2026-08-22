import { readdir } from 'node:fs/promises'
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
import { UsageError } from '~/utils/error-handler'
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

type PureAttemptPlan = ReturnType<typeof buildPureCurrentTtsRenderPlan>

const resolveAttemptLayout = (
  options: CreateCurrentTtsRenderAttemptOptions,
  purePlan: PureAttemptPlan
) => {
  const { targetKey, renderIdentity, planned } = purePlan
  const artifactRoot = options.artifactRoot ?? (options.comicContext ? 'audio/providers' : 'providers')
  const layout = resolveTtsOutputLayout(artifactRoot, targetKey, renderIdentity)
  const targetRelativeDir = resolveStableTtsArtifactDir(artifactRoot, targetKey)
  const targetDir = `${options.outputDir}/${targetRelativeDir}`
  const renderRoot = `${targetDir}/renders/${renderIdentity}`
  const paidSpeechSlotHash = (slot: AttemptSlot): string => slot.slotHash ?? computePaidSpeechSlotHash({
    dialoguePlanId: planned.dialoguePlan.dialoguePlanId,
    turnIds: slot.turnIds,
    providerText: slot.providerText,
    serializedVoiceHash: hashCanonicalTtsValue(slot.turnIds.map(turnId => planned.turns.find(turn => turn.canonical.turnId === turnId)?.voice.valueHash ?? '')),
    requestControlsHash: slot.expectedRequestControlsHash,
    outputFormat: requestedOutput(options),
    endpointKind: slot.expectedEndpointKind,
    serializerVersion: slot.expectedSerializerVersion,
  })
  for (const slot of planned.slots) slot.slotHash = paidSpeechSlotHash(slot)
  return {
    artifactRoot,
    compactArchive: Boolean(options.comicContext) || artifactRoot.replace(/\/+$/, '') === 'audio/providers',
    layout,
    targetRelativeDir,
    archiveRelativeDir: layout.artifactDir,
    targetDir,
    renderRoot,
    branchRoot: `${targetDir}/branches/${purePlan.branchPlan.branchPlanId}`,
    attemptsRoot: `${renderRoot}/attempts`,
    journalRelativePath: `${targetRelativeDir}/renders/${renderIdentity}/journal.jsonl`,
    paidSpeechSlotHash,
  }
}

const prepareRecoveredExecution = async (
  options: CreateCurrentTtsRenderAttemptOptions,
  purePlan: PureAttemptPlan,
  layout: ReturnType<typeof resolveAttemptLayout>
) => {
  const { planned, renderPlanId, renderIdentity } = purePlan
  if ((options.recoveredSlots?.length ?? 0) > 0 && planned.strategy !== 'segmented') throw UsageError('Recovered TTS generation slots may seed only an immutable segmented render.')
  const recoveredBySlot = new Map<string, CurrentTtsRecoveredGenerationSlot>()
  for (const recovered of options.recoveredSlots ?? []) {
    const slot = planned.slots.find(entry => entry.generationSlotId === recovered.value.generationSlotId)
    if (
      !slot
      || recoveredBySlot.has(recovered.value.generationSlotId)
      || recovered.value.renderPlanId !== renderPlanId
      || recovered.value.renderIdentity !== renderIdentity
      || recovered.value.batchId !== slot.batchId
      || recovered.value.status !== 'succeeded'
      || recovered.value.outputs.length === 0
      || recovered.outputPaths.length !== recovered.value.outputs.length
    ) throw UsageError('Recovered TTS batch output does not bind one exact immutable generation slot.')
    recoveredBySlot.set(recovered.value.generationSlotId, recovered)
  }
  const unresolvedSlots = planned.slots.filter(slot => !recoveredBySlot.has(slot.generationSlotId))
  const requestedSlotLimit = options.ttsOptions.ttsMaxGenerationSlots
  if (requestedSlotLimit !== undefined && (!Number.isSafeInteger(requestedSlotLimit) || requestedSlotLimit <= 0)) throw UsageError('TTS maximum generation slots must be a positive safe integer.')
  if (requestedSlotLimit !== undefined && planned.strategy !== 'segmented') throw UsageError('Bounded generation-slot execution is supported only for segmented TTS renders.')
  for (const [slotId, recovered] of recoveredBySlot) {
    if (recovered.value.provenance !== 'slot-reuse') continue
    recoveredBySlot.set(slotId, { ...recovered, path: `${layout.renderRoot}/slots/${recovered.value.slotHash}/provider-batch-result.json` })
  }
  await Promise.all([...recoveredBySlot.values()].map(async batch => await materializeRecoveredBatch(options.outputDir, batch)))
  const attemptSlots = requestedSlotLimit === undefined ? unresolvedSlots : unresolvedSlots.slice(0, requestedSlotLimit)
  const unresolvedPlannedCost = sumCosts(attemptSlots.map(slot => slot.plannedCost))
  const priorAttemptNumbers = (await readdir(layout.attemptsRoot).catch(() => []))
    .flatMap(name => /^attempt-(\d+)(?:-|$)/.exec(name)?.[1] ? [Number.parseInt(/^attempt-(\d+)(?:-|$)/.exec(name)?.[1] as string, 10)] : [])
    .filter(Number.isFinite)
  if (options.priorAttemptCount !== undefined && (!Number.isSafeInteger(options.priorAttemptCount) || options.priorAttemptCount < 0)) throw UsageError('Retained TTS provider attempt count must be a non-negative safe integer.')
  const priorAttemptCount = options.priorAttemptCount ?? (priorAttemptNumbers.length > 0 ? Math.max(...priorAttemptNumbers) : 0)
  const attemptNumber = priorAttemptCount + 1
  const invocationId = `invocation-${crypto.randomUUID()}`
  return {
    recoveredBySlot,
    unresolvedSlots,
    localCompositionOnly: unresolvedSlots.length === 0,
    requestedSlotLimit,
    attemptSlots,
    attemptSlotIds: new Set(attemptSlots.map(slot => slot.generationSlotId)),
    unresolvedBatchIds: [...new Set(attemptSlots.map(slot => slot.batchId))],
    unresolvedPlannedCost,
    cumulativePlannedCost: sumCosts([options.retainedCumulativePlannedCost ?? { amounts: [] }, unresolvedPlannedCost]),
    priorAttemptCount,
    attemptNumber,
    invocationId,
    attemptRoot: `${layout.attemptsRoot}/attempt-${String(attemptNumber).padStart(3, '0')}-${invocationId}`,
  }
}

const materializeImmutableAttemptArtifacts = async (
  options: CreateCurrentTtsRenderAttemptOptions,
  purePlan: PureAttemptPlan,
  layout: ReturnType<typeof resolveAttemptLayout>
) => {
  const { planned, strategyArtifacts, capabilityFixtureHash, capability, branchPlan, renderPlan } = purePlan
  await writeJsonCreateOnly(options.outputDir, `${layout.renderRoot}/source-identity.json`, planned.sourceIdentity)
  await writeJsonCreateOnly(options.outputDir, `${layout.renderRoot}/dialogue-plan.json`, planned.dialoguePlan)
  await writeTextCreateOnly(options.outputDir, `${layout.renderRoot}/${strategyArtifacts.normalizedDialogue.path}`, planned.normalizedText)
  await Promise.all(planned.turns.map(async (turn, index) => await writeTextCreateOnly(options.outputDir, `${layout.renderRoot}/${strategyArtifacts.turns[index]?.path as string}`, turn.canonical.canonicalText)))
  await Promise.all(planned.slots.map(async (slot, index) => await writeTextCreateOnly(options.outputDir, `${layout.renderRoot}/${strategyArtifacts.generationSlots[index]?.path as string}`, slot.providerText)))
  return {
    capabilityFixtureFile: await writeJsonCreateOnly(options.outputDir, `${layout.targetDir}/capability-fixtures/${capabilityFixtureHash}.json`, capability),
    branchFile: await writeJsonCreateOnly(options.outputDir, `${layout.branchRoot}/branch-plan.json`, branchPlan),
    renderPlanFile: await writeJsonCreateOnly(options.outputDir, `${layout.renderRoot}/render-plan.json`, renderPlan),
  }
}

const createReadinessAndJournal = async (
  options: CreateCurrentTtsRenderAttemptOptions,
  purePlan: PureAttemptPlan,
  layout: ReturnType<typeof resolveAttemptLayout>,
  execution: Awaited<ReturnType<typeof prepareRecoveredExecution>>,
  artifacts: Awaited<ReturnType<typeof materializeImmutableAttemptArtifacts>>,
  now: () => string
) => {
  const { transport, targetKey, capabilityFixtureHash, capabilityScopeHash, planned, branchCandidate, branchPlan, renderPlanId, renderIdentity } = purePlan
  const readinessCheckedAt = now()
  const accountScopeHash = hashCanonicalTtsValue({ provider: options.target.service, transport, credentialScope: 'configured-provider-account' })
  const capabilityObservation = withIdentity({
    capabilityScopeHash,
    capabilityFixtureHash,
    accountScopeHash,
    state: 'available' as const,
    satisfiedRequirements: [],
    unmetRequirements: [],
    checkedAt: readinessCheckedAt,
    evidenceRefs: [contained(layout.targetDir, artifacts.capabilityFixtureFile.path)],
  }, 'observationHash') as AccountCapabilityObservation
  validateAccountCapabilityObservation(capabilityObservation, { capabilityScopeHash, capabilityFixtureHash, accountScopeHash })
  const readinessResult = withIdentity({
    schemaVersion: 1 as const,
    branchPlanId: branchPlan.branchPlanId,
    targetKey,
    status: 'ready' as const,
    capabilityFixture: { capabilityFixtureHash, path: contained(layout.targetDir, artifacts.capabilityFixtureFile.path), sha256: artifacts.capabilityFixtureFile.sha256 },
    capabilityObservations: [capabilityObservation],
    candidateReadiness: [{ candidateId: branchCandidate.candidateId, strategy: planned.strategy, requiredCapabilityScopeHashes: [capabilityScopeHash], accountObservationHashes: [capabilityObservation.observationHash], status: 'ready' as const, errors: [] }],
    resolvedVoices: planned.turns.map(turn => ({ locatorHash: bindingIdentityHash(turn.binding), providerVoice: turn.binding.providerVoice, ...(turn.binding.kind === 'approved-snapshot' && turn.binding.providerRevision ? { providerRevision: turn.binding.providerRevision } : {}), externallyMutable: turn.binding.providerVoice.kind === 'remote-resource' })),
    checkedAt: readinessCheckedAt,
    errors: [],
  }, 'readinessResultHash') as ProviderReadinessResult
  const priorReadinessNumbers = (await readdir(layout.branchRoot).catch(() => []))
    .flatMap(name => /^readiness-result-attempt-(\d+)\.json$/.exec(name)?.[1] ? [Number.parseInt(/^readiness-result-attempt-(\d+)\.json$/.exec(name)?.[1] as string, 10)] : [])
    .filter(Number.isFinite)
  const readinessArtifactNumber = (priorReadinessNumbers.length > 0 ? Math.max(...priorReadinessNumbers) : 0) + 1
  const readinessFile = await writeJsonCreateOnly(options.outputDir, `${layout.branchRoot}/readiness-result-attempt-${String(readinessArtifactNumber).padStart(3, '0')}.json`, readinessResult)
  const readinessAuthorization: ReadinessAuthorization = {
    readinessAttemptSequence: 1,
    branchPlanId: branchPlan.branchPlanId,
    branchCandidateId: branchCandidate.candidateId,
    readinessResultRef: contained(layout.targetDir, readinessFile.path),
    readinessResultHash: readinessFile.sha256,
    accountObservationHashes: [capabilityObservation.observationHash],
  }
  const journalId = hashCanonicalTtsValue({ renderPlanId, renderIdentity, attempt: execution.attemptNumber, invocationId: execution.invocationId })
  const journal = withIdentity({
    schemaVersion: 1 as const,
    journalId,
    renderPlanId,
    renderIdentity,
    invocationId: execution.invocationId,
    attempt: execution.attemptNumber,
    plannedRequestCount: execution.attemptSlots.length,
    plannedBatchIds: execution.unresolvedBatchIds,
    plannedGenerationSlots: execution.attemptSlots.map(slot => ({ batchId: slot.batchId, generationSlotId: slot.generationSlotId })),
    requests: [],
    recordedBatchResults: [],
    capturedAt: now(),
  }, 'snapshotId') as unknown as RenderAdmissionJournalSnapshot
  validateRenderAdmissionJournalSnapshot(journal)
  return { capabilityObservation, readinessResult, readinessFile, readinessAuthorization, readinessCheckedAt, journalId, journal }
}

const createInitialProjection = (
  purePlan: PureAttemptPlan,
  layout: ReturnType<typeof resolveAttemptLayout>,
  execution: Awaited<ReturnType<typeof prepareRecoveredExecution>>,
  artifacts: Awaited<ReturnType<typeof materializeImmutableAttemptArtifacts>>,
  readiness: Awaited<ReturnType<typeof createReadinessAndJournal>>
) => {
  const { branchPlan, renderIdentity, renderPlanId, voiceContextKey, synthesisSettingsHash, outputProfileHash, planned } = purePlan
  const preparedAt = readiness.journal.capturedAt
  const events: CanonicalAudioProviderProjection['renderHistory'][number]['events'] = [{ sequence: 1, status: 'missing', at: preparedAt, attempt: 0 }]
  const pointerEvents: CanonicalAudioProviderProjection['pointerEvents'] = [
    { sequence: 1, action: 'activate-branch', branchPlanId: branchPlan.branchPlanId, actor: LOCAL_ACTOR, at: preparedAt },
    { sequence: 2, action: 'project-branch-readiness', branchPlanId: branchPlan.branchPlanId, readinessAttemptSequence: 1, actor: LOCAL_ACTOR, at: readiness.readinessCheckedAt },
    { sequence: 3, action: 'activate-render', renderIdentity, eventSequence: 1, actor: LOCAL_ACTOR, at: preparedAt },
  ]
  const projection: CanonicalAudioProviderProjection = {
    activeWork: {
      kind: 'render',
      renderIdentity,
      eventSequence: events.length,
      ...(planned.slots.some(slot => execution.recoveredBySlot.has(slot.generationSlotId)) ? { completedSlotHashes: planned.slots.flatMap(slot => execution.recoveredBySlot.has(slot.generationSlotId) ? [layout.paidSpeechSlotHash(slot)] : []) } : {}),
    },
    branchHistory: [{ sequence: 1, branchPlanId: branchPlan.branchPlanId, branchPlanRef: contained(layout.targetDir, artifacts.branchFile.path), branchPlanSha256: artifacts.branchFile.sha256, createdAt: preparedAt }],
    readinessAttempts: [{ sequence: 1, branchPlanId: branchPlan.branchPlanId, readinessResultRef: contained(layout.targetDir, readiness.readinessFile.path), readinessResultHash: readiness.readinessFile.sha256, accountObservationHashes: [readiness.capabilityObservation.observationHash], at: readiness.readinessCheckedAt, status: 'ready', admissionDisposition: 'eligible' }],
    renderHistory: [{ renderIdentity, renderPlanId, renderPlanRef: contained(layout.targetDir, artifacts.renderPlanFile.path), renderPlanSha256: artifacts.renderPlanFile.sha256, voiceContextKey, synthesisSettingsHash, outputProfileHash, renderDir: contained(layout.targetDir, layout.renderRoot), events: events.map(event => ({ ...event })) }],
    pointerEvents: pointerEvents.map(event => ({ ...event })),
  }
  return { events, pointerEvents, projection }
}

const buildExecutionSelection = (
  requestedSlotLimit: number | undefined,
  attemptSlots: AttemptSlot[]
) => requestedSlotLimit === undefined ? undefined : attemptSlots.map(slot => {
  if (slot.turnIds.length !== 1) throw UsageError('Bounded segmented execution requires each generation slot to bind exactly one dialogue turn.')
  return { generationSlotId: slot.generationSlotId, turnId: slot.turnIds[0] as string, providerSegmentIndex: slot.slotIndex }
})

export const createAttemptContext = async (
  options: CreateCurrentTtsRenderAttemptOptions
): Promise<AttemptContext> => {
  const now = options.now ?? (() => new Date().toISOString())
  const purePlan = buildPureCurrentTtsRenderPlan(options)
  const layout = resolveAttemptLayout(options, purePlan)
  const execution = await prepareRecoveredExecution(options, purePlan, layout)
  const artifacts = await materializeImmutableAttemptArtifacts(options, purePlan, layout)
  const readiness = await createReadinessAndJournal(options, purePlan, layout, execution, artifacts, now)
  const initial = createInitialProjection(purePlan, layout, execution, artifacts, readiness)
  const preparedState = stateForProjection(options.target, purePlan.targetKey, purePlan.transport, layout.targetRelativeDir, initial.projection)
  await options.onProviderState?.(preparedState)
  const recoveredBatchFiles: Array<WrittenJson<ProviderBatchResult>> = purePlan.planned.slots.flatMap(slot => {
    const recovered = execution.recoveredBySlot.get(slot.generationSlotId)
    return recovered ? [{ value: recovered.value, path: recovered.path, sha256: recovered.sha256 }] : []
  })
  return {
    options,
    purePlan,
    now,
    ...layout,
    ...execution,
    branchFile: artifacts.branchFile,
    renderPlanFile: artifacts.renderPlanFile,
    capabilityObservation: readiness.capabilityObservation,
    readinessResult: readiness.readinessResult,
    readinessFile: readiness.readinessFile,
    readinessAuthorization: readiness.readinessAuthorization,
    journalId: readiness.journalId,
    journal: readiness.journal,
    journalSequence: 1,
    journalFile: undefined,
    attemptReservation: undefined,
    events: initial.events,
    pointerEvents: initial.pointerEvents,
    currentProjection: initial.projection,
    preparedState,
    mutation: Promise.resolve(),
    runtimeRequests: [],
    outputsBySlot: new Map(),
    recoveredBatchFiles,
    promotedBatchFiles: new Map(),
    closedProviderAttempt: undefined,
    terminalState: undefined,
    executionSelection: buildExecutionSelection(execution.requestedSlotLimit, execution.attemptSlots),
  }
}
