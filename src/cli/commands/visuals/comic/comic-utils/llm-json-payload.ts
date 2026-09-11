import { ValidationError } from '~/utils/error-handler'

export const extractLlmJsonPayload = (content: string, stage: string): string => {
  const trimmed = content.trim()
  if (!trimmed) {
    throw ValidationError('Model response was empty', { stage })
  }

  const fencedJsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fencedJsonMatch?.[1]) {
    return fencedJsonMatch[1].trim()
  }

  const firstBraceIndex = trimmed.indexOf('{')
  const lastBraceIndex = trimmed.lastIndexOf('}')
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return trimmed.slice(firstBraceIndex, lastBraceIndex + 1)
  }

  return trimmed
}
