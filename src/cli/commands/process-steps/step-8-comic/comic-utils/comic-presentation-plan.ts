import type {
  AuthoredSoundscapeCue,
  ComicDialoguePlan,
  ComicPresentationDialogueBinding,
  ComicPresentationPanelInput,
  ComicPresentationPlan,
  ComicPresentationSoundBinding,
  ComicPresentationTimelineEvent,
  ComicDialogueTurn,
  PanelSpeech,
  PresentationSoundSource,
  ResolvedPanelTimeline,
  ScenePromptData,
  SpeechTextMatch,
  StructuredScriptData,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { hashCanonicalTtsValue } from '../../step-4-tts/script-to-audio/contract-identity'

const exactText = (value: string): string => value.normalize('NFKC').replace(/\s+/gu, ' ').trim()
const exactLabel = (value: string): string => exactText(value).toUpperCase()

const flattenDialogueTurns = (plan: ComicDialoguePlan) => plan.nodes.flatMap(node => node.kind === 'turn' ? [node.turn] : node.turns)

const cueText = (value: string): string => exactText(value).replace(/^\(\s*|\s*\)$/gu, '')

const exactSourceCueTexts = (turn: ComicDialogueTurn): Set<string> => new Set([
  ...(turn.delivery?.description.split(',') ?? []),
  ...(turn.timingCues?.map(cue => cue.sourceSpan.text) ?? []),
].map(cueText).filter(Boolean))

const elideExactSourceCues = (turn: ComicDialogueTurn, value: string): string | undefined => {
  const parentheticals = [...value.matchAll(/\(([^()]*)\)/gu)]
  if (parentheticals.length === 0) return undefined
  const sourceCues = exactSourceCueTexts(turn)
  if (parentheticals.some(match => !match[1] || !sourceCues.has(cueText(match[1])))) return undefined
  return exactText(value.replace(/\s*\([^()]*\)\s*/gu, ' ').replace(/\s+([,.;:!?…])/gu, '$1'))
}

const speechTextMatch = (turn: ComicDialogueTurn, speech: PanelSpeech): SpeechTextMatch | undefined => {
  const canonical = exactText(turn.canonicalText)
  if (canonical === exactText(speech.line)) return 'exact'
  return canonical === elideExactSourceCues(turn, speech.line) ? 'exact-after-source-cue-elision' : undefined
}

const speakerMatches = (turn: ComicDialogueTurn, speech: PanelSpeech['speaker']): boolean => {
  if (speech.kind === 'character') return turn.subjectKey === speech.characterKey || exactLabel(turn.originalSpeakerLabel) === exactLabel(speech.characterKey)
  if (speech.kind === 'voice') return exactLabel(turn.originalSpeakerLabel) === exactLabel(speech.label) || turn.subjectKey === `voice:${speech.label}`
  return turn.subjectKey === 'role:narrator' || ['NARRATOR', 'CAPTION'].includes(exactLabel(turn.originalSpeakerLabel))
}

const speechMatches = (turn: ComicDialogueTurn, speech: PanelSpeech): boolean =>
  speakerMatches(turn, speech.speaker) && speechTextMatch(turn, speech) !== undefined

const describeTurn = (turn: ComicDialogueTurn): string =>
  `${turn.turnId} (${turn.originalSpeakerLabel}: ${exactText(turn.canonicalText)})`

export const reconcilePresentationDialogue = (input: {
  scene: ScenePromptData
  dialoguePlan: ComicDialoguePlan
}): ComicPresentationDialogueBinding[] => {
  const speeches: PanelSpeech[] = input.scene.panels.flatMap(panel => panel.speech.map((speech, index) => ({
    panelNumber: panel.number,
    speechOrdinal: index + 1,
    speaker: speech.speaker,
    line: speech.line,
  })))
  const turns = flattenDialogueTurns(input.dialoguePlan)

  return turns.map((turn) => {
    const provenancePanels = input.scene.panels.filter(panel => panel.sourceSegmentIds.includes(turn.sourceSegmentId))
    const exact = speeches.filter(speech => provenancePanels.some(panel => panel.number === speech.panelNumber) && speechMatches(turn, speech))
    if (exact.length === 1) {
      const match = exact[0] as PanelSpeech
      const panel = input.scene.panels.find(candidate => candidate.number === match.panelNumber) as ScenePromptData['panels'][number]
      return {
        turnId: turn.turnId,
        sourceSegmentId: turn.sourceSegmentId,
        panelNumber: match.panelNumber,
        subjectKey: turn.subjectKey,
        speakerLabel: turn.originalSpeakerLabel,
        canonicalText: turn.canonicalText,
        evidence: {
          kind: 'source-segment-id',
          sourceSegmentId: turn.sourceSegmentId,
          panelSourceSegmentIds: panel.sourceSegmentIds,
          speechOrdinal: match.speechOrdinal,
          textMatch: speechTextMatch(turn, match) as SpeechTextMatch,
          panelText: exactText(match.line),
        },
      }
    }
    if (exact.length > 1) throw CLIUsageError(`Dialogue ownership is ambiguous for ${describeTurn(turn)}: exact source provenance and speech content match panels ${exact.map(match => match.panelNumber).join(', ')}.`)
    if (provenancePanels.length > 0) {
      throw CLIUsageError(`Dialogue ownership is inconsistent for ${describeTurn(turn)}: source segment ${turn.sourceSegmentId} is assigned to panel(s) ${provenancePanels.map(panel => panel.number).join(', ')}, but no exact speaker-and-text entry matches.`)
    }
    throw CLIUsageError(`Dialogue ownership is missing for ${describeTurn(turn)}: source segment ${turn.sourceSegmentId} is not assigned to any panel. Redraft the scene so every dialogue turn carries panel provenance.`)
  })
}

const segmentEnd = (segment: StructuredScriptData['sourceSegments'][number]): number | undefined => {
  if (segment.sourceSpans.length === 0) return undefined
  return Math.max(...segment.sourceSpans.map(span => span.end))
}

const owningPanelForSegment = (scene: ScenePromptData, sourceSegmentId: string, cueId: string): number => {
  const owners = scene.panels.filter(panel => panel.sourceSegmentIds.includes(sourceSegmentId))
  if (owners.length !== 1) {
    const detail = owners.length === 0 ? 'no reviewed panel' : `reviewed panels ${owners.map(panel => panel.number).join(', ')}`
    throw CLIUsageError(`Sound cue ${cueId} source segment ${sourceSegmentId} is owned by ${detail}; exact panel ownership is required.`)
  }
  return (owners[0] as ScenePromptData['panels'][number]).number
}

export const reconcilePresentationSoundEffects = (input: {
  scene: ScenePromptData
  structuredScript: StructuredScriptData
  dialogueBindings: readonly ComicPresentationDialogueBinding[]
  sounds: readonly PresentationSoundSource[]
  busGainDb?: Partial<Record<AuthoredSoundscapeCue['kind'], number>> | undefined
  defaultPan?: number | undefined
}): ComicPresentationSoundBinding[] => input.sounds.map(({ cue, originalRangeMs, sourceAudio }) => {
  if (cue.anchor.kind === 'source-text-offset') {
    const sourceSegmentId = cue.anchor.sourceSegmentId
    const bindings = input.dialogueBindings.filter(binding => binding.sourceSegmentId === sourceSegmentId)
    const panels = [...new Set(bindings.map(binding => binding.panelNumber))]
    if (bindings.length === 0 || panels.length !== 1) throw CLIUsageError(`Inline sound cue ${cue.cueId} cannot resolve one panel from source segment ${sourceSegmentId}.`)
    return {
      cueId: cue.cueId,
      panelNumber: panels[0] as number,
      kind: cue.kind,
      prompt: cue.prompt,
      sourceSpan: cue.sourceSpan,
      sourceAudio,
      originalRangeMs,
      gainDb: (input.busGainDb?.[cue.kind] ?? 0) + (cue.gainDb ?? 0),
      pan: cue.pan ?? input.defaultPan ?? 0,
      evidence: { kind: 'inline-source-segment', sourceSegmentId, turnIds: bindings.map(binding => binding.turnId) },
    }
  }

  const preceding = input.structuredScript.sourceSegments
    .filter(segment => segment.type === 'direction' || segment.type === 'panel-note')
    .flatMap(segment => {
      const end = segmentEnd(segment)
      return end !== undefined && end <= cue.sourceSpan.start ? [{ segment, end }] : []
    })
    .sort((left, right) => right.end - left.end || left.segment.id.localeCompare(right.segment.id))
  const nearestEnd = preceding[0]?.end
  const nearest = nearestEnd === undefined ? [] : preceding.filter(candidate => candidate.end === nearestEnd)
  if (nearest.length === 0) {
    const detail = 'no preceding authored action segment'
    throw CLIUsageError(`Sound cue ${cue.cueId} has ${detail}; author exact source ownership before generating a slideshow.`)
  }
  const owners = nearest.map(candidate => ({ candidate, panelNumber: owningPanelForSegment(input.scene, candidate.segment.id, cue.cueId) }))
  const ownerPanels = [...new Set(owners.map(owner => owner.panelNumber))]
  if (ownerPanels.length !== 1) {
    throw CLIUsageError(`Sound cue ${cue.cueId} has ambiguous preceding action segments ${nearest.map(candidate => candidate.segment.id).join(', ')} owned by panels ${ownerPanels.join(', ')}; author exact source ownership before generating a slideshow.`)
  }
  const action = nearest[0] as NonNullable<typeof nearest[number]>
  return {
    cueId: cue.cueId,
    panelNumber: ownerPanels[0] as number,
    kind: cue.kind,
    prompt: cue.prompt,
    sourceSpan: cue.sourceSpan,
    sourceAudio,
    originalRangeMs,
    gainDb: (input.busGainDb?.[cue.kind] ?? 0) + (cue.gainDb ?? 0),
    pan: cue.pan ?? input.defaultPan ?? 0,
    evidence: {
      kind: 'preceding-action-segment',
      sourceSegmentId: action.segment.id,
      sourceSegmentEnd: action.end,
      ...(nearest.length > 1 ? { equivalentSourceSegmentIds: nearest.map(candidate => candidate.segment.id) } : {}),
    },
  }
})

const validatePanelSequence = (panels: readonly ComicPresentationPanelInput[]): void => {
  if (panels.length === 0) throw CLIUsageError('Comic presentation requires at least one reviewed panel.')
  panels.forEach((panel, index) => {
    if (panel.panelNumber !== index + 1) throw CLIUsageError(`Comic presentation panels must be uniquely ordered 1..N; found panel ${panel.panelNumber} at ordinal ${index + 1}.`)
  })
}

export const resolveComicPanelTimeline = (input: {
  presentationId: string
  panels: readonly ComicPresentationPanelInput[]
  dialogueBindings: readonly ComicPresentationDialogueBinding[]
  dialogueRanges: ReadonlyMap<string, { start: number, end: number }>
  dialoguePreRollMs?: number | undefined
  soundBindings: readonly ComicPresentationSoundBinding[]
  untimedPanelMs: number
}): ResolvedPanelTimeline => {
  validatePanelSequence(input.panels)
  if (!Number.isSafeInteger(input.untimedPanelMs) || input.untimedPanelMs <= 0) throw CLIUsageError('--untimed-panel-ms must be a positive safe integer.')
  const preRollMs = input.dialoguePreRollMs ?? 0
  const eventsByPanel = new Map<number, Array<Omit<ComicPresentationTimelineEvent, 'presentationRangeMs'>>>()
  for (const binding of input.dialogueBindings) {
    const range = input.dialogueRanges.get(binding.turnId)
    if (!range || !Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.end <= range.start) throw CLIUsageError(`Selected canonical audio timeline has no positive exact range for dialogue turn ${binding.turnId}.`)
    const event = {
      eventId: `dialogue:${binding.turnId}`,
      kind: 'dialogue' as const,
      panelNumber: binding.panelNumber,
      sourceIds: [binding.turnId],
      sourceRangeMs: range,
      originalRangeMs: { start: range.start + preRollMs, end: range.end + preRollMs },
    }
    eventsByPanel.set(binding.panelNumber, [...(eventsByPanel.get(binding.panelNumber) ?? []), event])
  }
  for (const binding of input.soundBindings) {
    const event = {
      eventId: `sound:${binding.cueId}`,
      kind: binding.kind,
      panelNumber: binding.panelNumber,
      sourceIds: [binding.cueId],
      sourceRangeMs: { start: 0, end: binding.sourceAudio.durationMs },
      originalRangeMs: binding.originalRangeMs,
    }
    eventsByPanel.set(binding.panelNumber, [...(eventsByPanel.get(binding.panelNumber) ?? []), event])
  }

  let cursor = 0
  const events: ComicPresentationTimelineEvent[] = []
  const panels = input.panels.map((image) => {
    const assigned = eventsByPanel.get(image.panelNumber) ?? []
    if (assigned.length === 0) {
      const startMs = cursor
      cursor += input.untimedPanelMs
      return { panelNumber: image.panelNumber, image, startMs, endMs: cursor, durationMs: input.untimedPanelMs, timing: 'untimed-hold' as const, eventIds: [] }
    }
    const originalStart = Math.min(...assigned.map(event => event.originalRangeMs.start))
    const originalEnd = Math.max(...assigned.map(event => event.originalRangeMs.end))
    if (originalStart < 0 || originalEnd <= originalStart) throw CLIUsageError(`Panel ${image.panelNumber} resolves to an invalid assigned-audio window.`)
    const startMs = cursor
    for (const event of assigned) {
      events.push({
        ...event,
        presentationRangeMs: {
          start: startMs + event.originalRangeMs.start - originalStart,
          end: startMs + event.originalRangeMs.end - originalStart,
        },
      })
    }
    cursor += originalEnd - originalStart
    return {
      panelNumber: image.panelNumber,
      image,
      startMs,
      endMs: cursor,
      durationMs: originalEnd - originalStart,
      timing: 'assigned-audio' as const,
      eventIds: assigned.map(event => event.eventId),
    }
  })
  const base = { schemaVersion: 1 as const, presentationId: input.presentationId, durationMs: cursor, panels, events }
  return { ...base, timelineId: hashCanonicalTtsValue(base) }
}

export const createComicPresentationPlan = (
  base: Omit<ComicPresentationPlan, 'presentationId'>
): ComicPresentationPlan => ({ ...base, presentationId: hashCanonicalTtsValue(base) })

export const validateComicPresentationPlan = (plan: ComicPresentationPlan): ComicPresentationPlan => {
  const { presentationId: _presentationId, ...base } = plan
  if (plan.schemaVersion !== 1 || plan.presentationId !== hashCanonicalTtsValue(base)) throw CLIUsageError('ComicPresentationPlan has invalid content identity.')
  validatePanelSequence(plan.inputs.panels)
  if (new Set(plan.dialogueBindings.map(binding => binding.turnId)).size !== plan.dialogueBindings.length) throw CLIUsageError('ComicPresentationPlan contains duplicate dialogue bindings.')
  if (new Set(plan.soundBindings.map(binding => binding.cueId)).size !== plan.soundBindings.length) throw CLIUsageError('ComicPresentationPlan contains duplicate sound bindings.')
  return plan
}

export const validateResolvedPanelTimeline = (timeline: ResolvedPanelTimeline): ResolvedPanelTimeline => {
  const { timelineId: _timelineId, ...base } = timeline
  if (timeline.schemaVersion !== 1 || timeline.timelineId !== hashCanonicalTtsValue(base)) throw CLIUsageError('ResolvedPanelTimeline has invalid content identity.')
  let cursor = 0
  for (const panel of timeline.panels) {
    if (panel.startMs !== cursor || panel.endMs <= panel.startMs || panel.durationMs !== panel.endMs - panel.startMs) throw CLIUsageError('ResolvedPanelTimeline panel windows must be positive and sequential.')
    cursor = panel.endMs
  }
  if (cursor !== timeline.durationMs) throw CLIUsageError('ResolvedPanelTimeline duration does not match its panel windows.')
  for (const event of timeline.events) {
    const panel = timeline.panels.find(candidate => candidate.panelNumber === event.panelNumber)
    if (!panel || event.presentationRangeMs.start < panel.startMs || event.presentationRangeMs.end > panel.endMs || event.presentationRangeMs.end <= event.presentationRangeMs.start) throw CLIUsageError(`ResolvedPanelTimeline event ${event.eventId} escapes its owning panel.`)
  }
  return timeline
}
