import { describe, expect, test } from 'bun:test'
import { NETWORK_FAILURE_SPELLINGS, RETRYABLE_STATUS_CODES } from '~/utils/retries'
import { isSupadataPlanLimitExhausted } from '~/utils/supadata-plan-limit'
import {
  hasTransientRetryExhaustion,
  isNetworkFailureOutput,
  isSupadataPlanLimitFailure,
  isTransientMinimaxTtsFailure,
  RATE_LIMIT_PATTERN
} from '../../../test-utils/provider-failure-classifiers'

describe('transient predicate contracts', () => {
  test('every network spelling production retries is recognised by the suite', () => {
    for (const spelling of NETWORK_FAILURE_SPELLINGS) {
      expect(isNetworkFailureOutput(`Provider request failed: ${spelling}`)).toBe(true)
    }

    expect(isTransientMinimaxTtsFailure('MiniMax TTS: Socket connection was closed unexpectedly')).toBe(true)
  })

  test('the MiniMax predicate does not re-run an ambiguous paid create', () => {
    for (const status of RETRYABLE_STATUS_CODES.filter((code) => code !== 425 && code !== 429)) {
      expect(isTransientMinimaxTtsFailure(`MiniMax TTS task creation failed (${status})`)).toBe(false)
    }

    expect(isTransientMinimaxTtsFailure('MiniMax TTS task creation failed (429)')).toBe(true)
    expect(isTransientMinimaxTtsFailure('MiniMax TTS task query failed (503)')).toBe(true)
    expect(isTransientMinimaxTtsFailure('MiniMax TTS download failed (502)')).toBe(true)
  })

  test('a retry-exhaustion banner counts only when its stop reason is transient', () => {
    expect(hasTransientRetryExhaustion('op failed after 4/4 attempts (max attempts reached, 10ms elapsed)')).toBe(true)
    expect(hasTransientRetryExhaustion('op failed after 2/4 attempts (non-retryable status 400, 10ms elapsed)')).toBe(false)
    expect(hasTransientRetryExhaustion('op failed after 1/2 attempts (error marked non-retryable, 10ms elapsed)')).toBe(false)
    expect(hasTransientRetryExhaustion('op failed after 1/2 attempts (unexpected status 418, 10ms elapsed)')).toBe(false)
    expect(hasTransientRetryExhaustion('no banner here')).toBe(false)
  })

  test('rate-limit evidence is recognised wherever it appears', () => {
    expect(RATE_LIMIT_PATTERN.test('retryable status 429')).toBe(true)
    expect(RATE_LIMIT_PATTERN.test('Supadata transcript failed (429)')).toBe(true)
    expect(RATE_LIMIT_PATTERN.test('provider returned 503')).toBe(false)
  })

  test('the Supadata plan-limit predicate agrees with production', () => {
    const planLimitBodies = ['Limit Exceeded', 'quota exhausted', 'You have exceeded your plan limit']

    for (const body of planLimitBodies) {
      expect(isSupadataPlanLimitExhausted({ error: body })).toBe(true)
      expect(isSupadataPlanLimitFailure(`Supadata transcript failed (429): ${body}`)).toBe(true)
    }

    expect(isSupadataPlanLimitExhausted({ error: 'Too Many Requests' })).toBe(false)
    expect(isSupadataPlanLimitFailure('Supadata transcript failed (429): Too Many Requests')).toBe(false)
  })
})
