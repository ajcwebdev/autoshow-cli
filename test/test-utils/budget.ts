import { test } from 'bun:test'
import { E2E_TEST_TIMEOUT_MS } from './timeouts'
import type { BudgetKeyInput } from '~/types'

export { E2E_TEST_TIMEOUT_MS, LONG_E2E_TEST_TIMEOUT_MS } from './timeouts'

const parseBudgetKeySet = (environmentKey: string): Set<string> | null => {
  const raw = process.env[environmentKey]
  if (raw === undefined) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!Array.isArray(parsed)) {
    return null
  }

  if (!parsed.every((value): value is string => typeof value === 'string' && value.trim().length > 0)) return null
  const keys: string[] = parsed
  return new Set(keys)
}

const normalizeBudgetKeys = (budgetKey: BudgetKeyInput): readonly string[] => {
  return typeof budgetKey === 'string' ? [budgetKey] : budgetKey
}

export const shouldSkipBudgetKeys = (budgetKey: BudgetKeyInput): boolean => {
  const skipKeys = parseBudgetKeySet('AUTOSHOW_TEST_BUDGET_SKIP_KEYS')
  if (skipKeys === null) return true
  return normalizeBudgetKeys(budgetKey).some((key) => skipKeys.has(key))
}

export const isConcurrentBudgetedTestsEnabled = (): boolean =>
  process.env['AUTOSHOW_TEST_CONCURRENT'] === '1'

export const findUnevaluatedBudgetKeys = (budgetKey: BudgetKeyInput): string[] => {
  const evaluatedKeys = parseBudgetKeySet('AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS')
  if (evaluatedKeys === null) {
    return [...normalizeBudgetKeys(budgetKey)]
  }

  return normalizeBudgetKeys(budgetKey).filter(key => !evaluatedKeys.has(key))
}

const registerBudgetedTest = (
  budgetKey: BudgetKeyInput,
  name: string,
  fn: () => void | Promise<void>,
  timeoutMs: number
): void => {
  const skipKeys = parseBudgetKeySet('AUTOSHOW_TEST_BUDGET_SKIP_KEYS')
  const evaluatedKeys = parseBudgetKeySet('AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS')
  if (skipKeys === null || evaluatedKeys === null || [...skipKeys].some(key => !evaluatedKeys.has(key))) {
    test(name, () => { throw new Error('Budget preflight evidence is missing or invalid; use the runner with --budget before live execution.') }, timeoutMs)
    return
  }
  const unevaluatedKeys = findUnevaluatedBudgetKeys(budgetKey)
  if (unevaluatedKeys.length > 0) {
    test(name, () => {
      throw new Error(`Budget preflight did not evaluate test key(s): ${unevaluatedKeys.join(', ')}`)
    }, timeoutMs)
    return
  }

  if (shouldSkipBudgetKeys(budgetKey)) {
    test.skip(name, fn)
    return
  }
  const register = isConcurrentBudgetedTestsEnabled() ? test.concurrent : test
  register(name, fn, timeoutMs)
}

export const budgetedTest = (
  budgetKey: BudgetKeyInput,
  name: string,
  fn: () => void | Promise<void>,
  timeoutMs: number = E2E_TEST_TIMEOUT_MS
): void => {
  registerBudgetedTest(budgetKey, name, fn, timeoutMs)
}
