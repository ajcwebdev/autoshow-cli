import { isRecord } from '~/utils/rest-client'
import * as v from 'valibot'
import type { StructuredValidationContext, StructuredValidationResult, ValibotSchema } from '~/types'
import { isSongLyricsPreset } from './preset-registry'
import { SongExplainerSchema, validateSongExplainerSemantics } from './song-explainer-preset-schema'

const stripMarkdownCodeFence = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('```')) {
    return trimmed
  }

  const withoutStart = trimmed.replace(/^```(?:json)?\s*/i, '')
  return withoutStart.replace(/\s*```$/, '').trim()
}

const parseJsonFromText = (raw: string): StructuredValidationResult => {
  const direct = stripMarkdownCodeFence(raw)

  try {
    return { success: true, value: JSON.parse(direct) }
  } catch {
  }

  const start = direct.indexOf('{')
  const end = direct.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const jsonCandidate = direct.slice(start, end + 1)
    try {
      return { success: true, value: JSON.parse(jsonCandidate) }
    } catch {
    }
  }

  return {
    success: false,
    issue: 'Response was not valid JSON'
  }
}

const normalizeSongLyricsValue = (
  value: unknown,
  title: string
): unknown => {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    title
  }
}

const normalizeStructuredValue = (
  value: unknown,
  context: StructuredValidationContext | undefined
): unknown => {
  const title = context?.songLyricsTitle?.trim()
  if (!context || !title) {
    return value
  }

  if (context.leafPromptNames.length <= 1) {
    const preset = context.presetNames[0]
    return preset && isSongLyricsPreset(preset) && preset !== 'rapSongChapterLyrics'
      ? normalizeSongLyricsValue(value, title)
      : value
  }

  if (!isRecord(value)) {
    return value
  }

  const normalized: Record<string, unknown> = { ...value }
  for (const [index, promptName] of context.leafPromptNames.entries()) {
    const preset = context.presetNames[index]
    if (!preset || !isSongLyricsPreset(preset) || preset === 'rapSongChapterLyrics') {
      continue
    }

    normalized[promptName] = normalizeSongLyricsValue(normalized[promptName], title)
  }

  return normalized
}

const validatePresetSemantics = (
  schema: ValibotSchema,
  value: unknown
): string | undefined => {
  // Structural validation has already established the shape of each leaf.
  if (schema === SongExplainerSchema) {
    return validateSongExplainerSemantics(value as v.InferOutput<typeof SongExplainerSchema>)
  }
  const entries = 'entries' in schema ? schema.entries : undefined
  if (isRecord(entries) && isRecord(value)) {
    for (const [key, leafSchema] of Object.entries(entries)) {
      if (leafSchema !== SongExplainerSchema) continue
      const issue = validateSongExplainerSemantics(value[key] as v.InferOutput<typeof SongExplainerSchema>)
      if (issue) return `${key}: ${issue}`
    }
  }
  return undefined
}

export const parseAndValidateStructured = (
  schema: ValibotSchema,
  rawText: string,
  context?: StructuredValidationContext
): StructuredValidationResult => {
  const parsed = parseJsonFromText(rawText)
  if (!parsed.success) {
    return parsed
  }

  const normalizedValue = normalizeStructuredValue(parsed.value, context)
  const validation = v.safeParse(schema, normalizedValue)
  if (!validation.success) {
    const flattened = v.flatten(validation.issues)
    return {
      success: false,
      issue: JSON.stringify(flattened)
    }
  }

  const semanticIssue = validatePresetSemantics(schema, validation.output)
  if (semanticIssue) return { success: false, issue: semanticIssue }

  return {
    success: true,
    value: validation.output
  }
}
