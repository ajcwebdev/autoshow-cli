import type { ExpandedScriptBlock, StructuredScriptBeat, StructuredScriptData } from '~/types'
import { TRANSITION_PATTERNS } from './structured-script-constants'
import { detectSpeakerLabelCharacters, isUncataloguedSpokenSpeakerLabel } from './character-detection'

export const normalizeLineEndings = (content: string): string => content.replace(/\r\n/g, '\n')

export const normalizeBlockText = (block: string): string => {
  return block
    .split('\n')
    .map(line => line.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const splitIntoBlocks = (body: string): string[] => {
  return body
    .split(/\n\s*\n/g)
    .map(block => block.trim())
    .filter(block => block.length > 0 && block !== '---')
}

export const expandScriptBlocks = (blocks: string[]): ExpandedScriptBlock[] => {
  return blocks.flatMap(block => {
    const lines = block
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)

    if (lines.length <= 1 || !extractSingleBoldLine(lines[0] ?? '')) {
      return [{ text: block }]
    }

    const expanded: ExpandedScriptBlock[] = [{ text: lines[0]! }]
    let buffer: string[] = []

    for (const line of lines.slice(1)) {
      if (extractSingleBoldLine(line) || isParentheticalBlock(line)) {
        if (buffer.length > 0) {
          expanded.push({
            text: buffer.join('\n'),
            followsBoldLabelInSameBlock: true,
          })
          buffer = []
        }

        expanded.push({ text: line })
        continue
      }

      buffer.push(line)
    }

    if (buffer.length > 0) {
      expanded.push({
        text: buffer.join('\n'),
        followsBoldLabelInSameBlock: true,
      })
    }

    return expanded
  })
}

const stripLeadingMarkdownMarkers = (text: string): string => {
  return text.trim().replace(/^[*_`~\s]+/, '')
}

export const looksLikeLabeledActionFragment = (text: string): boolean => {
  const stripped = stripLeadingMarkdownMarkers(text)
  return /^[a-z]/.test(stripped)
}

export const extractSingleBoldLine = (block: string): string | null => {
  const match = block.trim().match(/^\*\*(.+?)\*\*$/)
  return match?.[1]?.trim() ?? null
}

export const isParentheticalBlock = (block: string): boolean => {
  return /^\((?:[\s\S]+)\)$/.test(block.trim())
}

export const isPanelNoteBlock = (block: string): boolean => {
  return /^\[[\s\S]+\]$/.test(block.trim())
}

export const trimPanelNote = (block: string): string => {
  return block.trim().replace(/^\[/, '').replace(/\]$/, '').trim()
}

export const trimParenthetical = (block: string): string => {
  return block.trim().replace(/^\(/, '').replace(/\)$/, '').trim()
}

export const isTransitionText = (text: string): boolean => {
  return TRANSITION_PATTERNS.some(pattern => pattern.test(text.trim()))
}

// Screenplay timing notation such as "(beat)" or "(a long pause)" is performance
// pacing, never spoken words, so it must not survive into text an artist letters.
const TIMING_DIRECTION_MODIFIERS = 'a|an|another|one|two|long|short|brief|slight|small|awkward|uncomfortable|heavy|dead|stunned|very'
const TIMING_DIRECTION_NOUNS = 'beat|beats|pause|pauses|silence|moment|moments'
const TIMING_DIRECTION_BODY = `(?:(?:${TIMING_DIRECTION_MODIFIERS})\\s+)*(?:${TIMING_DIRECTION_NOUNS})`
const INLINE_TIMING_DIRECTION_PATTERN = new RegExp(`\\s*\\(\\s*${TIMING_DIRECTION_BODY}\\s*[.…]?\\s*\\)`, 'gi')
const TIMING_ONLY_DIRECTION_PATTERN = new RegExp(`^${TIMING_DIRECTION_BODY}\\s*[.…]?$`, 'i')

export const isTimingOnlyDirection = (text: string): boolean => {
  return TIMING_ONLY_DIRECTION_PATTERN.test(text.trim())
}

export const stripInlineStageDirections = (text: string): string => {
  return text
    .replace(INLINE_TIMING_DIRECTION_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?…])/g, '$1')
    .trim()
}

const EMPHASIS_WRAPPER_PATTERN = /^(\*\*\*|\*\*|\*|___|__|_)([\s\S]+?)\1$/

// Action blocks are authored as "*They stare at the floor.*". The asterisks are
// markdown emphasis, not part of the staging text, and reach image prompts as
// literal characters unless they are removed here.
export const stripEmphasisWrapper = (text: string): string => {
  const trimmed = text.trim()
  const match = trimmed.match(EMPHASIS_WRAPPER_PATTERN)
  return match?.[2]?.trim() ?? trimmed
}

// A caption is the only staging-adjacent block that is deliberately lettered, so
// it must be opted into with an explicit "**CAPTION**" label above the text.
const CAPTION_SPEAKER_LABEL_PATTERN = /^(?:CAPTION|NARRATION)(?:\s*\d+)?$/i

export const isCaptionSpeakerLabel = (label: string): boolean => {
  return CAPTION_SPEAKER_LABEL_PATTERN.test(label.trim())
}

export const parseHeading = (
  heading: string,
  options: { stripWrappingQuotes?: boolean } = {}
): { heading: string; label?: string; title: string } => {
  const normalizedHeading = heading.trim()
  const [labelPart, ...titleParts] = normalizedHeading.split(':')
  const hasDelimitedTitle = titleParts.length > 0
  const rawTitle = hasDelimitedTitle ? titleParts.join(':').trim() : normalizedHeading
  const title = options.stripWrappingQuotes
    ? rawTitle.replace(/^["']/, '').replace(/["']$/, '')
    : rawTitle

  return {
    heading: normalizedHeading,
    ...(hasDelimitedTitle ? { label: (labelPart ?? normalizedHeading).trim() } : {}),
    title,
  }
}

export const parseMetadataEntry = (raw: string): StructuredScriptData['document']['metadata'][number] => {
  if (raw.includes(':')) {
    const [label, ...rest] = raw.split(':')
    const value = rest.join(':').trim()
    return {
      label: (label ?? raw).trim(),
      ...(value ? { value } : {}),
      raw,
    }
  }

  if (raw.includes(' - ')) {
    const [label, ...rest] = raw.split(' - ')
    const value = rest.join(' - ').trim()
    return {
      label: (label ?? raw).trim(),
      ...(value ? { value } : {}),
      raw,
    }
  }

  return {
    label: raw,
    raw,
  }
}

const TRANSITION_PREFIXED_SLUGLINE = /^(?:(?:CUT|SMASH CUT|MATCH CUT|DISSOLVE|FADE)\s+TO|LATER|MOMENTS LATER)\s*:\s*((?:INT|EXT|INT\/EXT|EXT\/INT)\.?\s+.+)$/i

export const extractLocationSlugline = (raw: string): string | null => {
  const normalized = raw.trim()
  const prefixed = normalized.match(TRANSITION_PREFIXED_SLUGLINE)?.[1]
  const candidate = prefixed?.trim() ?? normalized
  return /^(?:INT|EXT|INT\/EXT|EXT\/INT)\.?\s+.+$/i.test(candidate) ? candidate : null
}

export const parseLocation = (raw: string, key: string): StructuredScriptData['scene']['location'] => {
  const slugline = extractLocationSlugline(raw) ?? raw
  const match = slugline.match(/^(INT|EXT|INT\/EXT|EXT\/INT)\.?\s+(.*)$/i)

  if (!match?.[1] || !match[2]) {
    return { key, raw }
  }

  return {
    key,
    raw,
    type: match[1].toUpperCase().replace(/\./g, ''),
    place: match[2].trim(),
  }
}

const LOCATION_HINT_PATTERN = /\b(?:USS|INT|EXT|BRIDGE|BAY|DECK|CORRIDOR|HALL|OFFICE|QUARTERS|ROOM|LAB|ENGINE|FABRICATION|CARGO|AIRLOCK|HULL|SHUTTLE|SHIP|STATION|PLANET|SURFACE|COLONY|VILLAGE|SQUARE|CENTER|CENTRE|DOCK|PORT|WARD|MESS|GALLEY|TRANSPORT|ARRAY)\b/i

export const isSceneLocationLine = (raw: string): boolean => {
  if (
    detectSpeakerLabelCharacters(raw).length > 0
    || isUncataloguedSpokenSpeakerLabel(raw)
  ) {
    return false
  }

  return extractLocationSlugline(raw) !== null || LOCATION_HINT_PATTERN.test(raw)
}

export const resolveFallbackSceneLocation = (
  metadata: StructuredScriptData['document']['metadata'],
  sceneTitle: string
): string => {
  const locationEntry = metadata.find(entry => {
    return isSceneLocationLine(entry.value ?? entry.raw)
  })
  const fallbackEntry = locationEntry ?? metadata[0]

  return fallbackEntry?.value ?? fallbackEntry?.raw ?? sceneTitle
}

export const extractLeadingDelivery = (text: string): { text: string; delivery?: string } => {
  const match = text.match(/^\(([^)]+)\)\s+([\s\S]+)$/)
  if (!match?.[1] || !match[2]) {
    return { text }
  }

  return {
    delivery: match[1].trim(),
    text: match[2].trim(),
  }
}

export const buildBeat = (
  index: number,
  options: Omit<StructuredScriptBeat, 'index'>
): StructuredScriptBeat => {
  return {
    index,
    ...options,
  }
}
