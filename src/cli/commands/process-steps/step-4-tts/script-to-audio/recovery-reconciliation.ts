import { lstat, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type {
  CompactTargetRender,
  ObservedProviderRequest,
  PipelineProviderState,
  PlannedCost,
  ProviderBatchInvocationPlan,
  ProviderBatchOutput,
  ProviderBatchResult,
  ProviderRenderPlan,
  RenderAdmissionJournalSnapshot,
  TtsTarget,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import {
  canonicalTtsJson,
  computePaidSpeechSlotHash,
  hashCanonicalTtsValue,
  sha256Bytes,
} from './contract-identity'
import {
  validateProviderBatchResult,
  validateProviderRenderPlanIdentity,
  validateRenderAdmissionJournalSnapshot,
} from './contract-validation'
import {
  contained,
  hasErrorCode,
  readObservedAudio,
  readVerifiedJson,
} from './attempt-io'
import {
  type AttemptSlot,
  type CurrentTtsPartialRecovery,
  type CurrentTtsReconciliationBlocker,
  type CurrentTtsRecoveredGenerationSlot,
  type CurrentTtsResumePricePlan,
  type CurrentTtsSafeRedispatch,
  type PureCurrentTtsRenderPlanOptions,
  type RecordedOutput,
  withIdentity,
} from './attempt-shared'
import {
  buildPureCurrentTtsRenderPlan,
  planCurrentTtsReadiness,
  readAudioProjection,
  requestedOutput,
  sumCosts,
} from './attempt-planning'
import { readContainedArtifactFile } from './safe-artifact-store'
import { resolveStableTtsArtifactDir, resolveTtsOutputLayout } from './tts-output-layout'
import type { RetainedBatchCandidate } from './recovery-batch-discovery'
import { discoverBatchCandidates } from './recovery-batch-discovery'
import {
  collectRetainedJournalEvidence,
  prepareCompactRenderRecovery,
  prepareSelectedSuccess,
  validateRecoveryProjections,
  resolveRetainedPath,
  type RetainedJournalEvidence,
} from './recovery-evidence'
import { assembleCompletedRenderRecovery } from './recovery-finalization'

export type LoadedRecoveryBatch = CurrentTtsRecoveredGenerationSlot & Readonly<{
  value: Extract<ProviderBatchResult, { provenance: 'provider-dispatch' }>
  attemptRoot: string
}>

const resolvedPlanTurn = (plan: ProviderRenderPlan, turnId: string) => {
  for (const node of plan.nodes) {
    if (node.kind === 'turn' && node.turn.turnId === turnId) return node.turn
    if (node.kind === 'overlap') {
      const turn = node.turns.find((entry) => entry.turnId === turnId)
      if (turn) return turn
    }
  }
  return undefined
}

const portableResolvedPlanTurn = (plan: ProviderRenderPlan, turnId: string) => {
  const turn = resolvedPlanTurn(plan, turnId)
  if (!turn) return undefined
  const { voice, ...turnWithoutVoice } = turn
  return {
    ...turnWithoutVoice,
    bindingIdentityHash: voice.kind === 'approved-snapshot' ? voice.entryHash : voice.identityHash,
    providerVoice: voice.providerVoice,
    providerModel: voice.providerModel,
    ...(voice.kind === 'approved-snapshot' && voice.providerRevision ? { providerRevision: voice.providerRevision } : {}),
    synthesisSettings: voice.synthesisSettings,
    capabilityFixtureHash: voice.capabilityFixtureHash
  }
}

const compatibleSegmentedSlotHash = (plan: ProviderRenderPlan, generationSlotId: string): string | undefined => {
  if (plan.strategy !== 'segmented') return undefined
  const batch = plan.batches.find((entry) => entry.generationSlots.some((slot) => slot.generationSlotId === generationSlotId))
  const slot = batch?.generationSlots.find((entry) => entry.generationSlotId === generationSlotId)
  const artifact = plan.strategyArtifacts?.generationSlots.find((entry) => entry.generationSlotId === generationSlotId)
  if (!batch || !slot || !artifact) return undefined
  const turns = batch.orderedTurnIds.map((turnId) => portableResolvedPlanTurn(plan, turnId))
  if (turns.some((turn) => !turn)) return undefined
  return hashCanonicalTtsValue({
    schemaVersion: 1,
    sourceIdentityHash: plan.sourceIdentityHash,
    dialoguePlanId: plan.dialoguePlanId,
    targetKey: plan.targetKey,
    provider: plan.provider,
    model: plan.model,
    transport: plan.transport,
    requestedOutput: plan.requestedOutput,
    batchId: batch.batchId,
    generationSlotId,
    orderedTurnIds: batch.orderedTurnIds,
    requestControls: batch.requestControls,
    slotIndex: slot.slotIndex,
    requestedTakeCount: slot.requestedTakeCount,
    providerTextSha256: artifact.sha256,
    turns
  })
}

const paidSpeechSlotHashFor = (
  options: PureCurrentTtsRenderPlanOptions,
  planned: ReturnType<typeof buildPureCurrentTtsRenderPlan>['planned'],
  slot: AttemptSlot
): string => computePaidSpeechSlotHash({
  dialoguePlanId: planned.dialoguePlan.dialoguePlanId,
  turnIds: slot.turnIds,
  providerText: slot.providerText,
  serializedVoiceHash: hashCanonicalTtsValue(slot.turnIds.map((turnId) => planned.turns.find((turn) => turn.canonical.turnId === turnId)?.voice.valueHash ?? '')),
  requestControlsHash: slot.expectedRequestControlsHash,
  outputFormat: requestedOutput(options),
  endpointKind: slot.expectedEndpointKind,
  serializerVersion: slot.expectedSerializerVersion,
})

const recoverSlotReuseFromExistingWav = async (input: {
  rootDir: string
  layout: ReturnType<typeof resolveTtsOutputLayout>
  renderPlanId: string
  renderIdentity: string
  slot: AttemptSlot
  slotHash: string
  expectedSha256?: string | undefined
  requiresMaterialization: boolean
}): Promise<CurrentTtsRecoveredGenerationSlot> => {
  const wavPath = `${input.rootDir}/${input.layout.slotWavPath(input.slotHash)}`
  const audio = await readObservedAudio(input.rootDir, wavPath)
  const sha256 = sha256Bytes(audio.bytes)
  if (input.expectedSha256 && input.expectedSha256 !== sha256) {
    throw CLIUsageError(`Stored TTS slot ${input.slotHash} no longer matches its archive checksum.`)
  }
  const outputId = `output-${hashCanonicalTtsValue({ generationSlotId: input.slot.generationSlotId, outputIndex: 0, sha256, format: audio.format }).slice(0, 24)}`
  const resultBase = {
    schemaVersion: 1 as const,
    renderPlanId: input.renderPlanId,
    renderIdentity: input.renderIdentity,
    batchId: input.slot.batchId,
    generationSlotId: input.slot.generationSlotId,
    status: 'succeeded' as const,
    requestedTurnIds: input.slot.turnIds,
    outputs: [{
      outputId,
      artifactRef: input.layout.slotWavPath(input.slotHash),
      sha256,
      format: audio.format,
      durationMs: audio.durationMs,
    }],
    turnOutcomes: input.slot.turnIds.map((turnId) => ({ turnId, status: 'succeeded' as const, outputIds: [outputId] })),
    createdResources: [] as [],
    cost: { planned: input.slot.plannedCost, observed: [] },
    provenance: 'slot-reuse' as const,
    slotHash: input.slotHash,
    observedRequests: [] as [],
    retryAttempts: [] as [],
  }
  const value = withIdentity(resultBase, 'batchResultId')
  validateProviderBatchResult(value)
  return {
    value,
    path: `${input.rootDir}/${input.layout.slotResultPath(input.slotHash)}`,
    sha256: sha256Bytes(`${canonicalTtsJson(value)}\n`),
    outputPaths: [wavPath],
    requiresMaterialization: input.requiresMaterialization,
  }
}

const loadPromotedRecoveryBatch = async (
  options: { rootDir: string },
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  candidate: RetainedBatchCandidate,
  journalEvidenceById: Map<string, RetainedJournalEvidence>,
  knownJournalSnapshots: Set<string>
): Promise<LoadedRecoveryBatch | undefined> => {
  const { path, attemptRoot } = candidate
  const value = await readVerifiedJson<ProviderBatchResult>(options.rootDir, path, candidate.sha256, 'Stored provider batch result')
  validateProviderBatchResult(value)
  if (
    value.batchResultId !== candidate.batchResultId
    || value.batchId !== candidate.batchId
    || value.generationSlotId !== candidate.generationSlotId
    || value.renderIdentity !== pure.renderIdentity
    || value.renderPlanId !== pure.renderPlanId
    || value.provenance !== 'provider-dispatch'
  ) throw CLIUsageError('Stored provider batch result is not a complete success for the exact planned render.')
  const admissionPath = resolveRetainedPath(attemptRoot, value.admissionBasis.artifactRef, 'Stored provider batch admission basis')
  const admission = await readVerifiedJson<RenderAdmissionJournalSnapshot>(options.rootDir, admissionPath, value.admissionBasis.sha256, 'Stored provider batch admission basis')
  validateRenderAdmissionJournalSnapshot(admission)
  if (
    admission.journalId !== value.admissionBasis.journalId
    || admission.snapshotId !== value.admissionBasis.snapshotId
    || admission.renderIdentity !== pure.renderIdentity
    || admission.renderPlanId !== pure.renderPlanId
  ) throw CLIUsageError('Stored provider batch result does not bind its exact admission-journal basis.')
  knownJournalSnapshots.add(admission.snapshotId)
  if (!journalEvidenceById.has(admission.journalId)) {
    journalEvidenceById.set(admission.journalId, { value: admission, path: admissionPath, sha256: value.admissionBasis.sha256, attemptRoot })
  }
  if (value.status !== 'succeeded') return undefined
  const invocationPlanPath = resolveRetainedPath(attemptRoot, value.batchInvocationPlan.artifactRef, 'Stored batch invocation plan')
  const invocationPlan = await readVerifiedJson<ProviderBatchInvocationPlan>(
    options.rootDir,
    invocationPlanPath,
    value.batchInvocationPlan.sha256,
    'Stored batch invocation plan'
  )
  if (
    invocationPlan.batchInvocationPlanId !== value.batchInvocationPlan.batchInvocationPlanId
    || invocationPlan.renderIdentity !== pure.renderIdentity
    || invocationPlan.renderPlanId !== pure.renderPlanId
    || invocationPlan.generationSlotId !== value.generationSlotId
  ) throw CLIUsageError('Stored batch invocation plan does not bind its exact promoted generation slot.')
  const outputPaths: string[] = []
  for (const output of value.outputs) {
    const outputPath = resolveRetainedPath(dirname(path), output.artifactRef, 'Stored provider batch audio')
    const outputFile = await readContainedArtifactFile(options.rootDir, contained(options.rootDir, outputPath))
    if (outputFile.sha256 !== output.sha256) {
      throw CLIUsageError('Stored provider batch audio checksum does not match its promoted result.')
    }
    outputPaths.push(outputPath)
  }
  if (outputPaths.length === 0) throw CLIUsageError('Stored successful provider batch result has no retained audio output.')
  return { value, path, sha256: candidate.sha256, attemptRoot, outputPaths }
}

const recordedOutputsForInterruptedRequest = async (
  rootDir: string,
  batchResultDir: string,
  generationSlotId: string
): Promise<RecordedOutput[]> => {
  const outputNames = (await readdir(batchResultDir).catch((error) => {
    if (hasErrorCode(error, 'ENOENT')) return []
    throw error
  }))
    .filter((name) => /^audio-\d{3}\.[A-Za-z0-9]+$/.test(name))
    .sort()
  if (outputNames.length === 0) return []
  if (outputNames.some((name, index) => !name.startsWith(`audio-${String(index + 1).padStart(3, '0')}.`))) {
    throw CLIUsageError(`Completed TTS generation slot ${generationSlotId} has non-contiguous retained audio outputs.`)
  }
  return await Promise.all(outputNames.map(async (name) => {
    const path = resolve(batchResultDir, name)
    const audio = await readObservedAudio(rootDir, path)
    return {
      path,
      relativeToBatchResult: contained(batchResultDir, path),
      sha256: sha256Bytes(audio.bytes),
      format: audio.format,
      durationMs: audio.durationMs,
      warnings: ['Recovered from durable completion evidence after interrupted batch-result promotion.']
    }
  }))
}

const buildObservedRequest = (
  options: { target: TtsTarget },
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  evidence: RetainedJournalEvidence,
  request: RenderAdmissionJournalSnapshot['requests'][number],
  slot: AttemptSlot,
  invocationPlan: ProviderBatchInvocationPlan
): ObservedProviderRequest => {
  const preparedTransition = request.transitions.find((transition) => transition.state === 'prepared')
  const completedTransition = request.transitions.at(-1)
  if (preparedTransition?.state !== 'prepared' || completedTransition?.state !== 'completed') {
    throw CLIUsageError('Completed TTS request is missing its prepared or completed transition evidence.')
  }
  const requestFingerprint = hashCanonicalTtsValue({
    endpointKind: slot.expectedEndpointKind,
    serializerVersion: slot.expectedSerializerVersion,
    requestBodyHash: preparedTransition.requestBodyHash
  })
  if (requestFingerprint !== request.requestFingerprint) {
    throw CLIUsageError('Completed TTS request fingerprint does not match the immutable serializer contract.')
  }
  const acceptedTransition = [...request.transitions].reverse().find((transition) => transition.state === 'provider-accepted')
  return {
    requestOrdinal: request.requestOrdinal,
    invocationId: evidence.value.invocationId,
    batchId: slot.batchId,
    generationSlotId: slot.generationSlotId,
    batchInvocationPlanId: invocationPlan.batchInvocationPlanId,
    provider: options.target.service,
    model: options.target.model,
    transport: pure.transport,
    endpointKind: slot.expectedEndpointKind,
    serializerVersion: slot.expectedSerializerVersion,
    requestBodyHash: preparedTransition.requestBodyHash,
    actualRequestControlsHash: slot.expectedRequestControlsHash,
    actualContinuationHash: hashCanonicalTtsValue({ kind: 'none' }),
    turns: slot.turnIds.map((turnId) => {
      const turn = pure.planned.turns.find((candidate) => candidate.canonical.turnId === turnId)
      if (!turn) throw CLIUsageError(`Completed TTS generation slot ${slot.generationSlotId} references an unknown turn.`)
      return {
        turnId,
        providerTextHash: sha256Bytes(slot.providerText),
        voiceField: slot.expectedVoiceField,
        actualSerializedVoice: { kind: turn.voice.kind, valueHash: turn.voice.valueHash, provider: options.target.service },
        actualSerializedControlsHash: slot.expectedRequestControlsHash
      }
    }),
    ...(acceptedTransition?.state === 'provider-accepted' && acceptedTransition.providerRequestId ? { providerRequestId: acceptedTransition.providerRequestId } : {}),
    ...(acceptedTransition?.state === 'provider-accepted' ? { acceptedAt: acceptedTransition.at } : {})
  }
}

const reconstructInterruptedBatch = async (
  options: { rootDir: string; target: TtsTarget },
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  evidence: RetainedJournalEvidence,
  request: RenderAdmissionJournalSnapshot['requests'][number]
): Promise<LoadedRecoveryBatch | undefined> => {
  const slot = pure.planned.slots.find((candidate) => candidate.generationSlotId === request.generationSlotId)
  const batch = pure.planned.batches.find((candidate) => candidate.batchId === request.batchId)
  if (!slot || !batch || slot.batchId !== request.batchId) {
    throw CLIUsageError('Completed TTS request does not bind an immutable planned generation slot.')
  }
  const invocationPath = resolveRetainedPath(evidence.attemptRoot, request.batchInvocationPlanRef, 'Stored batch invocation plan')
  const invocationPlan = await readVerifiedJson<ProviderBatchInvocationPlan>(
    options.rootDir,
    invocationPath,
    request.batchInvocationPlanSha256,
    'Stored batch invocation plan'
  )
  if (
    invocationPlan.batchInvocationPlanId !== request.batchInvocationPlanId
    || invocationPlan.renderIdentity !== pure.renderIdentity
    || invocationPlan.renderPlanId !== pure.renderPlanId
    || invocationPlan.invocationId !== evidence.value.invocationId
    || invocationPlan.generationSlotId !== slot.generationSlotId
  ) throw CLIUsageError('Completed TTS request invocation plan does not bind its exact immutable generation slot.')

  const batchResultDir = resolve(evidence.attemptRoot, 'batch-results', slot.batchId, slot.generationSlotId)
  const recordedOutputs = await recordedOutputsForInterruptedRequest(
    options.rootDir,
    batchResultDir,
    slot.generationSlotId
  )
  if (recordedOutputs.length === 0) return undefined
  const completedTransition = request.transitions.at(-1)
  if (completedTransition?.state !== 'completed') {
    throw CLIUsageError('Completed TTS request is missing its completed transition evidence.')
  }
  const observedRequest = buildObservedRequest(options, pure, evidence, request, slot, invocationPlan)
  const outputs: ProviderBatchOutput[] = recordedOutputs.map((output, outputIndex) => ({
    outputId: `output-${hashCanonicalTtsValue({ generationSlotId: slot.generationSlotId, outputIndex, sha256: output.sha256, format: output.format }).slice(0, 24)}`,
    artifactRef: output.relativeToBatchResult,
    sha256: output.sha256,
    format: output.format,
    durationMs: output.durationMs
  }))
  const resultBase = {
    schemaVersion: 1 as const,
    renderPlanId: pure.renderPlanId,
    renderIdentity: pure.renderIdentity,
    batchId: slot.batchId,
    generationSlotId: slot.generationSlotId,
    status: 'succeeded' as const,
    requestedTurnIds: slot.turnIds,
    outputs,
    generatedBatch: {
      batchId: slot.batchId,
      generationSlotId: slot.generationSlotId,
      takes: outputs.map((output, outputIndex) => ({
        takeId: `take-${hashCanonicalTtsValue({ generationSlotId: slot.generationSlotId, outputId: output.outputId, sha256: output.sha256 }).slice(0, 24)}`,
        generationSlotId: slot.generationSlotId,
        audio: { artifactRef: output.artifactRef, outputId: output.outputId, sha256: output.sha256, format: output.format },
        durationMs: output.durationMs ?? 0,
        timing: {
          availability: 'unavailable' as const,
          clock: 'take-audio-ms' as const,
          provenance: 'unavailable' as const,
          turns: slot.turnIds.map((turnId) => {
            const turn = pure.planned.turns.find((candidate) => candidate.canonical.turnId === turnId)
            if (!turn) throw CLIUsageError(`Completed TTS generation slot ${slot.generationSlotId} references an unknown turn.`)
            return { turnId, subjectKey: turn.canonical.subjectKey }
          }),
          reason: 'Provider timing metadata was not durably promoted before process interruption.'
        },
        warnings: [...(recordedOutputs[outputIndex]?.warnings ?? [])]
      })),
      batchCost: { planned: slot.plannedCost, observed: [] },
      costEvidence: [],
      generatedAt: completedTransition.at,
      source: 'provider-dispatch' as const,
      batchInvocationPlanId: invocationPlan.batchInvocationPlanId,
      observedRequestOrdinals: [request.requestOrdinal]
    },
    turnOutcomes: slot.turnIds.map((turnId) => ({ turnId, status: 'succeeded' as const, outputIds: outputs.map((output) => output.outputId) })),
    createdResources: [],
    cost: { planned: slot.plannedCost, observed: [] },
    provenance: 'provider-dispatch' as const,
    invocationId: evidence.value.invocationId,
    attempt: evidence.value.attempt,
    batchInvocationPlan: {
      batchInvocationPlanId: invocationPlan.batchInvocationPlanId,
      artifactRef: contained(evidence.attemptRoot, invocationPath),
      sha256: request.batchInvocationPlanSha256
    },
    admissionBasis: {
      journalId: evidence.value.journalId,
      snapshotId: evidence.value.snapshotId,
      artifactRef: contained(evidence.attemptRoot, evidence.path),
      sha256: evidence.sha256
    },
    observedRequests: [observedRequest],
    retryAttempts: []
  }
  const result = withIdentity(resultBase, 'batchResultId')
  validateProviderBatchResult(result)
  const path = resolve(batchResultDir, 'provider-batch-result.json')
  return {
    value: result,
    path,
    sha256: sha256Bytes(`${canonicalTtsJson(result)}\n`),
    attemptRoot: evidence.attemptRoot,
    outputPaths: recordedOutputs.map((output) => output.path),
    requiresMaterialization: true
  }
}

const appendInterruptedCompletedBatches = async (
  options: { rootDir: string; target: TtsTarget },
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  journalEvidenceById: Map<string, RetainedJournalEvidence>,
  loadedBatches: LoadedRecoveryBatch[]
): Promise<void> => {
  for (const evidence of journalEvidenceById.values()) {
    const completedRequests = evidence.value.requests.filter((request) =>
      request.transitions.at(-1)?.state === 'completed'
      && !loadedBatches.some((batch) => batch.value.generationSlotId === request.generationSlotId))
    for (const request of completedRequests) {
      const requestsForSlot = evidence.value.requests.filter((candidate) => candidate.generationSlotId === request.generationSlotId)
      if (requestsForSlot.length !== 1 || request.retryOfRequestOrdinal !== undefined) continue
      const recovered = await reconstructInterruptedBatch(options, pure, evidence, request)
      if (recovered) loadedBatches.push(recovered)
    }
  }
}

export const loadRecoveryBatches = async (
  options: { rootDir: string; target: TtsTarget },
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  batchCandidates: Map<string, RetainedBatchCandidate>,
  journalEvidenceById: Map<string, RetainedJournalEvidence>,
  knownJournalSnapshots: Set<string>
): Promise<LoadedRecoveryBatch[]> => {
  const loadedBatches: LoadedRecoveryBatch[] = []
  for (const candidate of batchCandidates.values()) {
    const loaded = await loadPromotedRecoveryBatch(
      options,
      pure,
      candidate,
      journalEvidenceById,
      knownJournalSnapshots
    )
    if (!loaded) continue
    const conflictingSlot = loadedBatches.find((batch) => batch.value.generationSlotId === loaded.value.generationSlotId)
    if (conflictingSlot && conflictingSlot.value.batchResultId !== loaded.value.batchResultId) {
      throw CLIUsageError(`Stored TTS generation slot ${loaded.value.generationSlotId} has conflicting promoted batch results.`)
    }
    if (!conflictingSlot) loadedBatches.push(loaded)
  }
  await appendInterruptedCompletedBatches(options, pure, journalEvidenceById, loadedBatches)
  return loadedBatches
}

const collectCostedDispatches = (
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  journalEvidenceById: Map<string, RetainedJournalEvidence>
): {
  completedSlotIds: Set<string>
  retainedAttemptCosts: PlannedCost[]
  costedDispatches: Set<string>
} => {
  const plannedSlotIds = pure.planned.slots.map((slot) => slot.generationSlotId)
  const completedSlotIds = new Set<string>()
  const retainedAttemptCosts: PlannedCost[] = []
  const costedDispatches = new Set<string>()
  for (const evidence of journalEvidenceById.values()) {
    for (const request of evidence.value.requests) {
      if (!plannedSlotIds.includes(request.generationSlotId)) {
        throw CLIUsageError('Stored TTS admission journal contains a request outside the immutable generation-slot plan.')
      }
      const terminal = request.transitions.at(-1)?.state
      if (terminal === 'completed') completedSlotIds.add(request.generationSlotId)
      if (request.retryOfRequestOrdinal === undefined && request.transitions.some((transition) => transition.state === 'dispatch-started')) {
        const key = `${evidence.value.invocationId}\0${request.generationSlotId}`
        if (costedDispatches.has(key)) continue
        const slot = pure.planned.slots.find((entry) => entry.generationSlotId === request.generationSlotId)
        if (!slot) throw CLIUsageError('Stored TTS dispatch has no matching immutable planned slot cost.')
        costedDispatches.add(key)
        retainedAttemptCosts.push(slot.plannedCost)
      }
    }
  }
  return { completedSlotIds, retainedAttemptCosts, costedDispatches }
}

const collectReconciliationBlockers = (
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  journalEvidenceById: Map<string, RetainedJournalEvidence>,
  loadedBatches: LoadedRecoveryBatch[]
): CurrentTtsReconciliationBlocker[] => {
  const blockers: CurrentTtsReconciliationBlocker[] = []
  for (const slot of pure.planned.slots) {
    const requests = [...journalEvidenceById.values()].flatMap((evidence) => evidence.value.requests
      .filter((request) => request.generationSlotId === slot.generationSlotId)
      .map((request) => ({ evidence, request })))
    const completedRequestCount = requests.filter(({ request }) => request.transitions.at(-1)?.state === 'completed').length
    if (completedRequestCount > 1) {
      throw CLIUsageError(`Stored TTS generation slot ${slot.generationSlotId} has more than one completed deliberate request.`)
    }
    const hasRecoveredSuccess = loadedBatches.some((batch) => batch.value.generationSlotId === slot.generationSlotId)
    if (hasRecoveredSuccess) continue
    for (const { evidence, request } of requests) {
      const state = request.transitions.at(-1)?.state
      if (
        state === undefined
        || state === 'completed'
        || state === 'prepared'
        || state === 'provider-rejected'
        || state === 'confirmed-not-admitted'
      ) continue
      blockers.push({
        generationSlotId: slot.generationSlotId,
        state,
        attempt: evidence.value.attempt,
        invocationId: evidence.value.invocationId,
        requestOrdinal: request.requestOrdinal
      })
    }
  }
  return blockers
}

const enforceReconciliationBlocker = (
  blockers: CurrentTtsReconciliationBlocker[],
  options: {
    ttsOptions: { ttsAllowAmbiguousRedispatch?: boolean }
    reconciliationMode?: 'enforce' | 'report' | undefined
  }
): void => {
  const blocker = blockers[0]
  if (!blocker || options.reconciliationMode === 'report' || options.ttsOptions.ttsAllowAmbiguousRedispatch === true) return
  throw CLIUsageError(`Stored TTS generation slot ${blocker.generationSlotId} has ${blocker.state} provider work in attempt ${blocker.attempt}, request ${blocker.requestOrdinal}; automatic redispatch is blocked pending reconciliation. Pass --allow-ambiguous-redispatch to safely reconcile the pending slot, reuse all completed segment audio, and resume synthesis without deleting output directories or losing work.`)
}

export const reconcileSlotCosts = (
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  journalEvidenceById: Map<string, RetainedJournalEvidence>,
  loadedBatches: LoadedRecoveryBatch[],
  options: {
    ttsOptions: { ttsAllowAmbiguousRedispatch?: boolean }
    reconciliationMode?: 'enforce' | 'report' | undefined
  }
): {
  completedSlotIds: Set<string>
  retainedCumulativePlannedCost: PlannedCost
  reconciliationBlockers: CurrentTtsReconciliationBlocker[]
} => {
  const { completedSlotIds, retainedAttemptCosts, costedDispatches } = collectCostedDispatches(
    pure,
    journalEvidenceById
  )
  const reconciliationBlockers = collectReconciliationBlockers(pure, journalEvidenceById, loadedBatches)
  enforceReconciliationBlocker(reconciliationBlockers, options)
  for (const batch of loadedBatches) {
    if (!completedSlotIds.has(batch.value.generationSlotId)) {
      throw CLIUsageError('Stored successful provider batch result is not backed by one completed slot request.')
    }
    const key = `${batch.value.invocationId}\0${batch.value.generationSlotId}`
    if (!costedDispatches.has(key)) {
      costedDispatches.add(key)
      retainedAttemptCosts.push(batch.value.cost.planned)
    }
  }
  for (const slotId of completedSlotIds) {
    if (loadedBatches.filter((batch) => batch.value.generationSlotId === slotId).length !== 1) {
      if (options.ttsOptions.ttsAllowAmbiguousRedispatch === true) continue
      throw CLIUsageError(`Stored completed TTS generation slot ${slotId} has no exact promoted batch result.`)
    }
  }
  return {
    completedSlotIds,
    retainedCumulativePlannedCost: sumCosts(retainedAttemptCosts),
    reconciliationBlockers
  }
}

export const prepareCurrentTtsCompletedRecoveryImpl = async (
    options: PureCurrentTtsRenderPlanOptions & {
      rootDir: string
      state: PipelineProviderState
      onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
      reconciliationMode?: 'enforce' | 'report' | undefined
    }
  ) => {
    const pure = buildPureCurrentTtsRenderPlan(options)
    const { resultProjection } = validateRecoveryProjections(options, pure)
    const compactRecovery = await prepareCompactRenderRecovery(options, pure, resultProjection)
    if (compactRecovery) return compactRecovery
    const retainedRender = resultProjection.renderHistory.find((entry) =>
      entry.renderIdentity === pure.renderIdentity)
    if (!retainedRender) {
      throw CLIUsageError(`Stored TTS target ${options.state.service}/${options.state.model ?? ''} does not match the exact planned render identity; rebuild instead of resuming it.`)
    }
    const providerRoot = resolve(options.rootDir, options.state.artifactDir)
    const renderRoot = resolveRetainedPath(
      providerRoot,
      retainedRender.renderDir,
      'Stored TTS render directory'
    )
    const plannedSlotIds = pure.planned.slots.map((slot) => slot.generationSlotId)
    const evidence = await collectRetainedJournalEvidence(
      options,
      pure,
      providerRoot,
      retainedRender,
      plannedSlotIds
    )
    if (!evidence.terminalJournalEvidence) return undefined
    const selectedRecovery = await prepareSelectedSuccess(
      options,
      pure,
      resultProjection,
      retainedRender,
      providerRoot,
      renderRoot,
      plannedSlotIds
    )
    if (selectedRecovery) return selectedRecovery
    const candidates = await discoverBatchCandidates(
      options,
      pure,
      renderRoot,
      evidence.journalEvidenceById,
      retainedRender
    )
    const loadedBatches = await loadRecoveryBatches(
      options,
      pure,
      candidates,
      evidence.journalEvidenceById,
      evidence.knownJournalSnapshots
    )
    const costs = reconcileSlotCosts(pure, evidence.journalEvidenceById, loadedBatches, options)
    if (loadedBatches.length === 0) {
      return {
        kind: 'safe-redispatch' as const,
        retainedCumulativePlannedCost: costs.retainedCumulativePlannedCost,
        reconciliationBlockers: costs.reconciliationBlockers
      }
    }
    const allCompleted = plannedSlotIds.every((slotId) =>
      loadedBatches.some((batch) => batch.value.generationSlotId === slotId))
    if (!allCompleted) {
      if (pure.planned.strategy !== 'segmented') {
        throw CLIUsageError('Partial completed-slot recovery is supported only for immutable segmented dialogue renders; redispatch is blocked.')
      }
      return {
        kind: 'partial-slots' as const,
        recoveredSlots: loadedBatches,
        retainedCumulativePlannedCost: costs.retainedCumulativePlannedCost,
        reconciliationBlockers: costs.reconciliationBlockers
      }
    }
    return await assembleCompletedRenderRecovery(
      options,
      pure,
      resultProjection,
      retainedRender,
      renderRoot,
      providerRoot,
      evidence.journalEvidenceById,
      evidence.terminalJournalEvidence,
      loadedBatches,
      costs.retainedCumulativePlannedCost,
      costs.reconciliationBlockers
    )
  }

  const recoverArchivedSlots = async (
    options: PureCurrentTtsRenderPlanOptions & {
      rootDir: string
      outputDir: string
      artifactRoot?: string | undefined
      materialize?: boolean | undefined
    },
    pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
    projection: NonNullable<ReturnType<typeof readAudioProjection>>
  ): Promise<Map<string, CurrentTtsRecoveredGenerationSlot>> => {
    const layout = resolveTtsOutputLayout(
      options.artifactRoot ?? (options.comicContext ? 'audio/providers' : 'providers'),
      pure.targetKey,
      pure.renderIdentity
    )
    const archivedByHash = new Map<string, CompactTargetRender['slots'][number]>()
    if (projection.archive) {
      const compactRender = await readVerifiedJson<CompactTargetRender>(
        options.rootDir,
        resolve(options.rootDir, projection.archive.renderRef.path),
        projection.archive.renderRef.sha256,
        'Compact TTS render'
      )
      for (const slot of compactRender.slots) archivedByHash.set(slot.slotHash, slot)
    }
    const recovered = new Map<string, CurrentTtsRecoveredGenerationSlot>()
    for (const slot of pure.planned.slots) {
      const slotHash = paidSpeechSlotHashFor(options, pure.planned, slot)
      const wavPath = `${options.rootDir}/${layout.slotWavPath(slotHash)}`
      try {
        await lstat(wavPath)
      } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) continue
        throw error
      }
      recovered.set(slot.generationSlotId, await recoverSlotReuseFromExistingWav({
        rootDir: options.rootDir,
        layout,
        renderPlanId: pure.renderPlanId,
        renderIdentity: pure.renderIdentity,
        slot,
        slotHash,
        expectedSha256: archivedByHash.get(slotHash)?.sha256,
        requiresMaterialization: options.materialize !== false,
      }))
    }
    return recovered
  }

  const compatibleSlotIdsFor = (
    currentPlan: ProviderRenderPlan,
    retainedPlan: ProviderRenderPlan
  ): Set<string> => {
    if (
      retainedPlan.strategy !== 'segmented'
      || retainedPlan.targetKey !== currentPlan.targetKey
      || retainedPlan.sourceIdentityHash !== currentPlan.sourceIdentityHash
      || retainedPlan.dialoguePlanId !== currentPlan.dialoguePlanId
      || retainedPlan.provider !== currentPlan.provider
      || retainedPlan.model !== currentPlan.model
      || retainedPlan.transport !== currentPlan.transport
      || canonicalTtsJson(retainedPlan.requestedOutput) !== canonicalTtsJson(currentPlan.requestedOutput)
    ) return new Set()
    const currentSlotIds = new Set(currentPlan.batches.flatMap((batch) =>
      batch.generationSlots.map((slot) => slot.generationSlotId)))
    return new Set(retainedPlan.batches.flatMap((batch) => batch.generationSlots)
      .map((slot) => slot.generationSlotId)
      .filter((generationSlotId) =>
        currentSlotIds.has(generationSlotId)
        && compatibleSegmentedSlotHash(retainedPlan, generationSlotId)
          === compatibleSegmentedSlotHash(currentPlan, generationSlotId)))
  }

  const collectJournalBlockers = async (input: {
    rootDir: string
    retainedPlan: ProviderRenderPlan
    compatibleSlotIds: Set<string>
    journalPaths: Set<string>
  }): Promise<Array<{
    journalId: string
    blocker: CurrentTtsReconciliationBlocker
  }>> => {
    const blockers: Array<{
      journalId: string
      blocker: CurrentTtsReconciliationBlocker
    }> = []
    for (const journalPath of input.journalPaths) {
      try {
        await lstat(journalPath)
      } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) continue
        throw error
      }
      const retained = await readContainedArtifactFile(
        input.rootDir,
        contained(input.rootDir, journalPath)
      )
      const last = retained.bytes.toString('utf8').split('\n').filter(Boolean).at(-1)
      if (!last) continue
      const parsed = JSON.parse(last) as { snapshot?: RenderAdmissionJournalSnapshot }
      if (!parsed.snapshot) continue
      validateRenderAdmissionJournalSnapshot(parsed.snapshot)
      const journal = parsed.snapshot
      if (
        journal.renderIdentity !== input.retainedPlan.renderIdentity
        || journal.renderPlanId !== input.retainedPlan.renderPlanId
      ) continue
      for (const request of journal.requests) {
        if (!input.compatibleSlotIds.has(request.generationSlotId)) continue
        const state = request.transitions.at(-1)?.state
        if (
          state === undefined
          || state === 'completed'
          || state === 'prepared'
          || state === 'provider-rejected'
          || state === 'confirmed-not-admitted'
        ) continue
        blockers.push({
          journalId: journal.journalId,
          blocker: {
            generationSlotId: request.generationSlotId,
            state,
            attempt: journal.attempt,
            invocationId: journal.invocationId,
            requestOrdinal: request.requestOrdinal,
          }
        })
      }
    }
    return blockers
  }

  const discoverCompatibleBlockers = async (
    options: PureCurrentTtsRenderPlanOptions & {
      rootDir: string
      artifactRoot?: string | undefined
      state: PipelineProviderState
    },
    pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
    projection: NonNullable<ReturnType<typeof readAudioProjection>>
  ): Promise<CurrentTtsReconciliationBlocker[]> => {
    const providerRoot = resolve(options.rootDir, options.state.artifactDir)
    const candidates = new Map<string, CurrentTtsReconciliationBlocker>()
    for (const retainedRender of [...projection.renderHistory].reverse()) {
      if (retainedRender.renderIdentity === pure.renderIdentity) continue
      const retainedPlanPath = resolveRetainedPath(
        providerRoot,
        retainedRender.renderPlanRef,
        'Stored TTS render plan'
      )
      const retainedPlan = await readVerifiedJson<ProviderRenderPlan>(
        options.rootDir,
        retainedPlanPath,
        retainedRender.renderPlanSha256,
        'Stored TTS render plan'
      )
      validateProviderRenderPlanIdentity(retainedPlan)
      if (
        retainedPlan.renderIdentity !== retainedRender.renderIdentity
        || retainedPlan.renderPlanId !== retainedRender.renderPlanId
      ) throw CLIUsageError('Stored TTS render plan identity does not match its canonical projection.')
      const compatibleSlotIds = compatibleSlotIdsFor(pure.renderPlan, retainedPlan)
      if (compatibleSlotIds.size === 0) continue
      const artifactRoot = options.artifactRoot
        ?? (options.comicContext ? 'audio/providers' : 'providers')
      const retainedLayout = resolveTtsOutputLayout(
        artifactRoot,
        pure.targetKey,
        retainedRender.renderIdentity
      )
      const stableJournalPath = `${resolveStableTtsArtifactDir(artifactRoot, pure.targetKey)}/renders/${retainedRender.renderIdentity}/journal.jsonl`
      const journalPaths = new Set([
        `${options.rootDir}/${retainedLayout.journalPath}`,
        `${options.rootDir}/${stableJournalPath}`,
      ])
      if (
        projection.activeWork?.kind === 'render'
        && projection.activeWork.renderIdentity === retainedRender.renderIdentity
        && projection.activeWork.journalPath
      ) journalPaths.add(`${options.rootDir}/${projection.activeWork.journalPath}`)
      const blockers = await collectJournalBlockers({
        rootDir: options.rootDir,
        retainedPlan,
        compatibleSlotIds,
        journalPaths
      })
      for (const { journalId, blocker } of blockers) {
        candidates.set(
          `${retainedPlan.renderIdentity}\0${journalId}\0${blocker.requestOrdinal}`,
          blocker
        )
      }
    }
    return [...candidates.values()]
  }

  const enforceCompatibleBlocker = (
    blocker: CurrentTtsReconciliationBlocker | undefined,
    options: PureCurrentTtsRenderPlanOptions & {
      reconciliationMode?: 'enforce' | 'report' | undefined
    }
  ): void => {
    if (!blocker || options.reconciliationMode === 'report' || options.ttsOptions.ttsAllowAmbiguousRedispatch === true) return
    throw CLIUsageError(`Stored compatible TTS generation slot ${blocker.generationSlotId} has ${blocker.state} provider work in attempt ${blocker.attempt}, request ${blocker.requestOrdinal}; automatic redispatch is blocked pending reconciliation. Pass --allow-ambiguous-redispatch to safely reconcile the pending slot, reuse all completed segment audio, and resume synthesis without deleting output directories or losing work.`)
  }

export const prepareCurrentTtsCompatibleSlotRecoveryImpl = async (
    options: PureCurrentTtsRenderPlanOptions & {
      rootDir: string
      outputDir: string
      artifactRoot?: string | undefined
      state: PipelineProviderState
      materialize?: boolean | undefined
      reconciliationMode?: 'enforce' | 'report' | undefined
    }
  ): Promise<CurrentTtsPartialRecovery | CurrentTtsSafeRedispatch | undefined> => {
    const pure = buildPureCurrentTtsRenderPlan(options)
    if (pure.planned.strategy !== 'segmented' || options.state.targetKey !== pure.targetKey) return undefined
    const projection = readAudioProjection(options.state)
    if (!projection) return undefined
    const recovered = await recoverArchivedSlots(options, pure, projection)
    const reconciliationBlockers = (await discoverCompatibleBlockers(
      options,
      pure,
      projection
    ))
      .filter((blocker) => !recovered.has(blocker.generationSlotId))
      .sort((left, right) =>
        left.attempt - right.attempt || left.requestOrdinal - right.requestOrdinal)
    enforceCompatibleBlocker(reconciliationBlockers[0], options)
    if (recovered.size === 0) {
      return reconciliationBlockers.length === 0
        ? undefined
        : {
            kind: 'safe-redispatch',
            retainedCumulativePlannedCost: { amounts: [] },
            reconciliationBlockers
          }
    }
    return {
      kind: 'partial-slots',
      recoveredSlots: [...recovered.values()],
      retainedCumulativePlannedCost: { amounts: [] },
      reconciliationBlockers
    }
  }

export const planCurrentTtsResumePriceImpl = async (
    options: PureCurrentTtsRenderPlanOptions & {
      rootDir: string
      state?: PipelineProviderState | undefined
    }
  ): Promise<CurrentTtsResumePricePlan> => {
    const { rootDir, state, ...planOptions } = options
    const planned = buildPureCurrentTtsRenderPlan(planOptions)
    const readiness = planCurrentTtsReadiness(planOptions)
    const slots = planned.planned.slots
    const requestedSlotLimit = planOptions.ttsOptions.ttsMaxGenerationSlots
    if (
      requestedSlotLimit !== undefined
      && (!Number.isSafeInteger(requestedSlotLimit) || requestedSlotLimit <= 0)
    ) throw CLIUsageError('TTS maximum generation slots must be a positive safe integer.')
    const projection = state ? readAudioProjection(state) : undefined
    const retainedHasPlannedRender = projection?.activeWork?.kind === 'render'
      && projection.renderHistory.some((render) =>
        render.renderIdentity === readiness.renderIdentity)
    const sameRenderArchive = Boolean(
      projection?.archive
      && projection.selectedSuccess?.renderIdentity === readiness.renderIdentity
    )
    const recovery = state && (retainedHasPlannedRender || sameRenderArchive)
      ? await prepareCurrentTtsCompletedRecoveryImpl({
          rootDir,
          state,
          ...planOptions,
          reconciliationMode: 'report'
        })
      : undefined
    const compatibleRecovery = state && !retainedHasPlannedRender && !sameRenderArchive
      ? await prepareCurrentTtsCompatibleSlotRecoveryImpl({
          rootDir,
          outputDir: rootDir,
          state,
          ...planOptions,
          materialize: false,
          reconciliationMode: 'report'
        })
      : undefined
    const effectiveRecovery = recovery ?? compatibleRecovery
    const recoveredIds = new Set(effectiveRecovery?.kind === 'complete-render'
      ? slots.map((slot) => slot.generationSlotId)
      : effectiveRecovery?.kind === 'partial-slots'
        ? effectiveRecovery.recoveredSlots.map((slot) => slot.value.generationSlotId)
        : [])
    const unresolvedSlots = slots.filter((slot) =>
      !recoveredIds.has(slot.generationSlotId))
    const selectedSlots = requestedSlotLimit === undefined
      ? unresolvedSlots
      : unresolvedSlots.slice(0, requestedSlotLimit)
    const plannedCost = effectiveRecovery === undefined && requestedSlotLimit === undefined
      ? readiness.plannedCost
      : sumCosts(selectedSlots.map((slot) => slot.plannedCost))
    return {
      readiness,
      plannedCost,
      plannedSlotCount: selectedSlots.length,
      unresolvedSlotCount: unresolvedSlots.length,
      unresolvedCharacterCount: selectedSlots.reduce(
        (count, slot) => count + [...slot.providerText].length,
        0
      ),
      recoveredSlotCount: slots.length - unresolvedSlots.length,
      recoveryKind: effectiveRecovery?.kind ?? 'none',
      reconciliationBlockers: effectiveRecovery?.reconciliationBlockers ?? []
    }
}
