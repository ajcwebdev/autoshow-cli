import { lstat, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type {
  AudioRun,
  CanonicalAudioProviderProjection,
  CompactTargetRender,
  ObservedProviderRequest,
  PipelineProviderState,
  PlannedCost,
  ProviderBatchInvocationPlan,
  ProviderBatchOutput,
  ProviderBatchResult,
  ProviderBatchResultRef,
  ProviderRenderPlan,
  ProviderRenderResult,
  RenderAdmissionJournalSnapshot,
  TtsTarget,
} from '~/types'
import { CLIUsageError, InternalError } from '~/utils/error-handler'
import { concatAndConvertToWav } from '../tts-utils/audio-utils'
import {
  hardlinkContainedArtifact,
  readContainedArtifactFile,
  releasePreparedInvocationAttemptClaim,
} from './safe-artifact-store'
import {
  canonicalTtsJson,
  computePaidSpeechSlotHash,
  hashCanonicalTtsValue,
  sha256Bytes,
} from './contract-identity'
import {
  validateProviderBatchResult,
  validateProviderRenderPlanIdentity,
  validateProviderRenderResult,
  validateRenderAdmissionJournalSnapshot,
} from './contract-validation'
import { resolveStableTtsArtifactDir, resolveTtsOutputLayout } from './tts-output-layout'
import {
  type AttemptSlot,
  type CurrentTtsCompletedRecovery,
  type CurrentTtsPartialRecovery,
  type CurrentTtsReconciliationBlocker,
  type CurrentTtsRecoveredGenerationSlot,
  type CurrentTtsResumePricePlan,
  type CurrentTtsSafeRedispatch,
  LOCAL_ACTOR,
  type PureCurrentTtsRenderPlanOptions,
  type RecordedOutput,
  withIdentity,
} from './attempt-shared'
import {
  contained,
  copyCreateOnly,
  hasErrorCode,
  materializeRecoveredBatch,
  publishReportedOutput,
  readObservedAudio,
  readVerifiedJson,
  writeJsonCreateOnly,
} from './attempt-io'
import {
  buildPureCurrentTtsRenderPlan,
  planCurrentTtsReadiness,
  readAudioMetadataProjection,
  readAudioProjection,
  requestedOutput,
  stateForProjection,
  sumCosts,
} from './attempt-planning'
import {
  assembleComicSegmentedAudio,
  comicTimelineLayout,
  localVoiceEffectFilter,
} from './comic-segmented-audio'

export type LoadedRecoveryBatch = CurrentTtsRecoveredGenerationSlot & Readonly<{
  value: Extract<ProviderBatchResult, { provenance: 'provider-dispatch' }>
  attemptRoot: string
}>

export type RetainedJournalEvidence = {
  value: RenderAdmissionJournalSnapshot
  path: string
  sha256: string
  attemptRoot: string
}

export type RetainedBatchCandidate = {
  batchId: string
  generationSlotId: string
  batchResultId: string
  path: string
  sha256: string
  attemptRoot: string
}

export const resolveRetainedPath = (baseDir: string, artifactRef: string, label: string): string => {
  const base = resolve(baseDir)
  const path = resolve(base, artifactRef)
  const fromBase = relative(base, path)
  if (!fromBase || fromBase === '..' || fromBase.startsWith(`..${sep}`)) {
    throw CLIUsageError(`${label} escapes its retained evidence directory.`)
  }
  return path
}

export const readJournalSnapshotFromLedger = async (
  rootDir: string,
  path: string,
  snapshotId?: string,
  expectedSha256?: string
): Promise<RenderAdmissionJournalSnapshot> => {
  const retained = await readContainedArtifactFile(rootDir, contained(rootDir, path))
  if (expectedSha256 && retained.sha256 !== expectedSha256 && !snapshotId) {
    throw CLIUsageError('Stored TTS admission journal checksum does not match retained canonical evidence.')
  }
  const lines = retained.bytes.toString('utf8').split('\n').filter((line) => line.length > 0)
  if (lines.length === 0) throw CLIUsageError('Stored TTS admission journal is empty.')
  const parsedLines = lines.map((line) => JSON.parse(line) as { snapshot?: RenderAdmissionJournalSnapshot })
  const selected = snapshotId
    ? parsedLines.find((entry) => entry.snapshot?.snapshotId === snapshotId)
    : parsedLines.at(-1)
  if (!selected?.snapshot) throw CLIUsageError('Stored TTS admission journal line is missing its snapshot.')
  validateRenderAdmissionJournalSnapshot(selected.snapshot)
  return selected.snapshot
}

export const readLatestJournalSnapshot = async (
  rootDir: string,
  path: string,
  expectedSha256: string
): Promise<RenderAdmissionJournalSnapshot> =>
  await readJournalSnapshotFromLedger(rootDir, path, undefined, expectedSha256)

export const resolveCurrentTtsPriorAdmittedAttemptCount = async (options: {
  rootDir: string
  state: PipelineProviderState
}): Promise<number> => {
  const retainedCount = options.state.attempts
  const projection = readAudioProjection(options.state)
  const active = projection?.activeWork
  if (!projection || active?.kind !== 'render' || retainedCount === 0) return retainedCount
  const render = projection.renderHistory.find((entry) => entry.renderIdentity === active.renderIdentity)
  const event = render?.events.find((entry) => entry.sequence === active.eventSequence)
  if (event?.status !== 'running' || event.attempt !== retainedCount) return retainedCount
  const journalPath = active.journalPath
  if (!journalPath) return retainedCount
  const boundJournalRef = event.admissionJournalRef
    ? `${options.state.artifactDir}/${event.admissionJournalRef}`
    : journalPath
  const journal = boundJournalRef.endsWith('.jsonl')
    ? await readJournalSnapshotFromLedger(
      options.rootDir,
      `${options.rootDir}/${journalPath}`,
      event.admissionJournalSnapshotId,
      event.admissionJournalSha256
    )
    : await readVerifiedJson<RenderAdmissionJournalSnapshot>(
      options.rootDir,
      `${options.rootDir}/${boundJournalRef}`,
      event.admissionJournalSha256 ?? (await readContainedArtifactFile(options.rootDir, boundJournalRef)).sha256,
      'Stored TTS admission journal'
    )
  if (
    journal.snapshotId !== event.admissionJournalSnapshotId
    || journal.renderIdentity !== active.renderIdentity
    || journal.attempt !== retainedCount
  ) {
    throw CLIUsageError('Stored TTS admission journal does not bind the retained provider-attempt count.')
  }
  const hasDurableDispatch = journal.requests.some((request) =>
    request.transitions.some((transition) => transition.state !== 'prepared'))
  if (hasDurableDispatch) return retainedCount
  if (journal.requests.length === 0 || journal.requests.some((request) => request.transitions.length !== 1 || request.transitions[0]?.state !== 'prepared')) {
    throw CLIUsageError('Stored TTS provider attempt has no durable dispatch but is not an exact prepared-only journal.')
  }
  const attemptsDirectory = join(options.rootDir, dirname(journalPath), 'attempts')
  const claimPath = join(attemptsDirectory, `.attempt-${String(journal.attempt).padStart(3, '0')}.claim`)
  try {
    await lstat(claimPath)
  } catch (error) {
    if ((error as { code?: unknown })?.code === 'ENOENT') return retainedCount - 1
    throw error
  }
  await releasePreparedInvocationAttemptClaim(options.rootDir, {
    attemptsDirectory: contained(options.rootDir, attemptsDirectory),
    attempt: journal.attempt,
    invocationId: journal.invocationId
  })
  return retainedCount - 1
}

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
  const value = withIdentity(resultBase, 'batchResultId') as ProviderBatchResult
  validateProviderBatchResult(value)
  return {
    value,
    path: `${input.rootDir}/${input.layout.slotResultPath(input.slotHash)}`,
    sha256: sha256Bytes(`${canonicalTtsJson(value)}\n`),
    outputPaths: [wavPath],
    requiresMaterialization: input.requiresMaterialization,
  }
}

export const validateRecoveryProjections = (
  options: PureCurrentTtsRenderPlanOptions & { rootDir: string; state: PipelineProviderState },
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>
): {
  resultProjection: CanonicalAudioProviderProjection
  metadataProjection: CanonicalAudioProviderProjection
} => {
  if (options.state.targetKey !== pure.targetKey || options.state.artifactDir.trim().length === 0) {
    throw CLIUsageError('Stored TTS provider state does not bind the exact planned target identity.')
  }
  const resultProjection = readAudioProjection(options.state)
  const metadataProjection = readAudioMetadataProjection(options.state)
  if (!resultProjection || !metadataProjection || canonicalTtsJson(resultProjection) !== canonicalTtsJson(metadataProjection)) {
    throw CLIUsageError('Stored TTS provider state is missing one exact canonical projection.')
  }
  return { resultProjection, metadataProjection }
}

export const prepareCompactRenderRecovery = async (
  options: PureCurrentTtsRenderPlanOptions & {
    rootDir: string
    state: PipelineProviderState
    onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
  },
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  resultProjection: CanonicalAudioProviderProjection
): Promise<CurrentTtsCompletedRecovery | undefined> => {
  if (
    !resultProjection.archive
    || resultProjection.selectedSuccess?.renderIdentity !== pure.renderIdentity
    || resultProjection.renderHistory.length !== 0
  ) {
    return undefined
  }
  const archive = resultProjection.archive
  const compactRender = await readVerifiedJson<CompactTargetRender>(
    options.rootDir,
    resolve(options.rootDir, archive.renderRef.path),
    archive.renderRef.sha256,
    'Compact TTS render'
  )
  if (compactRender.renderIdentity !== pure.renderIdentity || compactRender.renderPlanId !== pure.renderPlanId || compactRender.targetKey !== pure.targetKey) {
    throw CLIUsageError('Compact TTS render does not bind the exact planned render identity.')
  }
  await readVerifiedJson(options.rootDir, resolve(options.rootDir, archive.timelineRef.path), archive.timelineRef.sha256, 'Compact TTS timeline')
  const finalAudio = await readObservedAudio(options.rootDir, resolve(options.rootDir, archive.finalRef.path))
  if (sha256Bytes(finalAudio.bytes) !== archive.finalRef.sha256) {
    throw CLIUsageError('Compact TTS final output no longer matches its archive checksum.')
  }
  return {
    kind: 'complete-render',
    preparedState: options.state,
    chunkCount: compactRender.slots.length,
    reconciliationBlockers: [],
    finalize: async (_workspaceDir, reportedOutputPath) => {
      await hardlinkContainedArtifact(options.rootDir, archive.finalRef.path, contained(options.rootDir, reportedOutputPath)).catch(async () => {
        await publishReportedOutput(options.rootDir, resolve(options.rootDir, archive.finalRef.path), reportedOutputPath, resultProjection)
      })
      return {
        artifactDir: options.state.artifactDir,
        operation: pure.operation,
        targetKey: pure.targetKey,
        transport: pure.transport,
        renderIdentity: pure.renderIdentity,
        resultIdentity: resultProjection.selectedSuccess?.resultIdentity as string,
        audioRunId: resultProjection.selectedSuccess?.audioRunId as string,
        strategy: pure.planned.strategy,
        projection: resultProjection,
      }
    }
  }
}

export const prepareSelectedSuccess = async (
  options: PureCurrentTtsRenderPlanOptions & {
    rootDir: string
    state: PipelineProviderState
    onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
  },
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  resultProjection: CanonicalAudioProviderProjection,
  retainedRender: CanonicalAudioProviderProjection['renderHistory'][number],
  providerRoot: string,
  renderRoot: string,
  plannedSlotIds: string[]
): Promise<CurrentTtsCompletedRecovery | undefined> => {
  const selectedSuccess = resultProjection.selectedSuccess?.renderIdentity === pure.renderIdentity
    ? resultProjection.selectedSuccess
    : undefined
  if (!selectedSuccess) return undefined
  const selectedEvent = retainedRender.events.find((event) => event.sequence === selectedSuccess.eventSequence)
  if (
    selectedEvent?.status !== 'succeeded'
    || selectedEvent.audioRunId !== selectedSuccess.audioRunId
    || selectedEvent.providerRenderResultIdentity !== selectedSuccess.resultIdentity
    || !selectedEvent.audioRunRef
    || !selectedEvent.audioRunSha256
  ) throw CLIUsageError('Selected TTS success does not bind one complete terminal render event.')
  const audioRunPath = resolveRetainedPath(providerRoot, selectedEvent.audioRunRef, 'Selected TTS AudioRun')
  const audioRun = await readVerifiedJson<AudioRun>(options.rootDir, audioRunPath, selectedEvent.audioRunSha256, 'Selected TTS AudioRun')
  const { audioRunId: _audioRunId, ...audioRunBase } = audioRun
  if (
    audioRun.audioRunId !== selectedSuccess.audioRunId
    || audioRun.audioRunId !== hashCanonicalTtsValue(audioRunBase)
    || audioRun.targetKey !== pure.targetKey
    || audioRun.renderIdentity !== pure.renderIdentity
    || audioRun.renderPlanId !== pure.renderPlanId
    || audioRun.providerResult.resultIdentity !== selectedSuccess.resultIdentity
  ) throw CLIUsageError('Selected TTS AudioRun does not bind the exact planned render and selected success.')
  const providerResultPath = resolveRetainedPath(renderRoot, audioRun.providerResult.path, 'Selected TTS provider result')
  const providerResult = await readVerifiedJson<ProviderRenderResult>(options.rootDir, providerResultPath, audioRun.providerResult.sha256, 'Selected TTS provider result')
  validateProviderRenderResult(providerResult)
  if (
    providerResult.status !== 'succeeded'
    || providerResult.resultIdentity !== selectedSuccess.resultIdentity
    || providerResult.renderIdentity !== pure.renderIdentity
    || providerResult.renderPlanId !== pure.renderPlanId
  ) throw CLIUsageError('Selected TTS provider result is not a complete success for the exact planned render.')
  const audioRunRoot = dirname(audioRunPath)
  for (const ref of [audioRun.mixPlan, audioRun.transformLedger, audioRun.finalTimeline]) {
    await readVerifiedJson(options.rootDir, resolveRetainedPath(audioRunRoot, ref.path, 'Selected TTS AudioRun dependency'), ref.sha256, 'Selected TTS AudioRun dependency')
  }
  const finalOutput = audioRun.finalOutputs[0]
  if (!finalOutput || audioRun.finalOutputs.length !== 1) throw CLIUsageError('Selected TTS AudioRun must retain exactly one canonical final output.')
  const finalOutputPath = resolveRetainedPath(audioRunRoot, finalOutput.path, 'Selected TTS final output')
  const finalAudio = await readObservedAudio(options.rootDir, finalOutputPath)
  if (
    sha256Bytes(finalAudio.bytes) !== finalOutput.sha256
    || finalAudio.durationMs !== finalOutput.durationMs
    || canonicalTtsJson(finalAudio.format) !== canonicalTtsJson(finalOutput.format)
  ) throw CLIUsageError('Selected TTS final output no longer matches its AudioRun checksum, duration, or format.')
  const eventOutput = selectedEvent.outputRefs?.find((ref) => resolveRetainedPath(providerRoot, ref.path, 'Selected TTS event output') === finalOutputPath)
  if (!eventOutput || eventOutput.sha256 !== finalOutput.sha256) throw CLIUsageError('Selected TTS terminal event does not checksum-bind its AudioRun final output.')
  return {
    kind: 'complete-render',
    preparedState: options.state,
    chunkCount: plannedSlotIds.length,
    reconciliationBlockers: [],
    finalize: async (_workspaceDir, reportedOutputPath) => {
      await publishReportedOutput(options.rootDir, finalOutputPath, reportedOutputPath, resultProjection)
      return {
        artifactDir: options.state.artifactDir,
        operation: pure.operation,
        targetKey: pure.targetKey,
        transport: pure.transport,
        renderIdentity: pure.renderIdentity,
        resultIdentity: selectedSuccess.resultIdentity,
        audioRunId: selectedSuccess.audioRunId,
        strategy: pure.planned.strategy,
        projection: resultProjection,
      }
    }
  }
}

export const collectRetainedJournalEvidence = async (
  options: { rootDir: string },
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  providerRoot: string,
  retainedRender: CanonicalAudioProviderProjection['renderHistory'][number],
  plannedSlotIds: string[]
): Promise<{
  journalEvidenceById: Map<string, RetainedJournalEvidence>
  knownJournalSnapshots: Set<string>
  terminalJournalEvidence?: RetainedJournalEvidence | undefined
}> => {
  const journalEvidenceById = new Map<string, RetainedJournalEvidence>()
  const knownJournalSnapshots = new Set<string>()
  const directJournalEvidence: RetainedJournalEvidence[] = []
  for (const event of retainedRender.events) {
    if (!event.admissionJournalRef && !event.admissionJournalSha256 && !event.admissionJournalSnapshotId) continue
    if (!event.admissionJournalRef || !event.admissionJournalSha256 || !event.admissionJournalSnapshotId) {
      throw CLIUsageError('Stored TTS admission journal reference is incomplete.')
    }
    if (knownJournalSnapshots.has(event.admissionJournalSnapshotId)) continue
    const path = resolveRetainedPath(providerRoot, event.admissionJournalRef, 'Stored TTS admission journal')
    const value = path.endsWith('.jsonl')
      ? await readLatestJournalSnapshot(options.rootDir, path, event.admissionJournalSha256)
      : await readVerifiedJson<RenderAdmissionJournalSnapshot>(options.rootDir, path, event.admissionJournalSha256, 'Stored TTS admission journal')
    validateRenderAdmissionJournalSnapshot(value)
    if (
      value.snapshotId !== event.admissionJournalSnapshotId
      || value.renderIdentity !== pure.renderIdentity
      || value.renderPlanId !== pure.renderPlanId
      || value.requests.some((request) => !plannedSlotIds.includes(request.generationSlotId))
    ) throw CLIUsageError('Stored TTS admission journal does not bind the exact planned render and generation-slot set.')
    const evidence = { value, path, sha256: event.admissionJournalSha256, attemptRoot: dirname(path) }
    journalEvidenceById.set(value.journalId, evidence)
    knownJournalSnapshots.add(value.snapshotId)
    directJournalEvidence.push(evidence)
  }
  let terminalJournalEvidence = directJournalEvidence.at(-1)
  if (!terminalJournalEvidence) {
    return { journalEvidenceById, knownJournalSnapshots, terminalJournalEvidence: undefined }
  }
  const terminalDirectJournal = terminalJournalEvidence
  const directJournalEvidenceByAttemptRoot = new Map<string, RetainedJournalEvidence[]>()
  for (const evidence of directJournalEvidence) {
    const entries = directJournalEvidenceByAttemptRoot.get(evidence.attemptRoot) ?? []
    entries.push(evidence)
    directJournalEvidenceByAttemptRoot.set(evidence.attemptRoot, entries)
  }
  for (const [attemptRoot, directAttemptEvidence] of directJournalEvidenceByAttemptRoot) {
    let attemptFrontier = directAttemptEvidence.at(-1) as RetainedJournalEvidence
    const orphanJournalCandidates: RetainedJournalEvidence[] = []
    for (const name of (await readdir(attemptRoot)).filter((entry) => /^admission-journal-\d+\.json$/.test(entry)).sort()) {
      const path = resolve(attemptRoot, name)
      const retained = await readContainedArtifactFile(options.rootDir, contained(options.rootDir, path))
      let value: RenderAdmissionJournalSnapshot
      try {
        value = JSON.parse(retained.bytes.toString('utf8')) as RenderAdmissionJournalSnapshot
        validateRenderAdmissionJournalSnapshot(value)
      } catch {
        throw CLIUsageError('Stored TTS attempt contains an invalid orphan admission-journal artifact; reconciliation is required.')
      }
      if (knownJournalSnapshots.has(value.snapshotId)) continue
      if (
        value.journalId !== attemptFrontier.value.journalId
        || value.renderIdentity !== pure.renderIdentity
        || value.renderPlanId !== pure.renderPlanId
        || value.invocationId !== attemptFrontier.value.invocationId
        || value.attempt !== attemptFrontier.value.attempt
      ) throw CLIUsageError('Stored TTS attempt contains a cross-attempt orphan journal; reconciliation is required.')
      orphanJournalCandidates.push({ value, path, sha256: retained.sha256, attemptRoot })
    }
    const attemptJournalBySnapshot = new Map<string, RetainedJournalEvidence>(
      directAttemptEvidence.map((entry) => [entry.value.snapshotId, entry])
    )
    for (const candidate of orphanJournalCandidates) attemptJournalBySnapshot.set(candidate.value.snapshotId, candidate)
    let ancestor = attemptFrontier
    while (ancestor.value.previousSnapshotId) {
      const candidate = attemptJournalBySnapshot.get(ancestor.value.previousSnapshotId)
      if (!candidate) break
      validateRenderAdmissionJournalSnapshot(ancestor.value, candidate.value)
      const orphanIndex = orphanJournalCandidates.indexOf(candidate)
      if (orphanIndex >= 0) orphanJournalCandidates.splice(orphanIndex, 1)
      ancestor = candidate
    }
    while (true) {
      const children = orphanJournalCandidates.filter((candidate) => candidate.value.previousSnapshotId === attemptFrontier.value.snapshotId)
      if (children.length === 0) break
      if (children.length !== 1) throw CLIUsageError('Stored TTS attempt contains a forked orphan journal chain; reconciliation is required.')
      const child = children[0] as RetainedJournalEvidence
      validateRenderAdmissionJournalSnapshot(child.value, attemptFrontier.value)
      attemptFrontier = child
      knownJournalSnapshots.add(child.value.snapshotId)
      orphanJournalCandidates.splice(orphanJournalCandidates.indexOf(child), 1)
    }
    if (orphanJournalCandidates.length > 0) {
      throw CLIUsageError('Stored TTS attempt contains an unchained orphan journal; reconciliation is required.')
    }
    journalEvidenceById.set(attemptFrontier.value.journalId, attemptFrontier)
    if (attemptRoot === terminalDirectJournal.attemptRoot) terminalJournalEvidence = attemptFrontier
  }
  return { journalEvidenceById, knownJournalSnapshots, terminalJournalEvidence }
}

export const discoverBatchCandidates = async (
  options: { rootDir: string },
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  renderRoot: string,
  journalEvidenceById: Map<string, RetainedJournalEvidence>,
  retainedRender: CanonicalAudioProviderProjection['renderHistory'][number]
): Promise<Map<string, RetainedBatchCandidate>> => {
  const batchCandidates = new Map<string, RetainedBatchCandidate>()
  const addBatchCandidate = (candidate: RetainedBatchCandidate): void => {
    const existing = batchCandidates.get(candidate.batchResultId)
    if (existing && canonicalTtsJson(existing) !== canonicalTtsJson(candidate)) {
      throw CLIUsageError('Stored TTS batch-result identity has conflicting retained artifact bindings.')
    }
    batchCandidates.set(candidate.batchResultId, candidate)
  }
  for (const evidence of journalEvidenceById.values()) {
    for (const reference of evidence.value.recordedBatchResults) {
      addBatchCandidate({
        batchId: reference.batchId,
        generationSlotId: reference.generationSlotId,
        batchResultId: reference.batchResultId,
        path: resolveRetainedPath(evidence.attemptRoot, reference.batchResultRef, 'Stored provider batch result'),
        sha256: reference.batchResultSha256,
        attemptRoot: evidence.attemptRoot
      })
    }
  }
  for (const event of retainedRender.events) {
    for (const batch of event.batchProgress ?? []) {
      for (const slot of batch.generationSlots) {
        if (slot.source !== 'provider-dispatch' || !slot.batchResult) continue
        const path = resolveRetainedPath(renderRoot, slot.batchResult.path, 'Stored provider batch result')
        const relativeResult = relative(renderRoot, path).split(sep)
        const batchResultsIndex = relativeResult.lastIndexOf('batch-results')
        if (batchResultsIndex < 1) throw CLIUsageError('Stored provider batch result is outside an immutable provider attempt.')
        addBatchCandidate({
          batchId: batch.batchId,
          generationSlotId: slot.generationSlotId,
          batchResultId: slot.batchResult.batchResultId,
          path,
          sha256: slot.batchResult.sha256,
          attemptRoot: resolve(renderRoot, ...relativeResult.slice(0, batchResultsIndex))
        })
      }
    }
  }
  for (const attemptRoot of new Set([...journalEvidenceById.values()].map((evidence) => evidence.attemptRoot))) {
    const orphanResultNames = (await readdir(attemptRoot, { recursive: true }))
      .map((name) => name.split(sep).join('/'))
      .filter((name) => /^batch-results\/[^/]+\/[^/]+\/provider-batch-result\.json$/.test(name))
      .sort()
    for (const name of orphanResultNames) {
      const path = resolve(attemptRoot, name)
      const retained = await readContainedArtifactFile(options.rootDir, contained(options.rootDir, path))
      let value: ProviderBatchResult
      try {
        value = JSON.parse(retained.bytes.toString('utf8')) as ProviderBatchResult
        validateProviderBatchResult(value)
      } catch {
        throw CLIUsageError('Stored TTS attempt contains an invalid orphan provider batch result; reconciliation is required.')
      }
      if (value.provenance !== 'provider-dispatch') continue
      if (value.renderIdentity !== pure.renderIdentity || value.renderPlanId !== pure.renderPlanId) {
        throw CLIUsageError('Stored TTS attempt contains a cross-render orphan provider batch result; reconciliation is required.')
      }
      addBatchCandidate({
        batchId: value.batchId,
        generationSlotId: value.generationSlotId,
        batchResultId: value.batchResultId,
        path,
        sha256: retained.sha256,
        attemptRoot
      })
    }
  }
  return batchCandidates
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
    if (value.status !== 'succeeded') continue
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
    const conflictingSlot = loadedBatches.find((batch) => batch.value.generationSlotId === value.generationSlotId)
    if (conflictingSlot && conflictingSlot.value.batchResultId !== value.batchResultId) {
      throw CLIUsageError(`Stored TTS generation slot ${value.generationSlotId} has conflicting promoted batch results.`)
    }
    if (!conflictingSlot) loadedBatches.push({ value: value as Extract<ProviderBatchResult, { provenance: 'provider-dispatch' }>, path, sha256: candidate.sha256, attemptRoot, outputPaths })
  }

  for (const evidence of journalEvidenceById.values()) {
    const completedRequests = evidence.value.requests.filter((request) =>
      request.transitions.at(-1)?.state === 'completed'
      && !loadedBatches.some((batch) => batch.value.generationSlotId === request.generationSlotId))
    for (const request of completedRequests) {
      const requestsForSlot = evidence.value.requests.filter((candidate) => candidate.generationSlotId === request.generationSlotId)
      if (requestsForSlot.length !== 1 || request.retryOfRequestOrdinal !== undefined) continue
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
      const outputNames = (await readdir(batchResultDir).catch((error) => {
        if ((error as { code?: unknown })?.code === 'ENOENT') return []
        throw error
      }))
        .filter((name) => /^audio-\d{3}\.[A-Za-z0-9]+$/.test(name))
        .sort()
      if (outputNames.length === 0) continue
      if (outputNames.some((name, index) => !name.startsWith(`audio-${String(index + 1).padStart(3, '0')}.`))) {
        throw CLIUsageError(`Completed TTS generation slot ${slot.generationSlotId} has non-contiguous retained audio outputs.`)
      }
      const recordedOutputs: RecordedOutput[] = await Promise.all(outputNames.map(async (name) => {
        const path = resolve(batchResultDir, name)
        const audio = await readObservedAudio(options.rootDir, path)
        return {
          path,
          relativeToBatchResult: contained(batchResultDir, path),
          sha256: sha256Bytes(audio.bytes),
          format: audio.format,
          durationMs: audio.durationMs,
          warnings: ['Recovered from durable completion evidence after interrupted batch-result promotion.']
        }
      }))
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
      const observedRequest: ObservedProviderRequest = {
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
      const result = withIdentity(resultBase, 'batchResultId') as Extract<ProviderBatchResult, { provenance: 'provider-dispatch' }>
      validateProviderBatchResult(result)
      const path = resolve(batchResultDir, 'provider-batch-result.json')
      const sha256 = sha256Bytes(`${canonicalTtsJson(result)}\n`)
      loadedBatches.push({ value: result, path, sha256, attemptRoot: evidence.attemptRoot, outputPaths: recordedOutputs.map((output) => output.path), requiresMaterialization: true })
    }
  }
  return loadedBatches
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
  const plannedSlotIds = pure.planned.slots.map((slot) => slot.generationSlotId)
  const completedSlotIds = new Set<string>()
  const retainedAttemptCosts: PlannedCost[] = []
  const costedDispatches = new Set<string>()
  const reconciliationBlockers: CurrentTtsReconciliationBlocker[] = []
  for (const evidence of journalEvidenceById.values()) {
    for (const request of evidence.value.requests) {
      if (!plannedSlotIds.includes(request.generationSlotId)) {
        throw CLIUsageError('Stored TTS admission journal contains a request outside the immutable generation-slot plan.')
      }
      const terminal = request.transitions.at(-1)?.state
      if (terminal === 'completed') completedSlotIds.add(request.generationSlotId)
      if (request.retryOfRequestOrdinal === undefined && request.transitions.some((transition) => transition.state === 'dispatch-started')) {
        const key = `${evidence.value.invocationId}\0${request.generationSlotId}`
        if (!costedDispatches.has(key)) {
          const slot = pure.planned.slots.find((entry) => entry.generationSlotId === request.generationSlotId)
          if (!slot) throw CLIUsageError('Stored TTS dispatch has no matching immutable planned slot cost.')
          costedDispatches.add(key)
          retainedAttemptCosts.push(slot.plannedCost)
        }
      }
    }
  }
  for (const slotId of plannedSlotIds) {
    const requests = [...journalEvidenceById.values()].flatMap((evidence) => evidence.value.requests
      .filter((request) => request.generationSlotId === slotId)
      .map((request) => ({ evidence, request })))
    const completedRequestCount = requests.filter(({ request }) => request.transitions.at(-1)?.state === 'completed').length
    if (completedRequestCount > 1) {
      throw CLIUsageError(`Stored TTS generation slot ${slotId} has more than one completed deliberate request.`)
    }
    const hasRecoveredSuccess = loadedBatches.some((batch) => batch.value.generationSlotId === slotId)
    const unsafeRequests = hasRecoveredSuccess ? [] : requests.filter(({ request }) => {
      const state = request.transitions.at(-1)?.state
      return state !== undefined
        && state !== 'completed'
        && state !== 'prepared'
        && state !== 'provider-rejected'
        && state !== 'confirmed-not-admitted'
    })
    for (const { evidence, request } of unsafeRequests) {
      const state = request.transitions.at(-1)?.state
      if (!state) continue
      reconciliationBlockers.push({ generationSlotId: slotId, state, attempt: evidence.value.attempt, invocationId: evidence.value.invocationId, requestOrdinal: request.requestOrdinal })
    }
    const blocker = reconciliationBlockers.find((entry) => entry.generationSlotId === slotId)
    if (blocker && options.reconciliationMode !== 'report' && options.ttsOptions.ttsAllowAmbiguousRedispatch !== true) {
      throw CLIUsageError(`Stored TTS generation slot ${slotId} has ${blocker.state} provider work in attempt ${blocker.attempt}, request ${blocker.requestOrdinal}; automatic redispatch is blocked pending reconciliation. Pass --allow-ambiguous-redispatch to safely reconcile the pending slot, reuse all completed segment audio, and resume synthesis without deleting output directories or losing work.`)
    }
  }
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
  const retainedCumulativePlannedCost = sumCosts(retainedAttemptCosts)
  for (const slotId of completedSlotIds) {
    if (loadedBatches.filter((batch) => batch.value.generationSlotId === slotId).length !== 1) {
      if (options.ttsOptions.ttsAllowAmbiguousRedispatch === true) continue
      throw CLIUsageError(`Stored completed TTS generation slot ${slotId} has no exact promoted batch result.`)
    }
  }
  return { completedSlotIds, retainedCumulativePlannedCost, reconciliationBlockers }
}

export const assembleCompletedRenderRecovery = async (
  options: PureCurrentTtsRenderPlanOptions & {
    rootDir: string
    state: PipelineProviderState
    onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
    reconciliationMode?: 'enforce' | 'report' | undefined
  },
  pure: ReturnType<typeof buildPureCurrentTtsRenderPlan>,
  resultProjection: CanonicalAudioProviderProjection,
  retainedRender: CanonicalAudioProviderProjection['renderHistory'][number],
  renderRoot: string,
  providerRoot: string,
  journalEvidenceById: Map<string, RetainedJournalEvidence>,
  terminalJournalEvidence: RetainedJournalEvidence,
  loadedBatches: LoadedRecoveryBatch[],
  retainedCumulativePlannedCost: PlannedCost,
  reconciliationBlockers: CurrentTtsReconciliationBlocker[]
): Promise<CurrentTtsCompletedRecovery> => {
  const plannedSlotIds = pure.planned.slots.map((slot) => slot.generationSlotId)
  let terminalJournal = terminalJournalEvidence.value
  let terminalJournalPath = terminalJournalEvidence.path
  let terminalJournalSha256 = terminalJournalEvidence.sha256
  let renderResult: ProviderRenderResult | undefined
  let resultPath: string | undefined
  let resultSha256: string | undefined
  for (const aggregateJournalEvidence of [...journalEvidenceById.values()].reverse()) {
    const aggregateReference = aggregateJournalEvidence.value.recordedResult
    if (!aggregateReference) continue
    const candidatePath = resolveRetainedPath(aggregateJournalEvidence.attemptRoot, aggregateReference.resultRef, 'Stored provider render result')
    const candidate = await readVerifiedJson<ProviderRenderResult>(options.rootDir, candidatePath, aggregateReference.resultSha256, 'Stored provider render result')
    validateProviderRenderResult(candidate)
    if (
      candidate.resultIdentity !== aggregateReference.resultIdentity
      || candidate.renderIdentity !== pure.renderIdentity
      || candidate.renderPlanId !== pure.renderPlanId
    ) throw CLIUsageError('Stored provider render result does not bind the exact planned render.')
    if (candidate.status !== 'succeeded') continue
    if (renderResult && renderResult.resultIdentity !== candidate.resultIdentity) {
      throw CLIUsageError('Stored TTS render has conflicting successful aggregate provider results; reconciliation is required.')
    }
    renderResult = candidate
    resultPath = candidatePath
    resultSha256 = aggregateReference.resultSha256
    terminalJournal = aggregateJournalEvidence.value
    terminalJournalPath = aggregateJournalEvidence.path
    terminalJournalSha256 = aggregateJournalEvidence.sha256
  }
  const terminalReadinessAuthorization = [...retainedRender.events].reverse().find((event) =>
    event.attempt === terminalJournal.attempt && event.readinessAuthorization)?.readinessAuthorization

  return {
    kind: 'complete-render',
    preparedState: options.state,
    chunkCount: plannedSlotIds.length,
    reconciliationBlockers,
    finalize: async (workspaceDir, reportedOutputPath) => {
      await Promise.all(loadedBatches.map(async (batch) => await materializeRecoveredBatch(options.rootDir, batch)))
      const orderedBatches = pure.planned.slots.map((slot) => loadedBatches.find((batch) => batch.value.generationSlotId === slot.generationSlotId) as LoadedRecoveryBatch)
      if (!renderResult || !resultPath || !resultSha256) {
        const batchRefs: ProviderBatchResultRef[] = orderedBatches.map((batch) => ({
          batchId: batch.value.batchId,
          generationSlotId: batch.value.generationSlotId,
          batchResultId: batch.value.batchResultId,
          artifactRef: contained(renderRoot, batch.path),
          sha256: batch.sha256
        }))
        const observedRequests = orderedBatches.flatMap((batch) => batch.value.observedRequests)
        const requestedTurnIds = pure.planned.turns.map((turn) => turn.canonical.turnId)
        const turnOutcomes = requestedTurnIds.map((turnId) => {
          const batches = orderedBatches.filter((batch) => batch.value.requestedTurnIds.includes(turnId))
          const requests = batches.flatMap((batch) => batch.value.observedRequests.filter((request) =>
            request.turns.some((turn) => turn.turnId === turnId)))
          return {
            turnId,
            status: 'succeeded' as const,
            observedRequests: requests.map((request) => ({ invocationId: request.invocationId, requestOrdinal: request.requestOrdinal })),
            batchIds: [...new Set(batches.map((batch) => batch.value.batchId))],
            generationSlotIds: batches.map((batch) => batch.value.generationSlotId),
            outputIds: batches.flatMap((batch) => batch.value.outputs.map((output) => output.outputId))
          }
        })
        const compositionId = hashCanonicalTtsValue({
          renderPlanId: pure.renderPlanId,
          renderIdentity: pure.renderIdentity,
          batchResults: batchRefs
        })
        const promoted = withIdentity({
          schemaVersion: 1 as const,
          closedBy: { kind: 'local-composition' as const, compositionId },
          renderPlanId: pure.renderPlanId,
          renderIdentity: pure.renderIdentity,
          status: 'succeeded' as const,
          requestedTurnIds,
          batchResults: batchRefs,
          observedRequests,
          outputs: orderedBatches.flatMap((batch) => batch.value.outputs.map((output) => ({ ...output, batchResultId: batch.value.batchResultId }))),
          generatedBatches: orderedBatches.flatMap((batch) => batch.value.generatedBatch ? [batch.value.generatedBatch] : []),
          turnOutcomes,
          createdResources: orderedBatches.flatMap((batch) => batch.value.createdResources),
          retryAttempts: orderedBatches.flatMap((batch) => batch.value.retryAttempts),
          cost: {
            currentComposition: { planned: pure.plannedRenderCost, observed: [] },
            closingAttempt: { planned: { amounts: [] }, observed: [] },
            cumulativeRenderHistory: { planned: retainedCumulativePlannedCost, observed: [] }
          }
        }, 'resultIdentity') as ProviderRenderResult
        validateProviderRenderResult(promoted)
        const resultFile = await writeJsonCreateOnly(options.rootDir, `${renderRoot}/compositions/${compositionId}/provider-render-result.json`, promoted)
        renderResult = promoted
        resultPath = resultFile.path
        resultSha256 = resultFile.sha256
      }
      const activeRenderResult = renderResult
      const activeResultPath = resultPath
      const activeResultSha256 = resultSha256
      if (!activeRenderResult || !activeResultPath || !activeResultSha256) {
        throw InternalError('Completed TTS recovery did not promote one aggregate provider result.', { stage: 'tts:reconciliation' })
      }
      const orderedOutputs = orderedBatches.flatMap((batch) => batch.outputPaths)
      const masteringProfile = options.ttsOptions.ttsMasteringProfile
      const assembledPath = options.comicContext && pure.planned.strategy === 'segmented'
        ? await assembleComicSegmentedAudio({
            dialoguePlan: options.comicContext.dialoguePlan,
            turns: pure.planned.turns.map(turn => turn.canonical),
            slots: pure.planned.slots,
            outputPathsBySlot: new Map(orderedBatches.map(batch => [batch.value.generationSlotId, batch.outputPaths] as const)),
            masteringDir: workspaceDir,
            providerLabel: `${options.target.service}-recovery`,
            profile: masteringProfile ?? (() => { throw CLIUsageError('Comic segmented recovery requires an explicit mastering profile.') })(),
          })
        : await concatAndConvertToWav(orderedOutputs, workspaceDir, `${options.target.service}-recovery`, undefined, masteringProfile)
      const recoveryAt = terminalJournal.capturedAt
      const audioRunRoot = `${renderRoot}/results/${activeRenderResult.resultIdentity}/recovery-audio-run-${terminalJournal.snapshotId.slice(0, 16)}`
      const finalPath = `${audioRunRoot}/final.wav`
      await copyCreateOnly(options.rootDir, assembledPath, finalPath)
      const finalAudio = await readObservedAudio(options.rootDir, finalPath)
      const speechSources = activeRenderResult.outputs.map((output) => ({ kind: 'provider-output' as const, sourceId: output.outputId, resultIdentity: activeRenderResult.resultIdentity, batchResultId: output.batchResultId, outputId: output.outputId, artifactRef: output.artifactRef, sha256: output.sha256 }))
      const assemblyParametersHash = hashCanonicalTtsValue({ sourceIds: speechSources.map((source) => source.sourceId), strategy: pure.planned.strategy, requestedOutput: requestedOutput(options), recoveryJournalSnapshotId: terminalJournal.snapshotId, dialogueNodes: pure.planned.dialoguePlan.nodes })
      const mixPlan = withIdentity({
        schemaVersion: 1 as const,
        renderIdentity: pure.renderIdentity,
        outputProfileHash: pure.outputProfileHash,
        sources: speechSources,
        operations: [{ kind: options.comicContext && pure.planned.strategy === 'segmented' ? 'dialogue-node-assembly' : speechSources.length > 1 ? 'ordered-concat' : 'single-source', parametersHash: assemblyParametersHash }],
        createdAt: recoveryAt
      }, 'mixPlanId')
      const mixPlanFile = await writeJsonCreateOnly(options.rootDir, `${audioRunRoot}/mix-plan.json`, mixPlan)
      const transcodeParametersHash = hashCanonicalTtsValue({ ...requestedOutput(options), orderedConcat: speechSources.length > 1 })
      const transformOperation = {
        operationId: hashCanonicalTtsValue({ kind: 'transcode', transcodeParametersHash, finalDurationMs: finalAudio.durationMs }),
        kind: 'transcode' as const,
        finalRangeMs: { start: 0, end: finalAudio.durationMs },
        parametersHash: transcodeParametersHash
      }
      const turnDuration = (turnId: string): number => loadedBatches
          .filter((batch) => batch.value.requestedTurnIds.length === 1 && batch.value.requestedTurnIds[0] === turnId)
          .flatMap((batch) => batch.value.outputs)
          .reduce((sum, output) => sum + (output.durationMs ?? 0), 0)
      const timingSegmentDuration = (turnId: string, segmentIndex: number): number => {
        const slotIds = new Set(pure.planned.slots.filter(slot => slot.turnIds.length === 1 && slot.turnIds[0] === turnId && (slot.timingSegmentIndex ?? 0) === segmentIndex).map(slot => slot.generationSlotId))
        return loadedBatches.filter(batch => slotIds.has(batch.value.generationSlotId)).flatMap(batch => batch.value.outputs).reduce((sum, output) => sum + (output.durationMs ?? 0), 0)
      }
      const layout = options.comicContext ? comicTimelineLayout(options.comicContext.dialoguePlan, turnDuration, timingSegmentDuration) : undefined
      let genericTimelineCursorMs = 0
      const assembledTurns = layout?.turns ?? pure.planned.turns.map((turn) => {
        const startMs = genericTimelineCursorMs
        genericTimelineCursorMs += turnDuration(turn.canonical.turnId)
        return { turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, startMs, endMs: genericTimelineCursorMs }
      })
      const effectOperations = assembledTurns.flatMap((assembled) => {
        const turn = pure.planned.turns.find(candidate => candidate.canonical.turnId === assembled.turnId)?.canonical
        if (!turn?.effect || !localVoiceEffectFilter(turn)) return []
        const parametersHash = hashCanonicalTtsValue(turn.effect)
        return [{ operationId: hashCanonicalTtsValue({ kind: 'effect', turnId: assembled.turnId, parametersHash, finalRangeMs: { start: assembled.startMs, end: assembled.endMs } }), kind: 'effect' as const, finalRangeMs: { start: assembled.startMs, end: assembled.endMs }, parametersHash }]
      })
      const overlapOperations = (layout?.overlaps ?? []).map((overlap) => {
        const parametersHash = hashCanonicalTtsValue({ groupId: overlap.groupId })
        return { operationId: hashCanonicalTtsValue({ kind: 'overlap', groupId: overlap.groupId, parametersHash, finalRangeMs: { start: overlap.start, end: overlap.end } }), kind: 'overlap' as const, finalRangeMs: { start: overlap.start, end: overlap.end }, parametersHash }
      })
      const pauseOperations = (layout?.pauses ?? []).map((pause) => {
        const parametersHash = hashCanonicalTtsValue(pause.parameters)
        return { operationId: hashCanonicalTtsValue({ kind: 'pause', parametersHash, finalRangeMs: { start: pause.start, end: pause.end } }), kind: 'pause' as const, finalRangeMs: { start: pause.start, end: pause.end }, parametersHash }
      })
      const ledger = withIdentity({ schemaVersion: 1 as const, renderIdentity: pure.renderIdentity, operations: [transformOperation, ...effectOperations, ...overlapOperations, ...pauseOperations] }, 'transformLedgerId')
      const ledgerFile = await writeJsonCreateOnly(options.rootDir, `${audioRunRoot}/transform-ledger.json`, ledger)
      const hasTiming = pure.planned.strategy === 'segmented' && assembledTurns.every((turn) => turn.endMs > turn.startMs)
      const timeline = withIdentity({
        schemaVersion: 1 as const,
        renderIdentity: pure.renderIdentity,
        timing: hasTiming
          ? { availability: 'timed' as const, clock: 'final-audio-ms' as const, provenance: 'assembled-segments' as const, turns: assembledTurns }
          : { availability: 'unavailable' as const, clock: 'final-audio-ms' as const, provenance: 'unavailable' as const, turns: pure.planned.turns.map((turn) => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey })), reason: 'Recovered provider timing was not exposed at exact turn boundaries.' },
        speechSources,
        transformLedgerRef: { path: contained(audioRunRoot, ledgerFile.path), sha256: ledgerFile.sha256 }
      }, 'timelineId')
      const timelineFile = await writeJsonCreateOnly(options.rootDir, `${audioRunRoot}/final-timeline.json`, timeline)
      const audioRun = withIdentity({
        schemaVersion: 1 as const,
        targetKey: pure.targetKey,
        renderPlanId: pure.renderPlanId,
        renderIdentity: pure.renderIdentity,
        providerResult: { resultIdentity: activeRenderResult.resultIdentity, path: contained(renderRoot, activeResultPath), sha256: activeResultSha256 },
        takeSelections: [],
        continuationCheckpoints: [],
        mixPlan: { mixPlanId: mixPlan.mixPlanId, path: contained(audioRunRoot, mixPlanFile.path), sha256: mixPlanFile.sha256 },
        transformLedger: { transformLedgerId: ledger.transformLedgerId, path: contained(audioRunRoot, ledgerFile.path), sha256: ledgerFile.sha256 },
        finalTimeline: { timelineId: timeline.timelineId, path: contained(audioRunRoot, timelineFile.path), sha256: timelineFile.sha256 },
        finalOutputs: [{ path: contained(audioRunRoot, finalPath), sha256: sha256Bytes(finalAudio.bytes), format: finalAudio.format, durationMs: finalAudio.durationMs }],
        createdAt: recoveryAt
      }, 'audioRunId') as AudioRun
      const audioRunFile = await writeJsonCreateOnly(options.rootDir, `${audioRunRoot}/audio-run.json`, audioRun)
      await publishReportedOutput(options.rootDir, assembledPath, reportedOutputPath, resultProjection)
      const reportedBytes = (await readContainedArtifactFile(options.rootDir, contained(options.rootDir, reportedOutputPath))).bytes
      const readinessAuthorization = terminalReadinessAuthorization
      if (activeRenderResult.closedBy.kind === 'provider-attempt' && !readinessAuthorization) {
        throw CLIUsageError('Stored completed TTS attempt has no exact readiness authorization.')
      }
      const nextEventSequence = (retainedRender.events.at(-1)?.sequence ?? 0) + 1
      const batchProgress = pure.planned.batches.map((batch) => ({
        batchId: batch.batchId,
        generationSlots: batch.generationSlots.map((slot) => {
          const loaded = loadedBatches.find((entry) => entry.value.generationSlotId === slot.generationSlotId) as LoadedRecoveryBatch
          return {
            generationSlotId: slot.generationSlotId,
            source: 'provider-dispatch' as const,
            batchInvocationPlan: {
              batchInvocationPlanId: loaded.value.batchInvocationPlan.batchInvocationPlanId,
              path: contained(renderRoot, resolveRetainedPath(loaded.attemptRoot, loaded.value.batchInvocationPlan.artifactRef, 'Stored batch invocation plan')),
              sha256: loaded.value.batchInvocationPlan.sha256
            },
            batchResult: { batchResultId: loaded.value.batchResultId, path: contained(renderRoot, loaded.path), sha256: loaded.sha256, status: loaded.value.status }
          }
        })
      }))
      const terminalEvent = {
        sequence: nextEventSequence,
        status: 'succeeded' as const,
        at: recoveryAt,
        attempt: terminalJournal.attempt,
        ...(activeRenderResult.closedBy.kind === 'provider-attempt' ? {
          readinessAuthorization: readinessAuthorization as NonNullable<typeof readinessAuthorization>,
          admissionJournalSnapshotId: terminalJournal.snapshotId,
          admissionJournalRef: contained(providerRoot, terminalJournalPath),
          admissionJournalSha256: terminalJournalSha256
        } : {}),
        providerRenderResultIdentity: activeRenderResult.resultIdentity,
        providerRenderResultRef: contained(providerRoot, activeResultPath),
        providerRenderResultSha256: activeResultSha256,
        batchProgress,
        outputRefs: [{ path: contained(providerRoot, finalPath), sha256: sha256Bytes(finalAudio.bytes) }],
        reportedOutputRefs: [{ path: contained(options.rootDir, reportedOutputPath), sha256: sha256Bytes(reportedBytes) }],
        audioRunId: audioRun.audioRunId,
        audioRunRef: contained(providerRoot, audioRunFile.path),
        audioRunSha256: audioRunFile.sha256
      }
      const renderHistory = resultProjection.renderHistory.map((entry) => entry.renderIdentity === pure.renderIdentity
        ? { ...entry, events: [...entry.events, terminalEvent] }
        : entry)
      const pointerAt = recoveryAt
      const pointerStart = resultProjection.pointerEvents.reduce((maximum, entry) => Math.max(maximum, entry.sequence), 0) + 1
      const projection: CanonicalAudioProviderProjection = {
        activeWork: { kind: 'render', renderIdentity: pure.renderIdentity, eventSequence: nextEventSequence },
        selectedSuccess: { renderIdentity: pure.renderIdentity, eventSequence: nextEventSequence, resultIdentity: activeRenderResult.resultIdentity, audioRunId: audioRun.audioRunId },
        branchHistory: resultProjection.branchHistory,
        readinessAttempts: resultProjection.readinessAttempts,
        renderHistory,
        pointerEvents: [
          ...resultProjection.pointerEvents,
          { sequence: pointerStart, action: 'activate-render', renderIdentity: pure.renderIdentity, eventSequence: nextEventSequence, actor: LOCAL_ACTOR, at: pointerAt },
          { sequence: pointerStart + 1, action: 'select-success', renderIdentity: pure.renderIdentity, eventSequence: nextEventSequence, resultIdentity: activeRenderResult.resultIdentity, audioRunId: audioRun.audioRunId, actor: LOCAL_ACTOR, at: pointerAt }
        ]
      }
      const state = stateForProjection(options.target, pure.targetKey, pure.transport, options.state.artifactDir, projection)
      await options.onProviderState?.(state)
      return { artifactDir: options.state.artifactDir, operation: pure.operation, targetKey: pure.targetKey, transport: pure.transport, renderIdentity: pure.renderIdentity, resultIdentity: activeRenderResult.resultIdentity, audioRunId: audioRun.audioRunId, strategy: pure.planned.strategy, projection }
    }
  }
}

export const prepareCurrentTtsCompletedRecovery = async (options: PureCurrentTtsRenderPlanOptions & {
  rootDir: string
  state: PipelineProviderState
  onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
  reconciliationMode?: 'enforce' | 'report' | undefined
}): Promise<CurrentTtsCompletedRecovery | CurrentTtsPartialRecovery | CurrentTtsSafeRedispatch | undefined> => {
  const pure = buildPureCurrentTtsRenderPlan(options)
  const { resultProjection } = validateRecoveryProjections(options, pure)

  const compactRecovery = await prepareCompactRenderRecovery(options, pure, resultProjection)
  if (compactRecovery) return compactRecovery

  const retainedRender = resultProjection.renderHistory.find((entry) => entry.renderIdentity === pure.renderIdentity)
  if (!retainedRender) {
    throw CLIUsageError(`Stored TTS target ${options.state.service}/${options.state.model ?? ''} does not match the exact planned render identity; rebuild instead of resuming it.`)
  }
  const providerRoot = resolve(options.rootDir, options.state.artifactDir)
  const renderRoot = resolveRetainedPath(providerRoot, retainedRender.renderDir, 'Stored TTS render directory')
  const plannedSlotIds = pure.planned.slots.map((slot) => slot.generationSlotId)

  const { journalEvidenceById, knownJournalSnapshots, terminalJournalEvidence } = await collectRetainedJournalEvidence(
    options,
    pure,
    providerRoot,
    retainedRender,
    plannedSlotIds
  )
  if (!terminalJournalEvidence) return undefined

  const selectedRecovery = await prepareSelectedSuccess(options, pure, resultProjection, retainedRender, providerRoot, renderRoot, plannedSlotIds)
  if (selectedRecovery) return selectedRecovery

  const batchCandidates = await discoverBatchCandidates(options, pure, renderRoot, journalEvidenceById, retainedRender)
  const loadedBatches = await loadRecoveryBatches(options, pure, batchCandidates, journalEvidenceById, knownJournalSnapshots)

  const { retainedCumulativePlannedCost, reconciliationBlockers } = reconcileSlotCosts(
    pure,
    journalEvidenceById,
    loadedBatches,
    options
  )

  if (loadedBatches.length === 0) {
    return { kind: 'safe-redispatch', retainedCumulativePlannedCost, reconciliationBlockers }
  }
  const allCompleted = loadedBatches.length === plannedSlotIds.length
    && plannedSlotIds.every((slotId) => loadedBatches.some((batch) => batch.value.generationSlotId === slotId))
  if (!allCompleted) {
    if (pure.planned.strategy !== 'segmented') {
      throw CLIUsageError('Partial completed-slot recovery is supported only for immutable segmented dialogue renders; redispatch is blocked.')
    }
    return { kind: 'partial-slots', recoveredSlots: loadedBatches, retainedCumulativePlannedCost, reconciliationBlockers }
  }

  return await assembleCompletedRenderRecovery(
    options,
    pure,
    resultProjection,
    retainedRender,
    renderRoot,
    providerRoot,
    journalEvidenceById,
    terminalJournalEvidence,
    loadedBatches,
    retainedCumulativePlannedCost,
    reconciliationBlockers
  )
}

export const prepareCurrentTtsCompatibleSlotRecovery = async (options: PureCurrentTtsRenderPlanOptions & {
  rootDir: string
  outputDir: string
  artifactRoot?: string | undefined
  state: PipelineProviderState
  materialize?: boolean | undefined
  reconciliationMode?: 'enforce' | 'report' | undefined
}): Promise<CurrentTtsPartialRecovery | CurrentTtsSafeRedispatch | undefined> => {
  const pure = buildPureCurrentTtsRenderPlan(options)
  if (pure.planned.strategy !== 'segmented' || options.state.targetKey !== pure.targetKey) return undefined
  if (options.materialize !== false && options.reconciliationMode !== 'report' && options.ttsOptions.ttsAllowAmbiguousRedispatch !== true) {
    const report = await prepareCurrentTtsCompatibleSlotRecovery({ ...options, materialize: false, reconciliationMode: 'report' })
    const blocker = report?.reconciliationBlockers[0]
    if (blocker) {
      throw CLIUsageError(`Stored compatible TTS generation slot ${blocker.generationSlotId} has ${blocker.state} provider work in attempt ${blocker.attempt}, request ${blocker.requestOrdinal}; automatic redispatch is blocked pending reconciliation. Pass --allow-ambiguous-redispatch to safely reconcile the pending slot, reuse all completed segment audio, and resume synthesis without deleting output directories or losing work.`)
    }
  }
  const projection = readAudioProjection(options.state)
  if (!projection) return undefined
  const layout = resolveTtsOutputLayout(options.artifactRoot ?? (options.comicContext ? 'audio/providers' : 'providers'), pure.targetKey, pure.renderIdentity)
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
  const providerRoot = resolve(options.rootDir, options.state.artifactDir)
  const currentSlots = new Map(pure.planned.slots.map((slot) => [slot.generationSlotId, slot] as const))
  const blockerCandidates = new Map<string, CurrentTtsReconciliationBlocker>()

  for (const retainedRender of [...projection.renderHistory].reverse()) {
    if (retainedRender.renderIdentity === pure.renderIdentity) continue
    const retainedPlanPath = resolveRetainedPath(providerRoot, retainedRender.renderPlanRef, 'Stored TTS render plan')
    const retainedPlan = await readVerifiedJson<ProviderRenderPlan>(options.rootDir, retainedPlanPath, retainedRender.renderPlanSha256, 'Stored TTS render plan')
    validateProviderRenderPlanIdentity(retainedPlan)
    if (retainedPlan.renderIdentity !== retainedRender.renderIdentity || retainedPlan.renderPlanId !== retainedRender.renderPlanId) {
      throw CLIUsageError('Stored TTS render plan identity does not match its canonical projection.')
    }
    const currentPlan = pure.renderPlan
    if (
      retainedPlan.strategy !== 'segmented'
      || retainedPlan.targetKey !== currentPlan.targetKey
      || retainedPlan.sourceIdentityHash !== currentPlan.sourceIdentityHash
      || retainedPlan.dialoguePlanId !== currentPlan.dialoguePlanId
      || retainedPlan.provider !== currentPlan.provider
      || retainedPlan.model !== currentPlan.model
      || retainedPlan.transport !== currentPlan.transport
      || canonicalTtsJson(retainedPlan.requestedOutput) !== canonicalTtsJson(currentPlan.requestedOutput)
    ) continue

    const retainedSlotIds = retainedPlan.batches.flatMap((batch) => batch.generationSlots.map((slot) => slot.generationSlotId))
    const compatibleSlotIds = new Set(retainedSlotIds.filter((generationSlotId) => {
      if (!currentSlots.has(generationSlotId)) return false
      const oldCompatibilityHash = compatibleSegmentedSlotHash(retainedPlan, generationSlotId)
      return oldCompatibilityHash !== undefined && oldCompatibilityHash === compatibleSegmentedSlotHash(currentPlan, generationSlotId)
    }))
    if (compatibleSlotIds.size === 0) continue

    const retainedArtifactRoot = options.artifactRoot ?? (options.comicContext ? 'audio/providers' : 'providers')
    const retainedLayout = resolveTtsOutputLayout(retainedArtifactRoot, pure.targetKey, retainedRender.renderIdentity)
    const retainedRenderJournalPath = `${resolveStableTtsArtifactDir(retainedArtifactRoot, pure.targetKey)}/renders/${retainedRender.renderIdentity}/journal.jsonl`
    const journalCandidates = new Set<string>([
      `${options.rootDir}/${retainedLayout.journalPath}`,
      `${options.rootDir}/${retainedRenderJournalPath}`,
    ])
    if (projection.activeWork?.kind === 'render' && projection.activeWork.renderIdentity === retainedRender.renderIdentity && projection.activeWork.journalPath) {
      journalCandidates.add(`${options.rootDir}/${projection.activeWork.journalPath}`)
    }
    for (const journalPath of journalCandidates) {
      try {
        await lstat(journalPath)
      } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) continue
        throw error
      }
      const retained = await readContainedArtifactFile(options.rootDir, contained(options.rootDir, journalPath))
      const lines = retained.bytes.toString('utf8').split('\n').filter((line) => line.length > 0)
      const last = lines.at(-1)
      if (!last) continue
      const parsed = JSON.parse(last) as { snapshot?: RenderAdmissionJournalSnapshot }
      if (!parsed.snapshot) continue
      validateRenderAdmissionJournalSnapshot(parsed.snapshot)
      const journal = parsed.snapshot
      if (journal.renderIdentity !== retainedPlan.renderIdentity || journal.renderPlanId !== retainedPlan.renderPlanId) continue
      for (const request of journal.requests) {
        if (!compatibleSlotIds.has(request.generationSlotId)) continue
        const state = request.transitions.at(-1)?.state
        if (
          state === undefined
          || state === 'completed'
          || state === 'prepared'
          || state === 'provider-rejected'
          || state === 'confirmed-not-admitted'
        ) continue
        blockerCandidates.set(`${retainedPlan.renderIdentity}\0${journal.journalId}\0${request.requestOrdinal}`, {
          generationSlotId: request.generationSlotId,
          state,
          attempt: journal.attempt,
          invocationId: journal.invocationId,
          requestOrdinal: request.requestOrdinal,
        })
      }
    }
  }
  const reconciliationBlockers = [...blockerCandidates.values()]
    .filter((blocker) => !recovered.has(blocker.generationSlotId))
    .sort((left, right) => left.attempt - right.attempt || left.requestOrdinal - right.requestOrdinal)
  const blocker = reconciliationBlockers[0]
  if (blocker && options.reconciliationMode !== 'report' && options.ttsOptions.ttsAllowAmbiguousRedispatch !== true) {
    throw CLIUsageError(`Stored compatible TTS generation slot ${blocker.generationSlotId} has ${blocker.state} provider work in attempt ${blocker.attempt}, request ${blocker.requestOrdinal}; automatic redispatch is blocked pending reconciliation. Pass --allow-ambiguous-redispatch to safely reconcile the pending slot, reuse all completed segment audio, and resume synthesis without deleting output directories or losing work.`)
  }
  if (recovered.size === 0) {
    return reconciliationBlockers.length === 0
      ? undefined
      : { kind: 'safe-redispatch', retainedCumulativePlannedCost: { amounts: [] }, reconciliationBlockers }
  }
  return { kind: 'partial-slots', recoveredSlots: [...recovered.values()], retainedCumulativePlannedCost: { amounts: [] }, reconciliationBlockers }
}

export const planCurrentTtsResumePrice = async (options: PureCurrentTtsRenderPlanOptions & {
  rootDir: string
  state?: PipelineProviderState | undefined
}): Promise<CurrentTtsResumePricePlan> => {
  const { rootDir, state, ...planOptions } = options
  const planned = buildPureCurrentTtsRenderPlan(planOptions)
  const readiness = planCurrentTtsReadiness(planOptions)
  const slots = planned.planned.slots
  const requestedSlotLimit = planOptions.ttsOptions.ttsMaxGenerationSlots
  if (requestedSlotLimit !== undefined && (!Number.isSafeInteger(requestedSlotLimit) || requestedSlotLimit <= 0)) {
    throw CLIUsageError('TTS maximum generation slots must be a positive safe integer.')
  }
  const projection = state ? readAudioProjection(state) : undefined
  const retainedHasPlannedRender = projection?.activeWork?.kind === 'render'
    && projection.renderHistory.some((render) => render.renderIdentity === readiness.renderIdentity)
  const sameRenderArchive = Boolean(projection?.archive && projection.selectedSuccess?.renderIdentity === readiness.renderIdentity)
  const recovery = state && (retainedHasPlannedRender || sameRenderArchive)
    ? await prepareCurrentTtsCompletedRecovery({ rootDir, state, ...planOptions, reconciliationMode: 'report' })
    : undefined
  const compatibleRecovery = state && !retainedHasPlannedRender && !sameRenderArchive
    ? await prepareCurrentTtsCompatibleSlotRecovery({ rootDir, outputDir: rootDir, state, ...planOptions, materialize: false, reconciliationMode: 'report' })
    : undefined
  const effectiveRecovery = recovery ?? compatibleRecovery
  const recoveredIds = new Set(effectiveRecovery?.kind === 'complete-render'
    ? slots.map((slot) => slot.generationSlotId)
    : effectiveRecovery?.kind === 'partial-slots'
      ? effectiveRecovery.recoveredSlots.map((slot) => slot.value.generationSlotId)
      : [])
  const unresolvedSlots = slots.filter((slot) => !recoveredIds.has(slot.generationSlotId))
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
    unresolvedCharacterCount: selectedSlots.reduce((count, slot) => count + [...slot.providerText].length, 0),
    recoveredSlotCount: slots.length - unresolvedSlots.length,
    recoveryKind: effectiveRecovery?.kind ?? 'none',
    reconciliationBlockers: effectiveRecovery?.reconciliationBlockers ?? []
  }
}
