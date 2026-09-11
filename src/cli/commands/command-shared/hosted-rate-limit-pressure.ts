import type { ProviderLanePressureFeedback } from '~/types'
import { AppError } from '~/utils/error-handler'

const readNestedErrorValue = (error: unknown, key: string): unknown => {
  const seen = new Set<unknown>()
  let current = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    if (key in current) return (current as Record<string, unknown>)[key]
    if (current instanceof AppError && key in current.metadata) return current.metadata[key]
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined
  }
  return undefined
}

const readHeader = (headers: unknown, name: string): string | undefined => {
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  if (headers && typeof headers === 'object' && 'get' in headers && typeof headers.get === 'function') {
    const value = (headers.get as (key: string) => unknown)(name)
    return typeof value === 'string' ? value : undefined
  }
  if (!headers || typeof headers !== 'object') return undefined
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())
  const value = entry?.[1]
  if (Array.isArray(value)) return value.find((item): item is string => typeof item === 'string')
  if (typeof value === 'number') return String(value)
  return typeof value === 'string' ? value : undefined
}

export const classifyHostedRateLimitPressure = (
  error: unknown
): ProviderLanePressureFeedback | undefined => {
  const status = readNestedErrorValue(error, 'status')
  const category = readNestedErrorValue(error, 'category')
  const code = readNestedErrorValue(error, 'code')
  const messages: string[] = []
  const seen = new Set<unknown>()
  let current = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    if (current instanceof Error) messages.push(current.message)
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined
  }
  const message = messages.join(' ').toLowerCase()
  const classificationText = `${typeof category === 'string' ? category : ''} ${typeof code === 'string' ? code : ''} ${message}`.toLowerCase()
  if (/billing|payment required|insufficient (?:balance|credit)|quota[_\s-]*(?:exhaust|exceed|deplet)|exceed(?:ed|s|ing)? (?:your )?(?:current )?quota|quota[_\s-]*limit[_\s-]*(?:reached|exhaust)|check your plan|authentication|unauthorized|validation/.test(classificationText)) {
    return undefined
  }
  const explicitlyRateLimited = status === 429
    || (typeof category === 'string' && /rate.?limit|too.?many.?requests|concurrenc/i.test(category))
    || (typeof code === 'string' && /rate.?limit|too.?many.?requests|concurrenc/i.test(code))
    || /rate[-\s]?limit|too many requests|provider concurrency|concurrency limit/.test(message)
  if (!explicitlyRateLimited) return undefined
  const headers = readNestedErrorValue(error, 'headers')
  let retryAfterMs: number | undefined
  const rawRetryAfter = readHeader(headers, 'retry-after')
  if (rawRetryAfter !== undefined) {
    const seconds = Number(rawRetryAfter)
    if (Number.isFinite(seconds)) retryAfterMs = Math.max(0, seconds * 1_000)
    else {
      const atMs = Date.parse(rawRetryAfter)
      if (Number.isFinite(atMs)) retryAfterMs = Math.max(0, atMs - Date.now())
    }
  }
  return {
    reason: typeof category === 'string' ? category : 'rate-limit',
    ...(typeof status === 'number' ? { status } : {}),
    ...(typeof retryAfterMs === 'number' ? { retryAfterMs } : {})
  }
}
