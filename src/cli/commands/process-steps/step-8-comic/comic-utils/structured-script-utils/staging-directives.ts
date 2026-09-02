import type { ExpandedScriptBlock, LocatedStagingDirective, StagingDirectiveKind, StagingPanelTarget, StructuredScriptSourceSegment, StructuredStaging } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { stripEmphasisWrapper } from './markdown-blocks'
import { parseSoundscapeBlockDirective } from './soundscape-directives'

const STAGE = 'comic:staging-directives'

export const STAGING_DIRECTIVE_LABELS = ['BLOCKING', 'CAMERA', 'BREAK-180', 'COSTUME', 'EXTRAS', 'SKIP-PANELS'] as const

const LABEL_KIND: Readonly<Record<string, StagingDirectiveKind>> = {
  BLOCKING: 'blocking',
  CAMERA: 'camera',
  'BREAK-180': 'axis-break',
  COSTUME: 'costume',
  EXTRAS: 'extras',
  'SKIP-PANELS': 'skip-panels',
}

export const STAGING_HEADER_KEYS: Readonly<Record<StagingDirectiveKind, readonly string[]>> = {
  blocking: ['state', 'location'],
  camera: ['panel'],
  'axis-break': ['panel'],
  costume: ['character'],
  extras: ['group', 'count', 'exclude'],
  'skip-panels': ['reason'],
}

const LABEL_ALTERNATION = STAGING_DIRECTIVE_LABELS.join('|')
const LABEL_THEN_TEXT = new RegExp(`^\\*\\*(${LABEL_ALTERNATION})\\s*:\\s*\\*\\*(?:\\s+([\\s\\S]+))?$`, 'iu')
const FULLY_BOLD = new RegExp(`^\\*\\*(${LABEL_ALTERNATION})\\s*:\\s*([\\s\\S]*?)\\*\\*$`, 'iu')

const canonicalLabel = (label: string): string => label.toUpperCase().replace(/\s+/gu, '')

export const parseStagingBlockDirective = (block: string): { kind: StagingDirectiveKind, label: string, prompt?: string | undefined } | undefined => {
  const trimmed = block.trim()
  const match = LABEL_THEN_TEXT.exec(trimmed) ?? FULLY_BOLD.exec(trimmed)
  if (!match?.[1]) return undefined
  const label = canonicalLabel(match[1])
  const kind = LABEL_KIND[label]
  if (!kind) return undefined
  const prompt = match[2]?.trim()
  return { kind, label, ...(prompt ? { prompt } : {}) }
}

const directiveError = (label: string, lineNumber: number, detail: string) =>
  ValidationError(`Staging directive **${label}:** on line ${lineNumber} ${detail}`, { stage: STAGE })

const normalizeProse = (value: string): string =>
  stripEmphasisWrapper(value).normalize('NFKC').replace(/\s+/gu, ' ').trim()

const parseHeader = (
  value: string,
  kind: StagingDirectiveKind,
  label: string,
  lineNumber: number,
): { header: Record<string, string>, remainder: string } => {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{')) return { header: {}, remainder: trimmed }
  const close = trimmed.indexOf('}')
  const malformed = (shown: string) => directiveError(label, lineNumber, `has a malformed header "${shown}"; expected {key: value, ...}.`)
  if (close < 0) throw malformed(trimmed)
  const inner = trimmed.slice(1, close)
  const shown = trimmed.slice(0, close + 1)
  if (inner.includes('{')) throw malformed(shown)
  const header: Record<string, string> = {}
  const allowed = STAGING_HEADER_KEYS[kind]
  if (inner.trim().length > 0) {
    for (const entry of inner.split(',')) {
      const pair = /^\s*([A-Za-z][A-Za-z0-9-]*)\s*:\s*(.*?)\s*$/u.exec(entry)
      if (!pair?.[1] || !pair[2]) throw malformed(shown)
      const key = pair[1].toLowerCase()
      if (!allowed.includes(key)) throw directiveError(label, lineNumber, `has an unknown header key "${pair[1]}"; expected ${allowed.join(', ')}.`)
      if (key in header) throw directiveError(label, lineNumber, `repeats the header key "${key}".`)
      header[key] = pair[2]
    }
  }
  return { header, remainder: trimmed.slice(close + 1).trim() }
}

const countLineBreaks = (source: string, endUtf16: number): number => {
  let count = 0
  for (let index = 0; index < endUtf16 && index < source.length; index += 1) {
    if (source.charCodeAt(index) === 10) count += 1
  }
  return count
}

const scalarOffset = (value: string, utf16Offset: number): number => [...value.slice(0, utf16Offset)].length

const buildLocatedDirective = (
  source: string,
  kind: StagingDirectiveKind,
  label: string,
  rawText: string,
  startUtf16: number,
  endUtf16: number,
): LocatedStagingDirective => {
  const lineIndex = countLineBreaks(source, startUtf16)
  const { header, remainder } = parseHeader(normalizeProse(rawText), kind, label, lineIndex + 1)
  return { kind, label, header, text: remainder, startUtf16, endUtf16, lineIndex }
}

export const locateStagingDirectives = (source: string, blocks: readonly ExpandedScriptBlock[]): LocatedStagingDirective[] => {
  const directives: LocatedStagingDirective[] = []
  let cursor = 0
  let pending: { kind: StagingDirectiveKind, label: string, startUtf16: number } | undefined
  let soundPromptPending = false

  const missingBeforeNext = (waiting: NonNullable<typeof pending>) =>
    directiveError(waiting.label, countLineBreaks(source, waiting.startUtf16) + 1, 'is missing its prose before the next directive.')

  for (const blockInfo of blocks) {
    const text = blockInfo.text.trim()
    const position = source.indexOf(text, cursor)
    if (position < 0) continue
    const end = position + text.length
    cursor = end
    const sound = parseSoundscapeBlockDirective(text)
    if (sound) {
      if (pending) throw missingBeforeNext(pending)
      soundPromptPending = sound.prompt === undefined
      continue
    }
    if (soundPromptPending) {
      soundPromptPending = false
      continue
    }
    const parsed = parseStagingBlockDirective(text)
    if (parsed) {
      if (pending) throw missingBeforeNext(pending)
      if (parsed.prompt !== undefined) {
        directives.push(buildLocatedDirective(source, parsed.kind, parsed.label, parsed.prompt, position, end))
      } else {
        pending = { kind: parsed.kind, label: parsed.label, startUtf16: position }
      }
      continue
    }
    if (pending) {
      directives.push(buildLocatedDirective(source, pending.kind, pending.label, text, pending.startUtf16, end))
      pending = undefined
    }
  }
  if (pending) throw directiveError(pending.label, countLineBreaks(source, pending.startUtf16) + 1, 'at the end of the scene is missing its prose.')
  return directives
}

const nearestPrecedingSegment = (
  startScalar: number,
  segments: readonly StructuredScriptSourceSegment[],
): StructuredScriptSourceSegment | undefined => {
  let best: { segment: StructuredScriptSourceSegment, end: number } | undefined
  for (const segment of segments) {
    if (segment.sourceSpans.length === 0) continue
    const end = Math.max(...segment.sourceSpans.map(span => span.end))
    if (end <= startScalar && (best === undefined || end >= best.end)) best = { segment, end }
  }
  return best?.segment
}

const parsePanelTarget = (value: string | undefined, label: string, lineNumber: number): StagingPanelTarget => {
  if (value === undefined) return 'next'
  if (/^next$/iu.test(value)) return 'next'
  if (/^\d+$/u.test(value) && Number(value) > 0) return Number(value)
  throw directiveError(label, lineNumber, `has an invalid panel value "${value}"; expected a positive integer or next.`)
}

const parseCount = (value: string | undefined, label: string, lineNumber: number): number | null => {
  if (value === undefined) return null
  if (/^\d+$/u.test(value) && Number(value) > 0) return Number(value)
  throw directiveError(label, lineNumber, `has an invalid count value "${value}"; expected a positive integer.`)
}

const requireText = (directive: LocatedStagingDirective, lineNumber: number): string => {
  if (!directive.text) throw directiveError(directive.label, lineNumber, 'requires prose after the header.')
  return directive.text
}

export const buildStructuredStaging = (input: {
  exactSource: string
  expandedBlocks: readonly ExpandedScriptBlock[]
  sourceSegments: readonly StructuredScriptSourceSegment[]
  sceneLocationKey: string
}): StructuredStaging | undefined => {
  const located = locateStagingDirectives(input.exactSource, input.expandedBlocks)
    .sort((left, right) => left.startUtf16 - right.startUtf16 || left.endUtf16 - right.endUtf16)
  if (located.length === 0) return undefined

  const staging: StructuredStaging = { blocking: [], camera: [], axisBreaks: [], costume: [], extras: [], skipPanels: null }
  let blockingOrdinal = 0
  for (const directive of located) {
    const lineNumber = directive.lineIndex + 1
    const after = nearestPrecedingSegment(scalarOffset(input.exactSource, directive.startUtf16), input.sourceSegments)
    const placement = { lineIndex: directive.lineIndex, afterSegmentId: after?.id ?? null }
    switch (directive.kind) {
      case 'blocking': {
        blockingOrdinal += 1
        const text = requireText(directive, lineNumber)
        staging.blocking.push({
          ...placement,
          state: directive.header['state'] ?? `state-${blockingOrdinal}`,
          location: directive.header['location'] ?? after?.location.key ?? input.sceneLocationKey,
          text,
        })
        break
      }
      case 'camera':
      case 'axis-break': {
        const panel = parsePanelTarget(directive.header['panel'], directive.label, lineNumber)
        const text = requireText(directive, lineNumber)
        ;(directive.kind === 'camera' ? staging.camera : staging.axisBreaks).push({ ...placement, panel, text })
        break
      }
      case 'costume': {
        const character = directive.header['character']
        if (!character) throw directiveError(directive.label, lineNumber, 'requires a character header like {character: duco}.')
        const text = requireText(directive, lineNumber)
        staging.costume.push({ ...placement, character, text })
        break
      }
      case 'extras': {
        const group = directive.header['group']
        if (!group) throw directiveError(directive.label, lineNumber, 'requires a group header like {group: villagers}.')
        const count = parseCount(directive.header['count'], directive.label, lineNumber)
        const exclude = (directive.header['exclude'] ?? '').split('|').map(part => part.trim()).filter(part => part.length > 0)
        const text = requireText(directive, lineNumber)
        staging.extras.push({ ...placement, group, count, exclude, text })
        break
      }
      case 'skip-panels': {
        const reason = [directive.header['reason'], directive.text].filter((part): part is string => Boolean(part)).join(' ')
        if (!reason) throw directiveError(directive.label, lineNumber, 'requires a reason like {reason: previously-on recap}.')
        if (staging.skipPanels) throw directiveError(directive.label, lineNumber, `repeats the scene's skip-panels directive from line ${staging.skipPanels.lineIndex + 1}.`)
        staging.skipPanels = { lineIndex: directive.lineIndex, reason }
        break
      }
    }
  }
  return staging
}
