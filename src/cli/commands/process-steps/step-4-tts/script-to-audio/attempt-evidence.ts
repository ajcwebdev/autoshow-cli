import { lstat } from 'node:fs/promises'
import type {
  AttemptContext,
  AttemptSlot,
  AttemptTurn,
  ObservedProviderRequest,
  ProviderBatchInvocationPlan,
  RuntimeRequest,
  TtsRequestEvidenceScope,
  TtsSerializedRequestObservation,
  TtsTargetInvocation,
  WrittenJson,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { hashCanonicalTtsValue, sha256Bytes } from './contract-identity'
import { classifyTtsProviderAdmissionError } from './tts-request-evidence'
import {
  withIdentity,
} from './attempt-shared'
import {
  contained,
  copyCreateOnly,
  hasErrorCode,
  readObservedAudio,
  writeJson,
} from './attempt-io'
import { sanitizeError } from './attempt-planning'
import {
  advanceJournal,
  ensureJournalStarted,
} from './attempt-journal'
import { locked } from './attempt-projection'
import { promoteBatchResult } from './attempt-batches'

const slotFor = (
  ctx: AttemptContext,
  invocation: TtsTargetInvocation | undefined,
  observation: TtsSerializedRequestObservation
): AttemptSlot => {
  const candidates = invocation
    ? ctx.purePlan.planned.slots.filter((slot) => slot.turnIds.includes(invocation.sourceId))
    : ctx.purePlan.planned.slots
  const providerSegmentOffset = invocation?.providerSegmentIndex ?? 0
  const slot = candidates[providerSegmentOffset + observation.chunkIndex - 1]
  if (!slot) {
    throw CLIUsageError(`Serializer emitted unplanned TTS chunk ${observation.chunkIndex}; dispatch was blocked before transport.`)
  }
  return slot
}

const recoverCompletedOutputs = (
  ctx: AttemptContext,
  invocation: TtsTargetInvocation
): { paths: string[], generationSlotIds: string[] } | undefined => {
  const turnSlots = ctx.purePlan.planned.slots.filter((slot) => slot.turnIds.includes(invocation.sourceId))
  const invocationSlots = invocation.providerSegmentIndex === undefined
    ? turnSlots
    : turnSlots.slice(invocation.providerSegmentIndex, invocation.providerSegmentIndex + 1)
  const recovered = invocationSlots.flatMap((slot) => {
    const retained = ctx.recoveredBySlot.get(slot.generationSlotId)
    return retained ? [retained] : []
  })
  if (recovered.length === 0) return undefined
  if (recovered.length !== invocationSlots.length) {
    throw CLIUsageError(`Recovered TTS output covers only part of invocation ${invocation.sourceId}; provider redispatch is blocked.`)
  }
  return {
    paths: recovered.flatMap((entry) => [...entry.outputPaths]),
    generationSlotIds: recovered.map((entry) => entry.value.generationSlotId),
  }
}

const validateObservationConstraints = (
  ctx: AttemptContext,
  slot: AttemptSlot,
  observation: TtsSerializedRequestObservation
): void => {
  if (!ctx.attemptSlotIds.has(slot.generationSlotId)) {
    throw CLIUsageError(`TTS generation slot ${slot.generationSlotId} is outside this bounded execution checkpoint.`)
  }
  if (ctx.recoveredBySlot.has(slot.generationSlotId)) {
    throw CLIUsageError(`TTS generation slot ${slot.generationSlotId} already has verified retained output; provider redispatch is blocked.`)
  }
  if (observation.providerText !== slot.providerText) {
    throw CLIUsageError('TTS serializer text differs from the immutable planned generation slot; dispatch was blocked.')
  }
  if (observation.endpointKind !== slot.expectedEndpointKind || observation.serializerVersion !== slot.expectedSerializerVersion) {
    throw CLIUsageError('TTS serializer endpoint/version is not authorized by the immutable render plan; dispatch was blocked.')
  }
  if (hashCanonicalTtsValue(observation.requestControls ?? {}) !== slot.expectedRequestControlsHash) {
    throw CLIUsageError('TTS serializer controls differ from the immutable render plan; dispatch was blocked.')
  }
  if (hashCanonicalTtsValue(observation.continuation ?? { kind: 'none' }) !== hashCanonicalTtsValue({ kind: 'none' })) {
    throw CLIUsageError('TTS serializer continuation differs from the immutable render plan; dispatch was blocked.')
  }
  for (const turnId of slot.turnIds) {
    const plannedTurn = ctx.purePlan.planned.turns.find((turn) => turn.canonical.turnId === turnId) as AttemptTurn
    const expectedSpeaker = ctx.options.comicContext?.providerSpeakerLabelByTurnId[turnId] ?? plannedTurn.canonical.subjectKey
    const serializedVoice = observation.voices.find((voice) => voice.speaker?.trim().toUpperCase() === expectedSpeaker.trim().toUpperCase())
      ?? (slot.turnIds.length === 1 ? observation.voices[0] : undefined)
    const serializedVoiceHash = serializedVoice?.valueHash ?? (serializedVoice?.value ? sha256Bytes(serializedVoice.value) : undefined)
    if (!serializedVoice || serializedVoice.kind !== plannedTurn.voice.kind || serializedVoiceHash !== plannedTurn.voice.valueHash) {
      throw CLIUsageError(`TTS serializer voice differs from the immutable binding for ${plannedTurn.canonical.turnId}; dispatch was blocked.`)
    }
  }
}

const dispatchAttemptRequest = async <T>(
  ctx: AttemptContext,
  invocation: TtsTargetInvocation | undefined,
  observation: TtsSerializedRequestObservation,
  attempt: Parameters<TtsRequestEvidenceScope['dispatch']>[1],
  operationFn: (context: { accepted: (acceptance?: { providerRequestId?: string | undefined, fields?: Readonly<Record<string, string | number | boolean | null>> | undefined }) => Promise<void> }) => Promise<T>
): Promise<T> => {
  const slot = slotFor(ctx, invocation, observation)
  validateObservationConstraints(ctx, slot, observation)

  const requestBodyHash = hashCanonicalTtsValue(observation.serializedRequest)
  const requestFingerprint = hashCanonicalTtsValue({
    endpointKind: observation.endpointKind,
    serializerVersion: observation.serializerVersion,
    requestBodyHash,
  })

  const runtime = await locked(ctx, async () => {
    const priorForSlot = ctx.runtimeRequests.filter((entry) => entry.slot.generationSlotId === slot.generationSlotId)
    const retryOf = attempt.attempt > 1 ? priorForSlot.at(-1) : undefined
    if (attempt.attempt > 1 && (!retryOf || retryOf.request.requestBodyHash !== requestBodyHash)) {
      throw CLIUsageError('TTS retry changed its generation slot or serialized request fingerprint; dispatch was blocked.')
    }
    if (attempt.attempt === 1 && priorForSlot.length > 0) {
      throw CLIUsageError('TTS serializer attempted a second deliberate request for one planned generation slot.')
    }
    let dispatchStarted = false
    try {
      await ensureJournalStarted(ctx)
      const invocationPlanPath = `${ctx.attemptRoot}/invocations/${slot.generationSlotId}.json`
      let invocationFile: WrittenJson<ProviderBatchInvocationPlan>
      if (retryOf) {
        invocationFile = retryOf.invocationFile
      } else {
        const invocationPlan = withIdentity({
          schemaVersion: 1 as const,
          renderPlanId: ctx.purePlan.renderPlanId,
          renderIdentity: ctx.purePlan.renderIdentity,
          invocationId: ctx.invocationId,
          attempt: ctx.attemptNumber,
          batchId: slot.batchId,
          generationSlotId: slot.generationSlotId,
          resolvedContinuation: { kind: 'none' as const },
          requestFingerprint,
          createdAt: ctx.now(),
        }, 'batchInvocationPlanId') as ProviderBatchInvocationPlan
        invocationFile = await writeJson(ctx.options.outputDir, invocationPlanPath, invocationPlan)
      }
      const requestOrdinal = ctx.runtimeRequests.length + 1
      const turnIds = slot.turnIds
      const observed: ObservedProviderRequest = {
        requestOrdinal,
        invocationId: ctx.invocationId,
        batchId: slot.batchId,
        generationSlotId: slot.generationSlotId,
        batchInvocationPlanId: invocationFile.value.batchInvocationPlanId,
        provider: ctx.options.target.service,
        model: ctx.options.target.model,
        transport: ctx.purePlan.transport,
        endpointKind: observation.endpointKind,
        serializerVersion: observation.serializerVersion,
        requestBodyHash,
        actualRequestControlsHash: hashCanonicalTtsValue(observation.requestControls ?? {}),
        actualContinuationHash: hashCanonicalTtsValue(observation.continuation ?? { kind: 'none' }),
        turns: turnIds.map((turnId) => {
          const turn = ctx.purePlan.planned.turns.find((entry) => entry.canonical.turnId === turnId) as AttemptTurn
          const expectedSpeaker = ctx.options.comicContext?.providerSpeakerLabelByTurnId[turnId] ?? turn.canonical.subjectKey
          const serializedVoice = observation.voices.find((voice) => voice.speaker?.trim().toUpperCase() === expectedSpeaker.trim().toUpperCase())
            ?? (turnIds.length === 1 ? observation.voices[0] : undefined)
          if (!serializedVoice) throw CLIUsageError('TTS serializer did not expose the serialized voice before dispatch.')
          return {
            turnId,
            providerTextHash: sha256Bytes(observation.providerText),
            voiceField: observation.voiceField,
            actualSerializedVoice: {
              kind: serializedVoice.kind,
              valueHash: serializedVoice.valueHash ?? sha256Bytes(serializedVoice.value ?? ''),
              provider: ctx.options.target.service,
            },
            actualSerializedControlsHash: hashCanonicalTtsValue(observation.requestControls ?? {}),
          }
        }),
      }
      const record = {
        requestOrdinal,
        batchId: slot.batchId,
        generationSlotId: slot.generationSlotId,
        batchInvocationPlanId: invocationFile.value.batchInvocationPlanId,
        batchInvocationPlanRef: contained(ctx.attemptRoot, invocationFile.path),
        batchInvocationPlanSha256: invocationFile.sha256,
        requestFingerprint,
        ...(retryOf ? { retryOfRequestOrdinal: retryOf.request.requestOrdinal } : {}),
        transitions: [{ sequence: 1, state: 'prepared' as const, at: ctx.now(), requestBodyHash }],
      }
      await advanceJournal(ctx, [...ctx.journal.requests, record])
      const dispatchRecord = {
        ...record,
        transitions: [
          ...record.transitions,
          {
            sequence: 2,
            state: 'dispatch-started' as const,
            at: ctx.now(),
            transportEvidenceHash: hashCanonicalTtsValue({ requestFingerprint, requestOrdinal }),
          },
        ],
      }
      await advanceJournal(ctx, [...ctx.journal.requests.slice(0, -1), dispatchRecord])
      dispatchStarted = true
      const entry: RuntimeRequest = {
        slot,
        invocationFile,
        request: observed,
        ...(retryOf ? { retry: { invocationId: ctx.invocationId, requestOrdinal, retryOfRequestOrdinal: retryOf.request.requestOrdinal, reasonCode: attempt.retryReasonCode ?? 'provider-retry' } } : {}),
        terminal: undefined,
      }
      ctx.runtimeRequests.push(entry)
      return entry
    } catch (error) {
      const durableDispatchStarted = ctx.journal.requests.some((request) =>
        request.transitions.at(-1)?.state === 'dispatch-started')
      if (!dispatchStarted && !durableDispatchStarted && ctx.attemptReservation) {
        await ctx.attemptReservation.release()
        ctx.attemptReservation = undefined
      }
      throw error
    }
  })

  let accepted = false
  const accept = async (acceptance?: {
    providerRequestId?: string | undefined
    fields?: Readonly<Record<string, string | number | boolean | null>> | undefined
  }) => await locked(ctx, async () => {
    if (accepted) return
    accepted = true
    runtime.request = {
      ...runtime.request,
      ...(acceptance?.providerRequestId ? { providerRequestId: acceptance.providerRequestId } : {}),
      acceptedAt: ctx.now(),
    }
    const evidence = withIdentity({
      schemaVersion: 1 as const,
      journalId: ctx.journalId,
      invocationId: ctx.invocationId,
      provider: ctx.options.target.service,
      requestOrdinal: runtime.request.requestOrdinal,
      requestFingerprint,
      evidenceKind: 'acceptance' as const,
      observedAt: runtime.request.acceptedAt,
      fields: { accepted: true, ...(acceptance?.fields ?? {}) },
    }, 'evidenceHash')
    const file = await writeJson(
      ctx.options.outputDir,
      `${ctx.attemptRoot}/evidence/request-${String(runtime.request.requestOrdinal).padStart(4, '0')}-acceptance.json`,
      evidence
    )
    const requests = ctx.journal.requests.map((entry) =>
      entry.requestOrdinal === runtime.request.requestOrdinal
        ? {
            ...entry,
            transitions: [
              ...entry.transitions,
              {
                sequence: entry.transitions.length + 1,
                state: 'provider-accepted' as const,
                at: runtime.request.acceptedAt as string,
                ...(acceptance?.providerRequestId ? { providerRequestId: acceptance.providerRequestId } : {}),
                evidence: {
                  journalId: ctx.journalId,
                  invocationId: ctx.invocationId,
                  requestOrdinal: entry.requestOrdinal,
                  requestFingerprint,
                  proofKind: 'acceptance' as const,
                  kind: 'sanitized-artifact' as const,
                  path: contained(ctx.attemptRoot, file.path),
                  sha256: file.sha256,
                },
              },
            ],
          }
        : entry
    )
    await advanceJournal(ctx, requests)
  })

  try {
    const value = await operationFn({ accepted: accept })
    await accept()
    return value
  } catch (error) {
    let rejected = false
    await locked(ctx, async () => {
      if (accepted) {
        runtime.terminal = 'ambiguous'
        return
      }
      rejected = !accepted && classifyTtsProviderAdmissionError(error) === 'rejected'
      const kind = rejected ? 'rejection' as const : 'ambiguity' as const
      const state = rejected ? 'provider-rejected' as const : 'ambiguous' as const
      const sanitized = sanitizeError(error, 'synthesis')
      const evidence = withIdentity({
        schemaVersion: 1 as const,
        journalId: ctx.journalId,
        invocationId: ctx.invocationId,
        provider: ctx.options.target.service,
        requestOrdinal: runtime.request.requestOrdinal,
        requestFingerprint,
        evidenceKind: kind,
        observedAt: ctx.now(),
        fields: {
          code: sanitized.code,
          retryable: sanitized.retryable,
          ...(sanitized.status !== undefined ? { status: sanitized.status } : {}),
          ...(sanitized.stage ? { stage: sanitized.stage } : {}),
          ...(sanitized.errorName ? { errorName: sanitized.errorName } : {}),
          ...(sanitized.providerMessage ? { providerMessage: sanitized.providerMessage } : {}),
          ...(sanitized.requestId ? { requestId: sanitized.requestId } : {}),
          ...(sanitized.retryAfterMs !== undefined ? { retryAfterMs: sanitized.retryAfterMs } : {}),
        },
      }, 'evidenceHash')
      const file = await writeJson(
        ctx.options.outputDir,
        `${ctx.attemptRoot}/evidence/request-${String(runtime.request.requestOrdinal).padStart(4, '0')}-${kind}.json`,
        evidence
      )
      const transition = rejected
        ? {
            sequence: 0,
            state: 'provider-rejected' as const,
            at: evidence.observedAt,
            evidence: {
              journalId: ctx.journalId,
              invocationId: ctx.invocationId,
              requestOrdinal: runtime.request.requestOrdinal,
              requestFingerprint,
              proofKind: 'rejection' as const,
              kind: 'sanitized-artifact' as const,
              path: contained(ctx.attemptRoot, file.path),
              sha256: file.sha256,
            },
          }
        : {
            sequence: 0,
            state: 'ambiguous' as const,
            at: evidence.observedAt,
            evidence: {
              journalId: ctx.journalId,
              invocationId: ctx.invocationId,
              requestOrdinal: runtime.request.requestOrdinal,
              requestFingerprint,
              proofKind: 'ambiguity' as const,
              kind: 'sanitized-artifact' as const,
              path: contained(ctx.attemptRoot, file.path),
              sha256: file.sha256,
            },
          }
      const requests = ctx.journal.requests.map((entry) =>
        entry.requestOrdinal === runtime.request.requestOrdinal
          ? { ...entry, transitions: [...entry.transitions, { ...transition, sequence: entry.transitions.length + 1 }] }
          : entry
      )
      runtime.terminal = state
      await advanceJournal(ctx, requests)
    })
    if (!rejected && error instanceof Error) {
      Object.defineProperty(error, 'ttsAdmissionAmbiguous', { value: true, configurable: true })
    }
    throw error
  }
}

const recordOutputForSlot = async (
  ctx: AttemptContext,
  invocation: TtsTargetInvocation | undefined,
  args: Parameters<TtsRequestEvidenceScope['recordOutput']>[0]
): Promise<void> => {
  const { chunkIndex, path, timing, timingFactory, providerGenerationId, warnings } = args
  await locked(ctx, async () => {
    const slot = slotFor(ctx, invocation, { chunkIndex } as TtsSerializedRequestObservation)
    if (!ctx.journalFile || !ctx.runtimeRequests.some((entry) => entry.slot.generationSlotId === slot.generationSlotId)) {
      throw CLIUsageError('TTS serializer output does not bind one dispatched generation slot.')
    }
    const slotHash = ctx.paidSpeechSlotHash(slot)
    const outputIndex = (ctx.outputsBySlot.get(slot.generationSlotId)?.length ?? 0) + 1
    const batchResultDir = `${ctx.attemptRoot}/batch-results/${slot.batchId}/${slot.generationSlotId}`
    const destination = `${batchResultDir}/audio-${String(outputIndex).padStart(3, '0')}.wav`
    await copyCreateOnly(ctx.options.outputDir, path, destination)
    const slotWavPath = `${ctx.options.outputDir}/${ctx.layout.slotWavPath(slotHash)}`
    try {
      await lstat(slotWavPath)
    } catch (error) {
      if (!hasErrorCode(error, 'ENOENT')) throw error
      await copyCreateOnly(ctx.options.outputDir, destination, slotWavPath)
    }
    const audio = await readObservedAudio(ctx.options.outputDir, destination)
    if (timing && timingFactory) {
      throw CLIUsageError('TTS serializer output supplied conflicting timing representations.')
    }
    if (timingFactory && slot.turnIds.length !== 1) {
      throw CLIUsageError('Provider timing for a hosted TTS chunk must bind exactly one planned turn.')
    }
    const turn = timingFactory
      ? ctx.purePlan.planned.turns.find((entry) => entry.canonical.turnId === slot.turnIds[0]) as AttemptTurn | undefined
      : undefined
    if (timingFactory && !turn) {
      throw CLIUsageError('Provider timing could not bind its planned turn identity.')
    }
    const boundTiming = timingFactory && turn
      ? timingFactory({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey })
      : timing
    const recorded = {
      path: destination,
      relativeToBatchResult: contained(batchResultDir, destination),
      sha256: sha256Bytes(audio.bytes),
      format: audio.format,
      durationMs: audio.durationMs,
      ...(boundTiming ? { timing: boundTiming } : {}),
      ...(providerGenerationId ? { providerGenerationId } : {}),
      ...(warnings ? { warnings: [...warnings] } : {}),
    }
    ctx.outputsBySlot.set(slot.generationSlotId, [...(ctx.outputsBySlot.get(slot.generationSlotId) ?? []), recorded])
  })
}

const completeSlotRequest = async (
  ctx: AttemptContext,
  invocation: TtsTargetInvocation | undefined,
  args: Parameters<TtsRequestEvidenceScope['complete']>[0]
): Promise<void> => {
  const { chunkIndex } = args
  await locked(ctx, async () => {
    const slot = slotFor(ctx, invocation, { chunkIndex } as TtsSerializedRequestObservation)
    const runtime = ctx.runtimeRequests.filter((entry) => entry.slot.generationSlotId === slot.generationSlotId).at(-1)
    if (!runtime || runtime.terminal !== undefined) {
      throw CLIUsageError('TTS serializer completion does not bind one open dispatched request.')
    }
    if (!(ctx.outputsBySlot.get(slot.generationSlotId)?.length)) {
      throw CLIUsageError('TTS serializer cannot complete a request before durable output promotion.')
    }
    const requestFingerprint = ctx.journal.requests.find((entry) => entry.requestOrdinal === runtime.request.requestOrdinal)?.requestFingerprint
    if (!requestFingerprint) {
      throw CLIUsageError('TTS serializer completion is missing its admission request fingerprint.')
    }
    const evidence = withIdentity({
      schemaVersion: 1 as const,
      journalId: ctx.journalId,
      invocationId: ctx.invocationId,
      provider: ctx.options.target.service,
      requestOrdinal: runtime.request.requestOrdinal,
      requestFingerprint,
      evidenceKind: 'completion' as const,
      observedAt: ctx.now(),
      fields: { completed: true },
    }, 'evidenceHash')
    const file = await writeJson(
      ctx.options.outputDir,
      `${ctx.attemptRoot}/evidence/request-${String(runtime.request.requestOrdinal).padStart(4, '0')}-completion.json`,
      evidence
    )
    const requests = ctx.journal.requests.map((entry) =>
      entry.requestOrdinal === runtime.request.requestOrdinal
        ? {
            ...entry,
            transitions: [
              ...entry.transitions,
              {
                sequence: entry.transitions.length + 1,
                state: 'completed' as const,
                at: evidence.observedAt,
                evidence: {
                  journalId: ctx.journalId,
                  invocationId: ctx.invocationId,
                  requestOrdinal: entry.requestOrdinal,
                  requestFingerprint,
                  proofKind: 'completion' as const,
                  kind: 'sanitized-artifact' as const,
                  path: contained(ctx.attemptRoot, file.path),
                  sha256: file.sha256,
                },
              },
            ],
          }
        : entry
    )
    runtime.terminal = 'completed'
    await advanceJournal(ctx, requests)
    await promoteBatchResult(ctx, slot)
  })
}

export const scopeFor = (
  ctx: AttemptContext,
  invocation?: TtsTargetInvocation | undefined
): TtsRequestEvidenceScope => ({
  forInvocation: (child) => scopeFor(ctx, child),
  recoverCompletedOutputs: invocation ? async () => recoverCompletedOutputs(ctx, invocation) : undefined,
  dispatch: async (observation, attempt, operationFn) => await dispatchAttemptRequest(ctx, invocation, observation, attempt, operationFn),
  recordOutput: async (args) => await recordOutputForSlot(ctx, invocation, args),
  complete: async (args) => await completeSlotRequest(ctx, invocation, args),
})
