import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { AttemptSlot, AttemptTurn, CanonicalDialogueTurn, ComicDialoguePlan, TtsMasteringProfile, TtsTarget } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { concatAndConvertToWav, createSilenceWav, filterAudioToWav, mixAudioToWav, splitTextIntoChunks } from '../tts-utils/audio-utils'
import { resolveTtsChunkCharacterLimit, TTS_CHUNK_CHARACTER_LIMITS } from '../tts-utils/tts-chunking'
import { prepareElevenLabsDialogueText } from '../tts-services/tts-elevenlabs/elevenlabs-native-dialogue'
import { prepareFishDialogueText } from '../tts-services/fish/fish-tts-request'
import { prepareDeepinfraChatterboxText } from '../tts-services/tts-deepinfra/deepinfra-text-preparation'
import { PREPARATION_VERSION } from './attempt-shared'
export const chunkLimit = (target: TtsTarget): number =>
  resolveTtsChunkCharacterLimit(target.service, target.model)
    ?? TTS_CHUNK_CHARACTER_LIMITS[target.service]
    ?? 2000

const preparedText = (text: string) => ({
  schemaVersion: 1 as const,
  canonicalText: text,
  providerText: text,
  preparationVersion: PREPARATION_VERSION,
  canonicalIndexUnit: 'unicode-scalar-value' as const,
  providerIndexUnit: 'unicode-scalar-value' as const,
  spans: [...text].length === 0 ? [] : [{ kind: 'mapped' as const, canonicalStart: 0, canonicalEnd: [...text].length, providerStart: 0, providerEnd: [...text].length }]
})

export const prepareSegmentedTurnText = (
  text: string,
  target: TtsTarget,
  delivery?: string | undefined
) => target.service === 'elevenlabs' && target.model === 'eleven_v3'
  ? prepareElevenLabsDialogueText(text, delivery)
  : target.service === 'fish'
    ? prepareFishDialogueText(text, delivery, target.model)
    : target.service === 'deepinfra' && target.model === 'ResembleAI/chatterbox-turbo'
      ? prepareDeepinfraChatterboxText(text)
      : preparedText(text)

export const localVoiceEffectFilter = (turn: CanonicalDialogueTurn): string | undefined => {
  const kind = turn.effect?.kind ?? ''
  if (!/(?:radio|intercom|telephone|computer)/u.test(kind)) return undefined
  return 'highpass=f=250,lowpass=f=3500,acompressor=threshold=-18dB:ratio=3:attack=10:release=100'
}

const splitCanonicalTextAtTimingCues = (turn: CanonicalDialogueTurn): string[] => {
  const scalars = [...turn.canonicalText]
  const offsets = [...new Set((turn.timingCues ?? []).map(cue => cue.afterTextOffset))].sort((left, right) => left - right)
  const parts: string[] = []
  let cursor = 0
  for (const offset of offsets) {
    parts.push(scalars.slice(cursor, offset).join('').trim())
    cursor = offset
  }
  parts.push(scalars.slice(cursor).join('').trim())
  return parts
}

export const prepareComicSegmentedProviderTexts = (
  turn: CanonicalDialogueTurn,
  target: TtsTarget
): { providerTexts: string[], timingSegmentIndexes: number[] } => {
  const providerTexts: string[] = []
  const timingSegmentIndexes: number[] = []
  const limit = chunkLimit(target)
  for (const [timingSegmentIndex, segment] of splitCanonicalTextAtTimingCues(turn).entries()) {
    if (!segment) continue
    const prepared = prepareSegmentedTurnText(segment, target, turn.delivery?.description).providerText
    for (const chunk of splitTextIntoChunks(prepared, limit)) {
      providerTexts.push(chunk)
      timingSegmentIndexes.push(timingSegmentIndex)
    }
  }
  return { providerTexts, timingSegmentIndexes }
}

export const segmentedSlotGroup = (
  turn: AttemptTurn,
  target: TtsTarget
): { turnIds: string[], providerTexts: string[], timingSegmentIndexes: number[] } => {
  const { providerTexts, timingSegmentIndexes } = prepareComicSegmentedProviderTexts(turn.canonical, target)
  return { turnIds: [turn.canonical.turnId], providerTexts, timingSegmentIndexes }
}

export const assembleComicSegmentedAudio = async (input: {
  dialoguePlan: ComicDialoguePlan
  turns: readonly CanonicalDialogueTurn[]
  slots: readonly Pick<AttemptSlot, 'generationSlotId' | 'turnIds' | 'timingSegmentIndex'>[]
  outputPathsBySlot: ReadonlyMap<string, readonly string[]>
  masteringDir: string
  providerLabel: string
  profile: TtsMasteringProfile
}): Promise<string> => {
  const turnAudio = new Map<string, string>()
  for (const turn of input.turns) {
    const turnDir = join(input.masteringDir, 'turns', turn.turnId)
    await mkdir(turnDir, { recursive: true })
    const turnSlots = input.slots.filter(slot => slot.turnIds.includes(turn.turnId))
    if (turnSlots.length === 0) throw CLIUsageError(`Comic assembly has no retained provider output for ${turn.turnId}.`)
    const segmentPaths = new Map<number, string[]>()
    for (const slot of turnSlots) {
      const paths = input.outputPathsBySlot.get(slot.generationSlotId)
      if (!paths) throw CLIUsageError(`Comic assembly is missing generation slot ${slot.generationSlotId}.`)
      const segmentIndex = slot.timingSegmentIndex ?? 0
      segmentPaths.set(segmentIndex, [...(segmentPaths.get(segmentIndex) ?? []), ...paths])
    }
    const offsets = [...new Set((turn.timingCues ?? []).map(cue => cue.afterTextOffset))].sort((left, right) => left - right)
    const cueDurationByOffset = new Map(offsets.map(offset => [offset, (turn.timingCues ?? []).filter(cue => cue.afterTextOffset === offset).reduce((sum, cue) => sum + cue.durationMs, 0)] as const))
    const assembledParts: string[] = []
    for (let segmentIndex = 0; segmentIndex <= offsets.length; segmentIndex += 1) {
      const chunks = segmentPaths.get(segmentIndex)
      if (chunks?.length) {
        const segmentDir = join(turnDir, `segment-${String(segmentIndex + 1).padStart(3, '0')}`)
        await mkdir(segmentDir, { recursive: true })
        assembledParts.push(await concatAndConvertToWav(chunks, segmentDir, `${input.providerLabel}-${turn.turnId}-segment-${segmentIndex + 1}`, undefined, input.profile))
      }
      const offset = offsets[segmentIndex]
      const durationMs = offset === undefined ? undefined : cueDurationByOffset.get(offset)
      if (durationMs) assembledParts.push(await createSilenceWav(join(turnDir, `pause-${String(segmentIndex + 1).padStart(3, '0')}-${durationMs}ms.wav`), durationMs, input.profile))
    }
    if (assembledParts.length === 0) throw CLIUsageError(`Comic assembly has no speech or timing parts for ${turn.turnId}.`)
    const concatenated = await concatAndConvertToWav(assembledParts, turnDir, `${input.providerLabel}-${turn.turnId}`, undefined, input.profile)
    const effectFilter = localVoiceEffectFilter(turn)
    if (effectFilter) {
      const effected = join(turnDir, 'effected.wav')
      await filterAudioToWav(concatenated, effected, `${input.providerLabel}-${turn.turnId}`, effectFilter, input.profile)
      turnAudio.set(turn.turnId, effected)
    } else {
      turnAudio.set(turn.turnId, concatenated)
    }
  }
  const nodePaths: string[] = []
  for (const [nodeIndex, node] of input.dialoguePlan.nodes.entries()) {
    if (node.kind === 'turn') {
      const path = turnAudio.get(node.turn.turnId)
      if (!path) throw CLIUsageError(`Comic assembly lost turn ${node.turn.turnId}.`)
      nodePaths.push(path)
      continue
    }
    const overlapPaths = node.turns.map((turn) => {
      const path = turnAudio.get(turn.turnId)
      if (!path) throw CLIUsageError(`Comic overlap assembly lost turn ${turn.turnId}.`)
      return path
    })
    const overlapDir = join(input.masteringDir, 'overlaps', `${String(nodeIndex + 1).padStart(3, '0')}-${node.groupId}`)
    await mkdir(overlapDir, { recursive: true })
    nodePaths.push(await mixAudioToWav(overlapPaths, join(overlapDir, 'speech.wav'), `${input.providerLabel}-${node.groupId}`, input.profile))
  }
  if (nodePaths.length === 0) throw CLIUsageError('Comic segmented assembly has no dialogue nodes.')
  const assemblyDir = join(input.masteringDir, 'assembly')
  await mkdir(assemblyDir, { recursive: true })
  const pacedNodePaths: string[] = []
  for (const [index, path] of nodePaths.entries()) {
    pacedNodePaths.push(path)
    if (index < nodePaths.length - 1 && input.dialoguePlan.pacing.interTurnMs > 0) {
      pacedNodePaths.push(await createSilenceWav(join(assemblyDir, `inter-turn-${String(index + 1).padStart(3, '0')}-${input.dialoguePlan.pacing.interTurnMs}ms.wav`), input.dialoguePlan.pacing.interTurnMs, input.profile))
    }
  }
  return await concatAndConvertToWav(pacedNodePaths, assemblyDir, `${input.providerLabel}-comic-assembly`, undefined, input.profile)
}

export const comicTimelineLayout = (
  dialoguePlan: ComicDialoguePlan,
  durationForTurn: (turnId: string) => number,
  durationForTimingSegment?: ((turnId: string, segmentIndex: number) => number) | undefined
): {
  turns: Array<{ turnId: string, subjectKey: string, startMs: number, endMs: number }>
  overlaps: Array<{ groupId: string, start: number, end: number }>
  pauses: Array<{ kind: 'authored' | 'inter-turn', turnId?: string | undefined, start: number, end: number, parameters: unknown }>
} => {
  let cursorMs = 0
  const turns: Array<{ turnId: string, subjectKey: string, startMs: number, endMs: number }> = []
  const overlaps: Array<{ groupId: string, start: number, end: number }> = []
  const pauses: Array<{ kind: 'authored' | 'inter-turn', turnId?: string | undefined, start: number, end: number, parameters: unknown }> = []
  const advanceTurn = (turn: CanonicalDialogueTurn, startMs: number): number => {
    const cues = turn.timingCues ?? []
    if (!durationForTimingSegment || cues.length === 0) return startMs + durationForTurn(turn.turnId) + cues.reduce((sum, cue) => sum + cue.durationMs, 0)
    const offsets = [...new Set(cues.map(cue => cue.afterTextOffset))].sort((left, right) => left - right)
    let turnCursor = startMs
    for (let segmentIndex = 0; segmentIndex <= offsets.length; segmentIndex += 1) {
      turnCursor += durationForTimingSegment(turn.turnId, segmentIndex)
      const offset = offsets[segmentIndex]
      if (offset === undefined) continue
      const boundaryCues = cues.filter(cue => cue.afterTextOffset === offset)
      const durationMs = boundaryCues.reduce((sum, cue) => sum + cue.durationMs, 0)
      pauses.push({ kind: 'authored', turnId: turn.turnId, start: turnCursor, end: turnCursor + durationMs, parameters: { afterTextOffset: offset, cues: boundaryCues } })
      turnCursor += durationMs
    }
    return turnCursor
  }
  for (const [nodeIndex, node] of dialoguePlan.nodes.entries()) {
    if (node.kind === 'turn') {
      const startMs = cursorMs
      cursorMs = advanceTurn(node.turn, startMs)
      turns.push({ turnId: node.turn.turnId, subjectKey: node.turn.subjectKey, startMs, endMs: cursorMs })
      if (nodeIndex < dialoguePlan.nodes.length - 1 && dialoguePlan.pacing.interTurnMs > 0) {
        pauses.push({ kind: 'inter-turn', start: cursorMs, end: cursorMs + dialoguePlan.pacing.interTurnMs, parameters: { profile: dialoguePlan.pacing.profile, nodeIndex } })
        cursorMs += dialoguePlan.pacing.interTurnMs
      }
      continue
    }
    const startMs = cursorMs
    let endMs = startMs
    for (const turn of node.turns) {
      const turnEndMs = advanceTurn(turn, startMs)
      turns.push({ turnId: turn.turnId, subjectKey: turn.subjectKey, startMs, endMs: turnEndMs })
      endMs = Math.max(endMs, turnEndMs)
    }
    cursorMs = endMs
    overlaps.push({ groupId: node.groupId, start: startMs, end: endMs })
    if (nodeIndex < dialoguePlan.nodes.length - 1 && dialoguePlan.pacing.interTurnMs > 0) {
      pauses.push({ kind: 'inter-turn', start: cursorMs, end: cursorMs + dialoguePlan.pacing.interTurnMs, parameters: { profile: dialoguePlan.pacing.profile, nodeIndex } })
      cursorMs += dialoguePlan.pacing.interTurnMs
    }
  }
  return { turns, overlaps, pauses }
}
