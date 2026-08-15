import type { ExpandedScriptBlock, SoundscapeAnchor, StructuredScriptSourceSegment, StructuredSoundscape } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { hashCanonicalTtsValue } from '../../../step-4-tts/script-to-audio/contract-identity'
import { stripEmphasisWrapper } from './markdown-blocks'

type DirectiveKind = 'action-sfx' | 'vocal-reaction' | 'ambience'

type AmbientRangeBound = 'scene-start' | 'scene-end' | 'previous-line-end' | 'next-line-start'

type LocatedDirective = {
  kind: DirectiveKind
  prompt: string
  required: boolean
  durationSeconds?: number | undefined
  gainDb?: number | undefined
  pan?: number | undefined
  rangeFrom?: AmbientRangeBound | undefined
  rangeTo?: AmbientRangeBound | undefined
  startUtf16: number
  endUtf16: number
  inline: boolean
}

const LABEL_KIND: Readonly<Record<string, DirectiveKind>> = {
  SFX: 'action-sfx',
  'VOCAL SFX': 'vocal-reaction',
  AMBIENCE: 'ambience',
}

type DirectiveControls = Pick<LocatedDirective, 'durationSeconds' | 'gainDb' | 'pan' | 'rangeFrom' | 'rangeTo'>

const AMBIENT_RANGE_BOUNDS = new Set<AmbientRangeBound>(['scene-start', 'scene-end', 'previous-line-end', 'next-line-start'])

const parseAmbientRangeBound = (value: string, label: 'from' | 'to'): AmbientRangeBound => {
  const bound = value.trim().toLowerCase()
  if (!AMBIENT_RANGE_BOUNDS.has(bound as AmbientRangeBound)) throw CLIUsageError(`Sound directive ${label} must be scene-start, scene-end, previous-line-end, or next-line-start.`)
  if (label === 'from' && bound === 'scene-end') throw CLIUsageError('Sound directive from cannot be scene-end.')
  if (label === 'to' && bound === 'scene-start') throw CLIUsageError('Sound directive to cannot be scene-start.')
  return bound as AmbientRangeBound
}

const parseControls = (value: string): { remainder: string, controls: DirectiveControls } => {
  const match = /^\{([^{}]+)\}\s*/u.exec(value)
  if (!match?.[1]) return { remainder: value, controls: {} }
  const controls: DirectiveControls = {}
  const seen = new Set<string>()
  for (const entry of match[1].split(',').map(part => part.trim())) {
    const pair = /^(duration|gain|pan|from|to)\s*:\s*(.+)$/iu.exec(entry)
    if (!pair?.[1] || !pair[2]) throw CLIUsageError(`Invalid sound directive control "${entry}"; expected duration, gain, pan, from, or to.`)
    const key = pair[1].toLowerCase()
    if (seen.has(key)) throw CLIUsageError(`Sound directive control ${key} is duplicated.`)
    seen.add(key)
    if (key === 'duration') {
      const duration = /^(\d+(?:\.\d+)?)\s*s$/iu.exec(pair[2])
      if (!duration?.[1]) throw CLIUsageError('Sound directive duration must use seconds, for example duration: 2.5s.')
      controls.durationSeconds = Number(duration[1])
      if (controls.durationSeconds < 0.5 || controls.durationSeconds > 30) throw CLIUsageError('Sound directive duration must be between 0.5 and 30 seconds.')
      continue
    }
    if (key === 'gain') {
      const gain = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*dB$/iu.exec(pair[2])
      if (!gain?.[1]) throw CLIUsageError('Sound directive gain must use decibels, for example gain: -3dB.')
      controls.gainDb = Number(gain[1])
      continue
    }
    if (key === 'from') {
      controls.rangeFrom = parseAmbientRangeBound(pair[2], 'from')
      continue
    }
    if (key === 'to') {
      controls.rangeTo = parseAmbientRangeBound(pair[2], 'to')
      continue
    }
    const pan = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/u.exec(pair[2])
    if (!pan?.[1]) throw CLIUsageError('Sound directive pan must be a number between -1 and 1.')
    controls.pan = Number(pan[1])
    if (controls.pan < -1 || controls.pan > 1) throw CLIUsageError('Sound directive pan must be between -1 and 1.')
  }
  if ((controls.rangeFrom === undefined) !== (controls.rangeTo === undefined)) throw CLIUsageError('Sound directive ambient range requires both from and to.')
  return { remainder: value.slice(match[0].length).trim(), controls }
}

const normalizePrompt = (value: string): { prompt: string, required: boolean } & DirectiveControls => {
  const normalized = stripEmphasisWrapper(value).normalize('NFKC').replace(/\s+/gu, ' ').trim()
  const optional = /^OPTIONAL(?:\s*[:\-]\s*|\s+)/iu.exec(normalized)
  const withoutPolicy = optional ? normalized.slice(optional[0].length).trim() : normalized
  const { remainder: prompt, controls } = parseControls(withoutPolicy)
  if (!prompt) throw CLIUsageError('Sound directive requires a non-empty authored prompt.')
  return { prompt, required: !optional, ...controls }
}

export const parseSoundscapeBlockDirective = (block: string): { kind: DirectiveKind, prompt?: string | undefined } | undefined => {
  const trimmed = block.trim()
  const labelThenText = /^\*\*(SFX|VOCAL SFX|AMBIENCE)\s*:\s*\*\*(?:\s+([\s\S]+))?$/iu.exec(trimmed)
  if (labelThenText?.[1]) return { kind: LABEL_KIND[labelThenText[1].toUpperCase()] as DirectiveKind, ...(labelThenText[2]?.trim() ? { prompt: labelThenText[2].trim() } : {}) }
  const fullyBold = /^\*\*(SFX|VOCAL SFX|AMBIENCE)\s*:\s*([\s\S]*?)\*\*$/iu.exec(trimmed)
  if (fullyBold?.[1]) return { kind: LABEL_KIND[fullyBold[1].toUpperCase()] as DirectiveKind, ...(fullyBold[2]?.trim() ? { prompt: fullyBold[2].trim() } : {}) }
  return undefined
}

export const stripInlineSoundscapeDirectives = (value: string): string => value
  .replace(/\[\[(?:SFX|VOCAL SFX)\s*:\s*[\s\S]*?\]\]/giu, ' ')
  .replace(/\s+/gu, ' ')
  .replace(/\s+([,.;:!?…])/gu, '$1')
  .trim()

const scalarOffset = (value: string, utf16Offset: number): number => [...value.slice(0, utf16Offset)].length

const locateExpandedBlocks = (source: string, blocks: readonly ExpandedScriptBlock[]): LocatedDirective[] => {
  const directives: LocatedDirective[] = []
  let cursor = 0
  let pending: { kind: DirectiveKind, startUtf16: number, labelEndUtf16: number } | undefined

  for (const blockInfo of blocks) {
    const text = blockInfo.text.trim()
    const position = source.indexOf(text, cursor)
    if (position < 0) continue
    const end = position + text.length
    cursor = end
    const parsed = parseSoundscapeBlockDirective(text)
    if (parsed) {
      if (pending) throw CLIUsageError('A sound directive label is missing its prompt before the next sound directive.')
      if (parsed.prompt) {
        const normalized = normalizePrompt(parsed.prompt)
        directives.push({ kind: parsed.kind, ...normalized, startUtf16: position, endUtf16: end, inline: false })
      } else {
        pending = { kind: parsed.kind, startUtf16: position, labelEndUtf16: end }
      }
      continue
    }
    if (pending) {
      const normalized = normalizePrompt(text)
      directives.push({ kind: pending.kind, ...normalized, startUtf16: pending.startUtf16, endUtf16: end, inline: false })
      pending = undefined
    }
  }
  if (pending) throw CLIUsageError('A sound directive label at the end of the scene is missing its prompt.')
  return directives
}

const locateInlineDirectives = (source: string): LocatedDirective[] => [...source.matchAll(/\[\[(SFX|VOCAL SFX)\s*:\s*([\s\S]*?)\]\]/giu)].map((match) => {
  if (match.index === undefined || !match[1]) throw CLIUsageError('Inline sound directive has no exact source position.')
  const normalized = normalizePrompt(match[2] ?? '')
  return {
    kind: LABEL_KIND[match[1].toUpperCase()] as DirectiveKind,
    ...normalized,
    startUtf16: match.index,
    endUtf16: match.index + match[0].length,
    inline: true,
  }
})

const segmentBounds = (segment: StructuredScriptSourceSegment): { start: number, end: number } | undefined => {
  const spans = segment.sourceSpans.filter(span => span.kind === 'spoken-text')
  if (spans.length === 0) return undefined
  return { start: Math.min(...spans.map(span => span.start)), end: Math.max(...spans.map(span => span.end)) }
}

const inlineAnchor = (
  directiveStart: number,
  segments: readonly StructuredScriptSourceSegment[],
): StructuredSoundscape['cues'][number]['anchor'] => {
  const segment = segments.find((candidate) => {
    if (candidate.type !== 'dialogue' && candidate.type !== 'narration') return false
    const bounds = segmentBounds(candidate)
    return bounds !== undefined && directiveStart >= bounds.start && directiveStart <= bounds.end
  })
  if (!segment) throw CLIUsageError('Inline sound directive cannot be mapped to one speakable source segment.')
  let canonicalCursor = 0
  for (const span of segment.sourceSpans.filter(candidate => candidate.kind === 'spoken-text').sort((left, right) => left.start - right.start || left.end - right.end)) {
    if (span.end > directiveStart) break
    const spoken = span.text.trim()
    if (!spoken) continue
    const index = segment.text.indexOf(spoken, canonicalCursor)
    if (index >= canonicalCursor) canonicalCursor = index + [...spoken].length
  }
  return { kind: 'source-text-offset', sourceSegmentId: segment.id, textOffset: canonicalCursor, indexUnit: 'unicode-scalar-value', offsetMs: 0 }
}

const blockAnchor = (
  directiveStart: number,
  segments: readonly StructuredScriptSourceSegment[],
): StructuredSoundscape['cues'][number]['anchor'] => {
  const prior = segments
    .filter(segment => segment.type === 'dialogue' || segment.type === 'narration')
    .flatMap(segment => {
      const bounds = segmentBounds(segment)
      return bounds && bounds.end <= directiveStart ? [{ segment, end: bounds.end }] : []
    })
    .sort((left, right) => right.end - left.end)[0]
  return prior
    ? { kind: 'source-segment-edge', sourceSegmentId: prior.segment.id, edge: 'end', offsetMs: 0 }
    : { kind: 'scene-clock', positionMs: 0 }
}

const previousSpeakableAnchor = (
  directiveStart: number,
  segments: readonly StructuredScriptSourceSegment[],
): SoundscapeAnchor => {
  const prior = blockAnchor(directiveStart, segments)
  return prior.kind === 'scene-clock' ? { kind: 'resolved-scene-edge', edge: 'start' } : prior
}

const nextSpeakableAnchor = (
  directiveEnd: number,
  segments: readonly StructuredScriptSourceSegment[],
): SoundscapeAnchor => {
  const next = segments
    .filter(segment => segment.type === 'dialogue' || segment.type === 'narration')
    .flatMap(segment => {
      const bounds = segmentBounds(segment)
      return bounds && bounds.start >= directiveEnd ? [{ segment, start: bounds.start }] : []
    })
    .sort((left, right) => left.start - right.start)[0]
  return next
    ? { kind: 'source-segment-edge', sourceSegmentId: next.segment.id, edge: 'start', offsetMs: 0 }
    : { kind: 'resolved-scene-edge', edge: 'end' }
}

const resolveAmbientRangeBound = (
  bound: AmbientRangeBound,
  directiveStart: number,
  directiveEnd: number,
  segments: readonly StructuredScriptSourceSegment[],
): SoundscapeAnchor => {
  if (bound === 'scene-start') return { kind: 'resolved-scene-edge', edge: 'start' }
  if (bound === 'scene-end') return { kind: 'resolved-scene-edge', edge: 'end' }
  if (bound === 'previous-line-end') return previousSpeakableAnchor(directiveStart, segments)
  return nextSpeakableAnchor(directiveEnd, segments)
}

export const buildStructuredSoundscape = (input: {
  exactSource: string
  expandedBlocks: readonly ExpandedScriptBlock[]
  sourceSegments: readonly StructuredScriptSourceSegment[]
  sourceIdentityHash: string
}): StructuredSoundscape => {
  const directives = [
    ...locateExpandedBlocks(input.exactSource, input.expandedBlocks),
    ...locateInlineDirectives(input.exactSource),
  ].sort((left, right) => left.startUtf16 - right.startUtf16 || left.endUtf16 - right.endUtf16)
  const spans = directives.map(directive => ({
    kind: 'sound-effect' as const,
    start: scalarOffset(input.exactSource, directive.startUtf16),
    end: scalarOffset(input.exactSource, directive.endUtf16),
    indexUnit: 'unicode-scalar-value' as const,
    text: input.exactSource.slice(directive.startUtf16, directive.endUtf16),
  }))
  const cueIds = directives.map((directive, index) => hashCanonicalTtsValue({
    sourceIdentityHash: input.sourceIdentityHash,
    sourceSpan: spans[index],
    kind: directive.kind,
    prompt: directive.prompt,
    required: directive.required,
    durationSeconds: directive.durationSeconds ?? null,
    gainDb: directive.gainDb ?? null,
    pan: directive.pan ?? null,
    rangeFrom: directive.rangeFrom ?? null,
    rangeTo: directive.rangeTo ?? null,
  }))
  if (new Set(cueIds).size !== cueIds.length) throw CLIUsageError('Structured soundscape contains duplicate stable cue identities.')

  const cues: StructuredSoundscape['cues'] = []
  const ambientBeds: StructuredSoundscape['ambientBeds'] = []
  directives.forEach((directive, index) => {
    const common = {
      cueId: cueIds[index] as string,
      prompt: directive.prompt,
      required: directive.required,
      sourceSpan: spans[index] as NonNullable<typeof spans[number]>,
      ...(directive.durationSeconds !== undefined ? { durationSeconds: directive.durationSeconds } : {}),
      ...(directive.gainDb !== undefined ? { gainDb: directive.gainDb } : {}),
      ...(directive.pan !== undefined ? { pan: directive.pan } : {}),
    }
    if (directive.kind === 'ambience') {
      if (directive.inline) throw CLIUsageError('AMBIENCE is a block directive; inline ambience ranges must use structured anchor data.')
      if ((directive.rangeFrom === undefined) !== (directive.rangeTo === undefined)) throw CLIUsageError('AMBIENCE range requires both from and to.')
      const start = spans[index]?.start
      const end = spans[index]?.end
      if (start === undefined || end === undefined) throw CLIUsageError('Ambient cue has no exact source position.')
      const range = directive.rangeFrom && directive.rangeTo && !(directive.rangeFrom === 'scene-start' && directive.rangeTo === 'scene-end')
        ? {
            kind: 'anchors' as const,
            start: resolveAmbientRangeBound(directive.rangeFrom, start, end, input.sourceSegments),
            end: resolveAmbientRangeBound(directive.rangeTo, start, end, input.sourceSegments),
          }
        : { kind: 'full-scene' as const }
      ambientBeds.push({ ...common, kind: 'ambience', range })
      return
    }
    if (directive.rangeFrom !== undefined || directive.rangeTo !== undefined) throw CLIUsageError('from/to range controls are only valid on AMBIENCE directives.')
    const start = spans[index]?.start
    if (start === undefined) throw CLIUsageError('Sound cue has no exact source position.')
    cues.push({ ...common, kind: directive.kind, anchor: directive.inline ? inlineAnchor(start, input.sourceSegments) : blockAnchor(start, input.sourceSegments) })
  })
  return { cues, ambientBeds }
}
