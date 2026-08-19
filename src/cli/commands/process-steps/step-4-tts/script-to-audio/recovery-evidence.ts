import { lstat, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type {
  AudioRun,
  CanonicalAudioProviderProjection,
  CompactTargetRender,
  PipelineProviderState,
  ProviderRenderResult,
  RenderAdmissionJournalSnapshot,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import {
  hardlinkContainedArtifact,
  readContainedArtifactFile,
  releasePreparedInvocationAttemptClaim,
} from './safe-artifact-store'
import { canonicalTtsJson, hashCanonicalTtsValue, sha256Bytes } from './contract-identity'
import {
  validateProviderRenderResult,
  validateRenderAdmissionJournalSnapshot,
} from './contract-validation'
import { contained, publishReportedOutput, readObservedAudio, readVerifiedJson } from './attempt-io'
import type {
  CurrentTtsCompletedRecovery,
  PureCurrentTtsRenderPlanOptions,
} from './attempt-shared'
import {
  buildPureCurrentTtsRenderPlan,
  readAudioMetadataProjection,
  readAudioProjection,
} from './attempt-planning'

export type RetainedJournalEvidence = {
  value: RenderAdmissionJournalSnapshot
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
  const selectedSuccess = resultProjection.selectedSuccess
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
        resultIdentity: selectedSuccess.resultIdentity,
        audioRunId: selectedSuccess.audioRunId,
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
  const providerResult = await readVerifiedJson<ProviderRenderResult>(
    options.rootDir,
    providerResultPath,
    audioRun.providerResult.sha256,
    'Selected TTS provider result'
  )
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
