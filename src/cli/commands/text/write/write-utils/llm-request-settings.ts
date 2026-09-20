import { isRecord } from '~/utils/rest-client'
import { sha256Bytes } from '~/utils/value-helpers'

const PROMPT_BEARING_KEYS = new Set(['messages', 'input', 'contents', 'prompt', 'system'])
const SCHEMA_KEYS = new Set(['schema', 'responseJsonSchema'])

const recordableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(recordableValue)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
    if (PROMPT_BEARING_KEYS.has(key)) return []
    if (SCHEMA_KEYS.has(key)) return [[`${key}Sha256`, sha256Bytes(JSON.stringify(entry ?? null))]]
    return [[key, recordableValue(entry)]]
  }))
}

// The request body as sent, minus prompt text; JSON schemas are recorded by hash so the run record stays small.
export const llmRequestSettings = (requestBody: Record<string, unknown>): Record<string, unknown> =>
  recordableValue(requestBody) as Record<string, unknown>
