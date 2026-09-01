import { lstat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { AttemptSlot, CompactTargetRender, CurrentTtsPartialRecovery, CurrentTtsReconciliationBlocker, CurrentTtsRecoveredGenerationSlot, CurrentTtsSafeRedispatch, PipelineProviderState, ProviderRenderPlan, PureCurrentTtsRenderPlanOptions, RenderAdmissionJournalSnapshot } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { parseJsonlBytes } from '~/utils/jsonl-reader'
import { canonicalTtsJson, computePaidSpeechSlotHash, hashCanonicalTtsValue, sha256Bytes } from './contract-identity'
import { validateProviderBatchResult, validateProviderRenderPlanIdentity, validateRenderAdmissionJournalSnapshot } from './contract-validation'
import { contained, hasErrorCode, readObservedAudio, readVerifiedJson } from './attempt-io'
import { withIdentity } from './attempt-shared'
import { buildPureCurrentTtsRenderPlan, readAudioProjection, requestedOutput } from './attempt-planning'
import { readContainedArtifactFile } from './safe-artifact-store'
import { resolveStableTtsArtifactDir, resolveTtsOutputLayout } from './tts-output-layout'
import { resolveRetainedPath } from './recovery-evidence'

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
    throw UsageError(`Stored TTS slot ${input.slotHash} no longer matches its archive checksum.`)
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
      const parsed = parseJsonlBytes(retained.bytes, {
        allowTornFinalRecord: true,
        label: 'Stored TTS admission journal'
      }).at(-1) as { snapshot?: RenderAdmissionJournalSnapshot } | undefined
      if (!parsed) continue
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
      ) throw UsageError('Stored TTS render plan identity does not match its canonical projection.')
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
    throw UsageError(`Stored compatible TTS generation slot ${blocker.generationSlotId} has ${blocker.state} provider work in attempt ${blocker.attempt}, request ${blocker.requestOrdinal}; automatic redispatch is blocked pending reconciliation. Pass --allow-ambiguous-redispatch to safely reconcile the pending slot, reuse all completed segment audio, and resume synthesis without deleting output directories or losing work.`)
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
