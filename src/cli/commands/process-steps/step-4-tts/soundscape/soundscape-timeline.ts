import type { ComicDialoguePlan, FinalTimeline, ResolvedSoundscapeAnchorResolution, ResolvedSoundscapeTimeline, SoundEffectRenderResult, SoundscapeAnchor, SoundscapePlan } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { hashCanonicalTtsValue } from '../script-to-audio/contract-identity'

const sourceTurnIds = (dialoguePlan: ComicDialoguePlan, sourceSegmentId: string): string[] => dialoguePlan.nodes.flatMap((node) => {
  const turns = node.kind === 'turn' ? [node.turn] : node.turns
  return turns.filter(turn => turn.sourceSegmentId === sourceSegmentId).map(turn => turn.turnId)
})

type AnchorRole = ResolvedSoundscapeAnchorResolution['anchorRole']

const resolvedAnchor = (
  positionMs: number,
  anchorRole: AnchorRole,
  policy: ResolvedSoundscapeAnchorResolution['policy'],
  algorithm: ResolvedSoundscapeAnchorResolution['algorithm'],
  evidence: unknown,
  errorBoundMs = 0,
): { positionMs: number, resolution: ResolvedSoundscapeAnchorResolution } => ({
  positionMs,
  resolution: { anchorRole, policy, algorithm, positionMs, inputEvidenceHash: hashCanonicalTtsValue(evidence), errorBoundMs },
})

const resolveAnchor = (anchor: SoundscapeAnchor, dialoguePlan: ComicDialoguePlan, timeline: FinalTimeline, cueId: string, timingPolicy: SoundscapePlan['timingPolicy'], anchorRole: AnchorRole, sceneBounds?: { start: number, end: number }): { positionMs: number, resolution: ResolvedSoundscapeAnchorResolution } => {
  if (anchor.kind === 'resolved-scene-edge') {
    if (!sceneBounds) throw CLIUsageError(`Sound cue ${cueId} resolved-scene-edge anchor requires a computed scene range.`)
    return resolvedAnchor(anchor.edge === 'start' ? sceneBounds.start : sceneBounds.end, anchorRole, timingPolicy, 'resolved-scene-edge-v1', { anchor, sceneBounds })
  }
  if (anchor.kind === 'scene-clock') return resolvedAnchor(anchor.positionMs, anchorRole, timingPolicy, 'scene-clock-v1', { anchor })
  const turnIds = sourceTurnIds(dialoguePlan, anchor.sourceSegmentId)
  if (turnIds.length === 0) throw CLIUsageError(`Sound cue ${cueId} anchor references unknown speakable source segment ${anchor.sourceSegmentId}.`)
  if (timeline.timing.availability !== 'timed') throw CLIUsageError(`Sound cue ${cueId} requires exact dialogue timing, but the selected final timeline is unavailable: ${timeline.timing.reason}`)
  const turns = timeline.timing.turns.filter(turn => turnIds.includes(turn.turnId))
  if (turns.length !== turnIds.length) throw CLIUsageError(`Sound cue ${cueId} cannot resolve every selected dialogue turn for ${anchor.sourceSegmentId}.`)
  if (anchor.kind === 'source-segment-edge') {
    const edge = anchor.edge === 'start' ? Math.min(...turns.map(turn => turn.startMs)) : Math.max(...turns.map(turn => turn.endMs))
    return resolvedAnchor(edge + anchor.offsetMs, anchorRole, timingPolicy, 'source-segment-edge-v1', { anchor, turnIds, turns })
  }
  if (turnIds.length !== 1) throw CLIUsageError(`Sound cue ${cueId} text-offset anchor is ambiguous because ${anchor.sourceSegmentId} renders as overlapping voices.`)
  const turn = turns[0] as NonNullable<typeof turns[number]>
  const canonicalTurn = dialoguePlan.nodes.flatMap(node => node.kind === 'turn' ? [node.turn] : node.turns).find(candidate => candidate.turnId === turn.turnId)
  if (!canonicalTurn) throw CLIUsageError(`Sound cue ${cueId} has no canonical dialogue turn for its exact text offset.`)
  const canonicalLength = [...canonicalTurn.canonicalText].length
  if (anchor.textOffset === 0) return resolvedAnchor(turn.startMs + anchor.offsetMs, anchorRole, timingPolicy, 'prepared-provider-timing-v1', { anchor, turn, canonicalLength })
  if (anchor.textOffset === canonicalLength) return resolvedAnchor(turn.endMs + anchor.offsetMs, anchorRole, timingPolicy, 'prepared-provider-timing-v1', { anchor, turn, canonicalLength })
  const tokens = [...(timeline.timing.characters ?? []), ...(timeline.timing.words ?? [])].filter(token => token.turnId === turn.turnId)
  const starts = tokens.filter(token => token.canonicalStart === anchor.textOffset).map(token => token.startMs)
  const ends = tokens.filter(token => token.canonicalEnd === anchor.textOffset).map(token => token.endMs)
  const exact = starts.length > 0 ? Math.min(...starts) : ends.length > 0 ? Math.max(...ends) : undefined
  if (exact !== undefined) return resolvedAnchor(exact + anchor.offsetMs, anchorRole, timingPolicy, 'prepared-provider-timing-v1', { anchor, turn, tokens })
  if (timingPolicy !== 'proportional') throw CLIUsageError(`Sound cue ${cueId} text offset ${anchor.textOffset} has no exact PreparedProviderText/timing evidence in the selected final timeline; use --soundscape-timing-policy proportional to record an explicit bounded approximation.`)
  if (canonicalLength === 0) throw CLIUsageError(`Sound cue ${cueId} cannot proportionally resolve an empty canonical dialogue turn.`)
  const basePositionMs = turn.startMs + Math.round(((turn.endMs - turn.startMs) * anchor.textOffset) / canonicalLength)
  const positionMs = basePositionMs + anchor.offsetMs
  const errorBoundMs = Math.max(basePositionMs - turn.startMs, turn.endMs - basePositionMs)
  return resolvedAnchor(positionMs, anchorRole, timingPolicy, 'canonical-offset-linear-v1', { anchor, turn, canonicalLength }, errorBoundMs)
}

export const resolveSoundscapeTimeline = (input: {
  plan: SoundscapePlan
  dialoguePlan: ComicDialoguePlan
  dialogueTimeline: FinalTimeline
  dialogueAudioRunId: string
  renderResult?: SoundEffectRenderResult | undefined
}): ResolvedSoundscapeTimeline => {
  const dialogueDuration = input.dialogueTimeline.timing.availability === 'timed'
    ? Math.max(0, ...input.dialogueTimeline.timing.turns.map(turn => turn.endMs))
    : 0
  const resultByCue = new Map(input.renderResult?.entries.map(entry => [entry.cueId, entry] as const) ?? [])
  const provisional = input.plan.cues.map((cue) => {
    const result = resultByCue.get(cue.cueId)
    if (!result || result.status !== 'succeeded' || !result.audio) {
      if (cue.required) throw CLIUsageError(`Required sound cue ${cue.cueId} has no verified successful generation result.`)
      return { cueId: cue.cueId, bus: cue.kind, required: false, status: 'omitted' as const, omissionReason: result?.omissionReason ?? 'No compatible generated source was available.' }
    }
    const anchor = resolveAnchor(cue.anchor, input.dialoguePlan, input.dialogueTimeline, cue.cueId, input.plan.timingPolicy, 'point')
    const start = anchor.positionMs
    return {
      cueId: cue.cueId,
      bus: cue.kind,
      required: cue.required,
      status: 'placed' as const,
      sourceRangeMs: { start: 0, end: result.audio.durationMs },
      rawRange: { start, end: start + result.audio.durationMs },
      sourceAudioSha256: result.audio.sha256,
      anchorResolutions: [anchor.resolution],
    }
  })
  const placedRanges = provisional.flatMap(entry => entry.status === 'placed' ? [entry.rawRange] : [])
  let sceneStart = Math.min(0, ...placedRanges.map(range => range.start))
  let sceneEnd = Math.max(dialogueDuration, ...placedRanges.map(range => range.end))
  if (sceneEnd <= sceneStart) {
    const longestAmbientSourceMs = Math.max(0, ...input.plan.ambientBeds.flatMap(cue => {
      const entry = resultByCue.get(cue.cueId)
      return entry?.status === 'succeeded' && entry.audio ? [entry.audio.durationMs] : []
    }))
    sceneEnd = sceneStart + longestAmbientSourceMs
  }
  const ambient = input.plan.ambientBeds.map((cue) => {
    const result = resultByCue.get(cue.cueId)
    if (!result || result.status !== 'succeeded' || !result.audio) {
      if (cue.required) throw CLIUsageError(`Required ambient cue ${cue.cueId} has no verified successful generation result.`)
      return { cueId: cue.cueId, bus: 'ambience' as const, required: false, status: 'omitted' as const, omissionReason: result?.omissionReason ?? 'No compatible generated source was available.' }
    }
    const sceneBounds = { start: sceneStart, end: sceneEnd }
    const startAnchor = cue.range.kind === 'full-scene' ? undefined : resolveAnchor(cue.range.start, input.dialoguePlan, input.dialogueTimeline, cue.cueId, input.plan.timingPolicy, 'range-start', sceneBounds)
    const endAnchor = cue.range.kind === 'full-scene' ? undefined : resolveAnchor(cue.range.end, input.dialoguePlan, input.dialogueTimeline, cue.cueId, input.plan.timingPolicy, 'range-end', sceneBounds)
    const start = startAnchor?.positionMs ?? sceneStart
    const end = endAnchor?.positionMs ?? sceneEnd
    if (end <= start) throw CLIUsageError(`Ambient cue ${cue.cueId} resolves to a non-positive playback range.`)
    sceneStart = Math.min(sceneStart, start)
    sceneEnd = Math.max(sceneEnd, end)
    return {
      cueId: cue.cueId,
      bus: 'ambience' as const,
      required: cue.required,
      status: 'placed' as const,
      sourceRangeMs: { start: 0, end: result.audio.durationMs },
      rawRange: { start, end },
      sourceAudioSha256: result.audio.sha256,
      ...((startAnchor && endAnchor) ? { anchorResolutions: [startAnchor.resolution, endAnchor.resolution] } : {}),
      loopIterations: (end - start) <= result.audio.durationMs
        ? 1
        : 1 + Math.ceil(((end - start) - result.audio.durationMs) / Math.max(1, result.audio.durationMs - input.plan.mixProfile.bedLoopCrossfadeMs)),
    }
  })
  const preRollMs = Math.max(0, -sceneStart)
  const entries = [...provisional, ...ambient].map((entry) => {
    if (entry.status === 'omitted') return entry
    const { rawRange, ...rest } = entry
    return { ...rest, finalRangeMs: { start: rawRange.start + preRollMs, end: rawRange.end + preRollMs } }
  })
  const base = {
    schemaVersion: 1 as const,
    soundscapePlanId: input.plan.soundscapePlanId,
    dialogueAudioRunId: input.dialogueAudioRunId,
    dialogueTiming: input.dialogueTimeline.timing,
    preRollMs,
    durationMs: sceneEnd + preRollMs,
    entries,
  }
  return { ...base, timelineId: hashCanonicalTtsValue(base) }
}
