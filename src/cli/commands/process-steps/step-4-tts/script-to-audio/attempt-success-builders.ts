import type {
  AudioMixPlan,
  AudioRun,
  AudioTransformLedger,
  CanonicalDialoguePlanNode,
  CanonicalAudioProviderProjection,
  CompactAudioArchive,
  CompactAudioArchiveSlot,
  CompactTargetRender,
  FinalTimeline,
  NormalizedTiming,
  ProviderRenderResult,
  ProviderRenderStrategy,
  RequestedAudioFormat,
  RenderAudioSourceBinding,
  AttemptSlot,
  AttemptTurn,
  BatchResultFile,
  FinalAudioObservation,
  FinalTimelineLayout,
  TimedToken,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { hashCanonicalTtsValue } from './contract-identity'
import { LOCAL_ACTOR } from './attempt-shared'
import {
  comicTimelineLayout,
  localVoiceEffectFilter,
} from './comic-segmented-audio'
export const buildSpeechSources = (
  result: ProviderRenderResult
): RenderAudioSourceBinding[] => result.outputs.map((output) => ({
  kind: 'provider-output',
  sourceId: output.outputId,
  resultIdentity: result.resultIdentity,
  batchResultId: output.batchResultId,
  outputId: output.outputId,
  artifactRef: output.artifactRef,
  sha256: output.sha256,
}))

export const buildAudioMixPlan = (input: {
  renderIdentity: string
  outputProfileHash: string
  strategy: ProviderRenderStrategy
  requestedOutput: RequestedAudioFormat
  dialogueNodes: readonly CanonicalDialoguePlanNode[]
  comicSegmented: boolean
  sources: RenderAudioSourceBinding[]
  createdAt: string
}): AudioMixPlan => {
  const parametersHash = hashCanonicalTtsValue({
    sourceIds: input.sources.map((source) => source.sourceId),
    strategy: input.strategy,
    requestedOutput: input.requestedOutput,
    dialogueNodes: input.dialogueNodes,
  })
  const base = {
    schemaVersion: 1 as const,
    renderIdentity: input.renderIdentity,
    outputProfileHash: input.outputProfileHash,
    sources: input.sources,
    operations: [{
      kind: input.comicSegmented
        ? 'dialogue-node-assembly'
        : input.sources.length > 1 ? 'ordered-concat' : 'single-source',
      parametersHash,
    }],
    createdAt: input.createdAt,
  }
  return { ...base, mixPlanId: hashCanonicalTtsValue(base) }
}

const durationForTurn = (
  batchResultFiles: BatchResultFile[],
  turnId: string
): number => batchResultFiles
  .filter((file) => file.value.requestedTurnIds.length === 1 && file.value.requestedTurnIds[0] === turnId)
  .flatMap((file) => file.value.outputs)
  .reduce((sum, output) => sum + (output.durationMs ?? 0), 0)

const durationForTimingSegment = (
  slots: readonly AttemptSlot[],
  batchResultFiles: BatchResultFile[],
  turnId: string,
  segmentIndex: number
): number => {
  const slotIds = new Set(slots
    .filter((slot) =>
      slot.turnIds.length === 1
      && slot.turnIds[0] === turnId
      && (slot.timingSegmentIndex ?? 0) === segmentIndex)
    .map((slot) => slot.generationSlotId))
  return batchResultFiles
    .filter((file) => slotIds.has(file.value.generationSlotId))
    .flatMap((file) => file.value.outputs)
    .reduce((sum, output) => sum + (output.durationMs ?? 0), 0)
}

export const buildFinalTimelineLayout = (input: {
  turns: readonly AttemptTurn[]
  slots: readonly AttemptSlot[]
  batchResultFiles: BatchResultFile[]
  comicDialoguePlan?: Parameters<typeof comicTimelineLayout>[0] | undefined
}): FinalTimelineLayout => {
  if (input.comicDialoguePlan) {
    return comicTimelineLayout(
      input.comicDialoguePlan,
      (turnId) => durationForTurn(input.batchResultFiles, turnId),
      (turnId, segmentIndex) => durationForTimingSegment(input.slots, input.batchResultFiles, turnId, segmentIndex)
    )
  }
  let cursorMs = 0
  return {
    turns: input.turns.map((turn) => {
      const startMs = cursorMs
      cursorMs += durationForTurn(input.batchResultFiles, turn.canonical.turnId)
      return {
        turnId: turn.canonical.turnId,
        subjectKey: turn.canonical.subjectKey,
        startMs,
        endMs: cursorMs,
      }
    }),
    overlaps: [],
    pauses: [],
  }
}

export const buildTransformLedger = (input: {
  renderIdentity: string
  requestedOutput: RequestedAudioFormat
  sources: RenderAudioSourceBinding[]
  finalDurationMs: number
  turns: readonly AttemptTurn[]
  timelineLayout: FinalTimelineLayout
}): AudioTransformLedger => {
  const transcodeParametersHash = hashCanonicalTtsValue({
    ...input.requestedOutput,
    orderedConcat: input.sources.length > 1,
  })
  const transcode: AudioTransformLedger['operations'][number] = {
    operationId: hashCanonicalTtsValue({
      kind: 'transcode',
      transcodeParametersHash,
      finalDurationMs: input.finalDurationMs,
    }),
    kind: 'transcode',
    finalRangeMs: { start: 0, end: input.finalDurationMs },
    parametersHash: transcodeParametersHash,
  }
  const effects: AudioTransformLedger['operations'] = input.timelineLayout.turns.flatMap((assembled) => {
    const turn = input.turns.find((candidate) => candidate.canonical.turnId === assembled.turnId)?.canonical
    if (!turn?.effect || !localVoiceEffectFilter(turn)) return []
    const parametersHash = hashCanonicalTtsValue(turn.effect)
    const finalRangeMs = { start: assembled.startMs, end: assembled.endMs }
    return [{
      operationId: hashCanonicalTtsValue({ kind: 'effect', turnId: assembled.turnId, parametersHash, finalRangeMs }),
      kind: 'effect',
      finalRangeMs,
      parametersHash,
    }]
  })
  const overlaps: AudioTransformLedger['operations'] = input.timelineLayout.overlaps.map((overlap) => {
    const parametersHash = hashCanonicalTtsValue({ groupId: overlap.groupId })
    const finalRangeMs = { start: overlap.start, end: overlap.end }
    return {
      operationId: hashCanonicalTtsValue({ kind: 'overlap', groupId: overlap.groupId, parametersHash, finalRangeMs }),
      kind: 'overlap',
      finalRangeMs,
      parametersHash,
    }
  })
  const pauses: AudioTransformLedger['operations'] = input.timelineLayout.pauses.map((pause) => {
    const parametersHash = hashCanonicalTtsValue(pause.parameters)
    const finalRangeMs = { start: pause.start, end: pause.end }
    return {
      operationId: hashCanonicalTtsValue({ kind: 'pause', parametersHash, finalRangeMs }),
      kind: 'pause',
      finalRangeMs,
      parametersHash,
    }
  })
  const base = {
    schemaVersion: 1 as const,
    renderIdentity: input.renderIdentity,
    operations: [transcode, ...effects, ...overlaps, ...pauses],
  }
  return { ...base, transformLedgerId: hashCanonicalTtsValue(base) }
}

const shiftToken = (token: TimedToken, offsetMs: number): TimedToken => ({
  ...token,
  startMs: token.startMs + offsetMs,
  endMs: token.endMs + offsetMs,
})

export const buildNormalizedTiming = (input: {
  strategy: ProviderRenderStrategy
  turns: readonly AttemptTurn[]
  batchResultFiles: BatchResultFile[]
  assembledTurns: FinalTimelineLayout['turns']
}): NormalizedTiming<'final-audio-ms'> => {
  let cursorMs = 0
  const nativeParts = input.batchResultFiles.map((file) => {
    const take = file.value.generatedBatch?.takes[0]
    const timing = take?.timing
    const offsetMs = cursorMs
    cursorMs += take?.durationMs ?? file.value.outputs[0]?.durationMs ?? 0
    if (!timing || timing.availability !== 'timed') return undefined
    return {
      provenance: timing.provenance,
      turns: timing.turns.map((turn) => ({
        ...turn,
        startMs: turn.startMs + offsetMs,
        endMs: turn.endMs + offsetMs,
      })),
      words: timing.words?.map((token) => shiftToken(token, offsetMs)) ?? [],
      phonemes: timing.phonemes?.map((token) => shiftToken(token, offsetMs)) ?? [],
      characters: timing.characters?.map((token) => shiftToken(token, offsetMs)) ?? [],
    }
  })
  if (
    input.strategy !== 'segmented'
    && nativeParts.length > 0
    && nativeParts.every((part) => part !== undefined)
  ) {
    return {
      availability: 'timed',
      clock: 'final-audio-ms',
      provenance: nativeParts.some((part) => part.provenance === 'provider-alignment')
        ? 'provider-alignment'
        : 'provider-native',
      turns: nativeParts.flatMap((part) => part.turns),
      ...(nativeParts.some((part) => part.words.length > 0)
        ? { words: nativeParts.flatMap((part) => part.words) }
        : {}),
      ...(nativeParts.some((part) => part.phonemes.length > 0)
        ? { phonemes: nativeParts.flatMap((part) => part.phonemes) }
        : {}),
      ...(nativeParts.some((part) => part.characters.length > 0)
        ? { characters: nativeParts.flatMap((part) => part.characters) }
        : {}),
    }
  }
  if (
    input.strategy === 'segmented'
    && input.assembledTurns.every((turn) => turn.endMs > turn.startMs)
  ) {
    return {
      availability: 'timed',
      clock: 'final-audio-ms',
      provenance: 'assembled-segments',
      turns: input.assembledTurns,
    }
  }
  return {
    availability: 'unavailable',
    clock: 'final-audio-ms',
    provenance: 'unavailable',
    turns: input.turns.map((turn) => ({
      turnId: turn.canonical.turnId,
      subjectKey: turn.canonical.subjectKey,
    })),
    reason: 'Native/provider timing was not exposed at exact turn boundaries.',
  }
}

export const buildFinalTimeline = (input: {
  renderIdentity: string
  timing: NormalizedTiming<'final-audio-ms'>
  speechSources: RenderAudioSourceBinding[]
  transformLedgerRef: FinalTimeline['transformLedgerRef']
}): FinalTimeline => {
  const base = {
    schemaVersion: 1 as const,
    renderIdentity: input.renderIdentity,
    timing: input.timing,
    speechSources: input.speechSources,
    transformLedgerRef: input.transformLedgerRef,
  }
  return { ...base, timelineId: hashCanonicalTtsValue(base) }
}

export const buildCompactSlots = (input: {
  slots: readonly AttemptSlot[]
  turns: readonly AttemptTurn[]
  batchResultFiles: BatchResultFile[]
  paidSpeechSlotHash: (slot: AttemptSlot) => string
}): CompactAudioArchiveSlot[] => input.slots.map((slot) => {
  const file = input.batchResultFiles.find((entry) => entry.value.generationSlotId === slot.generationSlotId)
  const output = file?.value.outputs[0]
  if (!output) throw CLIUsageError(`Compact TTS render is missing paid output for ${slot.generationSlotId}.`)
  return {
    slotHash: input.paidSpeechSlotHash(slot),
    turnIds: [...slot.turnIds],
    sha256: output.sha256,
    durationMs: output.durationMs ?? 0,
    voiceHash: hashCanonicalTtsValue(slot.turnIds.map((turnId) =>
      input.turns.find((turn) => turn.canonical.turnId === turnId)?.voice.valueHash ?? '')),
  }
})

export const buildCompactRender = (input: {
  targetKey: string
  renderIdentity: string
  renderPlanId: string
  dialoguePlanId: string
  snapshotId?: string | undefined
  strategy: ProviderRenderStrategy
  finalAudio: FinalAudioObservation
  result: ProviderRenderResult
  slots: CompactAudioArchiveSlot[]
  reportedOutputRef: string
  finalAudioSha256: string
}): CompactTargetRender => {
  const base: Omit<CompactTargetRender, 'renderId'> = {
    schemaVersion: 1,
    targetKey: input.targetKey,
    renderIdentity: input.renderIdentity,
    renderPlanId: input.renderPlanId,
    dialoguePlanId: input.dialoguePlanId,
    ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}),
    strategy: input.strategy,
    format: input.finalAudio.format,
    cost: input.result.cost,
    slots: input.slots,
    outputs: {
      final: {
        path: input.reportedOutputRef,
        sha256: input.finalAudioSha256,
        durationMs: input.finalAudio.durationMs,
      },
    },
    retryErrorSummary: {
      requestCount: input.result.observedRequests.length,
      retryCount: input.result.retryAttempts.length,
      failedSlotCount: 0,
    },
  }
  return { ...base, renderId: hashCanonicalTtsValue(base) }
}

export const buildAudioRun = (input: Omit<AudioRun, 'audioRunId'>): AudioRun => ({
  ...input,
  audioRunId: hashCanonicalTtsValue(input),
})

export const buildCompactArchive = (input: Omit<CompactAudioArchive, 'schemaVersion'>): CompactAudioArchive => ({
  schemaVersion: 1,
  ...input,
})

export const buildCompactTerminalProjection = (input: {
  renderIdentity: string
  resultIdentity: string
  audioRunId: string
  archive: CompactAudioArchive
  at: string
}): CanonicalAudioProviderProjection => ({
  selectedSuccess: {
    renderIdentity: input.renderIdentity,
    eventSequence: 1,
    resultIdentity: input.resultIdentity,
    audioRunId: input.audioRunId,
  },
  archive: input.archive,
  branchHistory: [],
  readinessAttempts: [],
  renderHistory: [],
  pointerEvents: [{
    sequence: 1,
    action: 'select-success',
    renderIdentity: input.renderIdentity,
    eventSequence: 1,
    resultIdentity: input.resultIdentity,
    audioRunId: input.audioRunId,
    actor: LOCAL_ACTOR,
    at: input.at,
  }],
})
