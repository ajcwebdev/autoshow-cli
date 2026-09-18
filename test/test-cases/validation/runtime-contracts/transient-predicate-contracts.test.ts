import { describe, expect, test } from 'bun:test'
import { NETWORK_FAILURE_SPELLINGS } from '~/utils/retries'
import { isSupadataPlanLimitExhausted } from '~/utils/supadata-plan-limit'
import {
  hasTransientRetryExhaustion,
  isNetworkFailureOutput,
  isSupadataPlanLimitFailure,
  isTransientPressureOutput,
  RATE_LIMIT_PATTERN
} from '../../../test-utils/provider-failure-classifiers'

describe('transient predicate contracts', () => {
  test('every network spelling production retries is recognised by the suite', () => {
    for (const spelling of NETWORK_FAILURE_SPELLINGS) {
      expect(isNetworkFailureOutput(`Provider request failed: ${spelling}`)).toBe(true)
    }
  })

  test('a retry-exhaustion banner counts only when its stop reason is transient', () => {
    expect(hasTransientRetryExhaustion('op failed after 4/4 attempts (max attempts reached, 10ms elapsed)')).toBe(true)
    expect(hasTransientRetryExhaustion('op failed after 2/4 attempts (non-retryable status 400, 10ms elapsed)')).toBe(false)
    expect(hasTransientRetryExhaustion('op failed after 1/2 attempts (error marked non-retryable, 10ms elapsed)')).toBe(false)
    expect(hasTransientRetryExhaustion('op failed after 1/2 attempts (error is explicitly non-retryable, 10ms elapsed)')).toBe(false)
    expect(hasTransientRetryExhaustion('op failed after 1/2 attempts (unexpected status 418, 10ms elapsed)')).toBe(false)
    expect(hasTransientRetryExhaustion('no banner here')).toBe(false)
  })

  test('501/505 and explicit non-retryable banners are not transient pressure', () => {
    expect(isTransientPressureOutput('provider failed (501)')).toBe(false)
    expect(isTransientPressureOutput('provider failed (505)')).toBe(false)
    expect(isTransientPressureOutput('provider failed (503)')).toBe(true)
    expect(isTransientPressureOutput('retry_exhausted: error marked non-retryable')).toBe(false)
    expect(isTransientPressureOutput('operation failed after 2/2 attempts (error is explicitly non-retryable, 1ms elapsed)')).toBe(false)
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
