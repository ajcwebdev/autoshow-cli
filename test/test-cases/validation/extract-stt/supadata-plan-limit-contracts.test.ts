import { describe, expect, test } from 'bun:test'
import { classifyFetchRetry } from '~/utils/retries'
import { isSupadataPlanLimitExhausted } from '~/utils/supadata-plan-limit'
import { toSupadataHttpError } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-supadata/supadata-utils'

const response = (status: number): Response => new Response(null, { status })

describe('Supadata plan-limit contracts', () => {
  test('detects plan exhaustion in every documented error field shape', () => {
    expect(isSupadataPlanLimitExhausted({ error: 'limit-exceeded' })).toBe(true)
    expect(isSupadataPlanLimitExhausted({ message: 'Limit Exceeded' })).toBe(true)
    expect(isSupadataPlanLimitExhausted({ details: 'You have exceeded the limit for your plan' })).toBe(true)
    expect(isSupadataPlanLimitExhausted({ error: { message: 'quota exceeded' } })).toBe(true)
    expect(isSupadataPlanLimitExhausted('Limit Exceeded')).toBe(true)
    expect(isSupadataPlanLimitExhausted(null, 'Limit Exceeded')).toBe(true)
  })

  test('leaves burst throttling and unrelated failures retryable', () => {
    expect(isSupadataPlanLimitExhausted({ message: 'Too many requests, slow down' })).toBe(false)
    expect(isSupadataPlanLimitExhausted({ error: 'unauthorized', message: 'Unauthorized' })).toBe(false)
    expect(isSupadataPlanLimitExhausted({ message: 'Transcript unavailable' })).toBe(false)
    expect(isSupadataPlanLimitExhausted(undefined)).toBe(false)
  })

  // The retry storm this prevents: without the flag, a quota-exhausted 429 was retried at every
  // layer, spending more denied requests and stalling the run for minutes before failing anyway.
  test('a plan-limit 429 stops retrying while a burst 429 keeps retrying', () => {
    const planLimit = toSupadataHttpError(
      'create',
      'runtime_http_create_retriable',
      response(429),
      { error: 'limit-exceeded', message: 'Limit Exceeded' }
    )
    expect(planLimit.message).toBe('Supadata request failed (429): Limit Exceeded')
    expect((planLimit as { retryable?: unknown }).retryable).toBe(false)
    expect(classifyFetchRetry(planLimit, 'runtime_http_create_retriable').shouldRetry).toBe(false)

    const burst = toSupadataHttpError(
      'create',
      'runtime_http_create_retriable',
      response(429),
      { message: 'Too many requests, slow down' }
    )
    expect((burst as { retryable?: unknown }).retryable).toBeUndefined()
    expect(classifyFetchRetry(burst, 'runtime_http_create_retriable').shouldRetry).toBe(true)
  })

  test('plan-limit detection also applies to the poll stage', () => {
    const polled = toSupadataHttpError(
      'poll',
      'runtime_http_read',
      response(429),
      { error: 'limit-exceeded' }
    )
    expect(classifyFetchRetry(polled, 'runtime_http_read').shouldRetry).toBe(false)
  })
})
