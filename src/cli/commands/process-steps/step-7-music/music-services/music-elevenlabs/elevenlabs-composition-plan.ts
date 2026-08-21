import type { ElevenLabsCompositionChunk, ElevenLabsCompositionPlan, LyricsSection } from '~/types'
import { ValidationError } from '~/utils/error-handler'

const ELEVENLABS_PLAN_MAX_CHUNKS = 30
const ELEVENLABS_CHUNK_MIN_MS = 3000
const ELEVENLABS_CHUNK_MAX_MS = 120000
const ELEVENLABS_PLAN_MIN_MS = 3000
const ELEVENLABS_PLAN_MAX_MS = 600000
const ELEVENLABS_MAX_STYLES = 50

const SECTION_HEADER_PATTERN = /^\[?\s*((?:pre[- ]?chorus|chorus|verse|bridge|intro|outro|hook|refrain|interlude|breakdown|drop|voiceover)(?:\s*\d+)?)\s*\]?[:.]?$/i

const NEGATIVE_STYLES_PATTERN = /^negative(?:\s+styles)?\s*:\s*(.+)$/i

const titleCaseLabel = (label: string): string =>
  label
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b[a-z]/g, (character) => character.toUpperCase())

/** Split section-labeled lyrics text into ordered sections. */
const parseLyricsSections = (lyrics: string): LyricsSection[] => {
  const sections: LyricsSection[] = []
  let current: LyricsSection | undefined

  for (const rawLine of lyrics.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) {
      continue
    }

    const headerMatch = SECTION_HEADER_PATTERN.exec(line)
    if (headerMatch?.[1]) {
      current = { label: titleCaseLabel(headerMatch[1]), lines: [] }
      sections.push(current)
      continue
    }

    if (!current) {
      current = { label: 'Verse', lines: [] }
      sections.push(current)
    }

    current.lines.push(line)
  }

  return sections.filter((section) => section.lines.length > 0)
}

/**
 * Split a free-text style prompt into ElevenLabs style descriptors. An optional
 * trailing `Negative styles: a, b` line supplies negative styles for every chunk.
 */
const parseStylePrompt = (prompt: string): { positiveStyles: string[], negativeStyles: string[] } => {
  const positiveStyles: string[] = []
  const negativeStyles: string[] = []

  for (const rawLine of prompt.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) {
      continue
    }

    const negativeMatch = NEGATIVE_STYLES_PATTERN.exec(line)
    if (negativeMatch?.[1]) {
      negativeStyles.push(...splitStyleList(negativeMatch[1]))
      continue
    }

    positiveStyles.push(...splitStyleList(line))
  }

  return {
    positiveStyles: dedupe(positiveStyles).slice(0, ELEVENLABS_MAX_STYLES),
    negativeStyles: dedupe(negativeStyles).slice(0, ELEVENLABS_MAX_STYLES)
  }
}

const splitStyleList = (value: string): string[] =>
  value
    .split(/[,;.]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

const dedupe = (values: string[]): string[] => {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = value.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(value)
  }
  return result
}

/**
 * Allocate per-chunk durations proportional to line count while honoring the
 * per-chunk 3s-120s bounds and keeping the total at the requested length.
 */
const allocateChunkDurations = (weights: number[], totalMs: number): number[] => {
  const count = weights.length
  const minTotal = count * ELEVENLABS_CHUNK_MIN_MS
  const maxTotal = count * ELEVENLABS_CHUNK_MAX_MS
  const target = Math.min(Math.max(totalMs, minTotal), maxTotal)
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)

  const durations = weights.map((weight) => {
    const share = weightSum > 0 ? (weight / weightSum) * target : target / count
    return Math.min(Math.max(Math.round(share), ELEVENLABS_CHUNK_MIN_MS), ELEVENLABS_CHUNK_MAX_MS)
  })

  let residual = target - durations.reduce((sum, duration) => sum + duration, 0)
  while (residual !== 0) {
    const step = residual > 0 ? 1 : -1
    const before = residual
    for (let index = 0; index < durations.length && residual !== 0; index += 1) {
      const next = (durations[index] as number) + step * Math.min(Math.abs(residual), 1000)
      if (next < ELEVENLABS_CHUNK_MIN_MS || next > ELEVENLABS_CHUNK_MAX_MS) {
        continue
      }
      residual -= next - (durations[index] as number)
      durations[index] = next
    }
    if (residual === before) {
      break
    }
  }

  return durations
}

/**
 * Build a `music_v2` composition plan from section-labeled lyrics. The first
 * chunk carries the full style list because it sets the genre for the song.
 */
export const buildElevenLabsCompositionPlan = (
  lyrics: string,
  options: {
    stylePrompt: string
    durationSeconds: number
  }
): ElevenLabsCompositionPlan => {
  const sections = parseLyricsSections(lyrics)
  if (sections.length === 0) {
    throw ValidationError('Lyrics file contained no usable lines for an ElevenLabs composition plan', { stage: 'music:elevenlabs' })
  }

  if (sections.length > ELEVENLABS_PLAN_MAX_CHUNKS) {
    throw ValidationError(`ElevenLabs composition plans allow at most ${ELEVENLABS_PLAN_MAX_CHUNKS} sections. Lyrics file produced ${sections.length}.`, { stage: 'music:elevenlabs' })
  }

  const { positiveStyles, negativeStyles } = parseStylePrompt(options.stylePrompt)
  if (positiveStyles.length === 0) {
    throw ValidationError('ElevenLabs composition plans require at least one style. Provide a style prompt alongside --lyrics-file.', { stage: 'music:elevenlabs' })
  }

  const totalMs = Math.min(Math.max(Math.round(options.durationSeconds * 1000), ELEVENLABS_PLAN_MIN_MS), ELEVENLABS_PLAN_MAX_MS)
  const durations = allocateChunkDurations(sections.map((section) => section.lines.length), totalMs)

  const chunks: ElevenLabsCompositionChunk[] = sections.map((section, index) => ({
    text: [`[${section.label}]`, ...section.lines].join('\n'),
    duration_ms: durations[index] as number,
    positive_styles: index === 0 ? positiveStyles : positiveStyles.slice(0, 4),
    negative_styles: negativeStyles,
    context_adherence: 'high'
  }))

  return { chunks }
}
