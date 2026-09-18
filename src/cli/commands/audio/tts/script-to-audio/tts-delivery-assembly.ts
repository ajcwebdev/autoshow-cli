import type { AttemptSlot, AttemptTurn, FinalTimelineLayout, ProviderRenderStrategy, TtsChunkingOptions, TtsDeliveryMasteringResult, TtsDeliveryProfile, TtsDeliverySeamBoundary, TtsDeliverySegmentInput, TtsTarget } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { masterTtsDelivery } from '../tts-utils/tts-delivery-mastering'
import { planTtsChunks } from '../tts-utils/tts-chunk-planner'
import { chunkLimit, prepareSegmentedTurnText } from './comic-segmented-audio'

type DeliveryPlan = {
  strategy: ProviderRenderStrategy
  turns: readonly AttemptTurn[]
  slots: readonly AttemptSlot[]
}

// Seam kinds are re-derived from the same planner that produced the slot texts, so they never
// enter slot or render-plan identity.
export const resolveTtsDeliverySeams = (
  plan: DeliveryPlan,
  target: TtsTarget,
  chunking: TtsChunkingOptions | undefined
): Map<string, TtsDeliverySeamBoundary> => {
  const seams = new Map<string, TtsDeliverySeamBoundary>()
  const batchIds = [...new Set(plan.slots.map((slot) => slot.batchId))]
  for (const [batchIndex, batchId] of batchIds.entries()) {
    const batchSlots = plan.slots.filter((slot) => slot.batchId === batchId)
    const turn = batchSlots[0]?.turnIds.length === 1
      ? plan.turns.find((candidate) => candidate.canonical.turnId === batchSlots[0]?.turnIds[0])
      : undefined
    const planned = plan.strategy === 'segmented' && turn
      ? planTtsChunks(prepareSegmentedTurnText(turn.canonical.canonicalText, target, turn.canonical.delivery?.description).providerText, chunkLimit(target), chunking)
      : []
    const aligned = planned.length === batchSlots.length && planned.every((chunk, index) => chunk.text === batchSlots[index]?.providerText)
    for (const [slotIndex, slot] of batchSlots.entries()) {
      const lastInBatch = slotIndex === batchSlots.length - 1
      seams.set(slot.generationSlotId, lastInBatch
        ? batchIndex === batchIds.length - 1 ? 'end' : 'turn'
        : aligned ? planned[slotIndex]?.boundaryAfter ?? 'sentence' : 'sentence')
    }
  }
  return seams
}

export const assembleTtsDeliveryAudio = async (input: {
  plan: DeliveryPlan
  target: TtsTarget
  profile: TtsDeliveryProfile
  chunking: TtsChunkingOptions | undefined
  outputPathsBySlot: ReadonlyMap<string, readonly string[]>
  masteringDir: string
  providerLabel: string
  abortSignal?: AbortSignal | undefined
}): Promise<TtsDeliveryMasteringResult> => {
  const seams = resolveTtsDeliverySeams(input.plan, input.target, input.chunking)
  const segments: TtsDeliverySegmentInput[] = input.plan.slots.flatMap((slot) => {
    const paths = input.outputPathsBySlot.get(slot.generationSlotId)
    if (!paths?.length) throw UsageError(`TTS delivery mastering is missing provider output for generation slot ${slot.generationSlotId}.`)
    return paths.map((path, outputIndex) => ({
      id: slot.generationSlotId,
      path,
      boundaryAfter: outputIndex === paths.length - 1 ? seams.get(slot.generationSlotId) ?? 'sentence' : 'hard' as const,
    }))
  })
  return await masterTtsDelivery({
    segments,
    profile: input.profile,
    workDir: `${input.masteringDir}/delivery`,
    providerLabel: input.providerLabel,
    abortSignal: input.abortSignal,
  })
}

export const ttsDeliveryTimelineLayout = (
  plan: DeliveryPlan,
  delivery: TtsDeliveryMasteringResult
): FinalTimelineLayout => {
  const slotById = new Map(plan.slots.map((slot) => [slot.generationSlotId, slot] as const))
  const singleTurnPlacements = delivery.placements.filter((placement) => slotById.get(placement.id)?.turnIds.length === 1)
  const turns = plan.turns.flatMap((turn) => {
    const own = singleTurnPlacements.filter((placement) => slotById.get(placement.id)?.turnIds[0] === turn.canonical.turnId)
    if (own.length === 0) return []
    return [{
      turnId: turn.canonical.turnId,
      subjectKey: turn.canonical.subjectKey,
      startMs: Math.min(...own.map((placement) => placement.startMs)),
      endMs: Math.max(...own.map((placement) => placement.endMs)),
    }]
  })
  return {
    turns: turns.length === plan.turns.length ? turns : [],
    overlaps: [],
    pauses: delivery.pauses.map((pause) => ({
      start: pause.startMs,
      end: pause.endMs,
      parameters: { kind: pause.kind, ...(pause.boundary ? { boundary: pause.boundary } : {}), ...(pause.afterId ? { afterGenerationSlotId: pause.afterId } : {}) },
    })),
  }
}

export const ttsDeliverySlotOffsets = (delivery: TtsDeliveryMasteringResult): Map<string, number> => {
  const offsets = new Map<string, number>()
  for (const placement of delivery.placements) if (!offsets.has(placement.id)) offsets.set(placement.id, placement.startMs - placement.trimLeadMs)
  return offsets
}
