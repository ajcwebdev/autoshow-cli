import { readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { AttemptSlot, LoadedRecoveryBatch, ObservedProviderRequest, ProviderBatchInvocationPlan, ProviderBatchOutput, ProviderBatchResult, RecordedOutput, RenderAdmissionJournalSnapshot, RetainedBatchCandidate, RetainedJournalEvidence, TtsTarget } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { canonicalTtsJson, hashCanonicalTtsValue, sha256Bytes } from './contract-identity'
import { validateProviderBatchResult, validateRenderAdmissionJournalSnapshot } from './contract-validation'
import { contained, hasErrorCode, readObservedAudio, readVerifiedJson } from './attempt-io'
import { withIdentity } from './attempt-shared'
import { buildPureCurrentTtsRenderPlan } from './attempt-planning'
import { readContainedArtifactFile } from './safe-artifact-store'
import { resolveRetainedPath } from './recovery-evidence'

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
