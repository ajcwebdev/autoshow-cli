import { test } from 'bun:test'
import { E2E_TEST_TIMEOUT_MS } from './timeouts'
import type { BudgetKeyInput } from '~/types'

export { E2E_TEST_TIMEOUT_MS } from './timeouts'

const parseBudgetKeySet = (environmentKey: string): Set<string> | null => {
  const raw = process.env[environmentKey]
  if (raw === undefined) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return new Set()
  }

  if (!Array.isArray(parsed)) {
    return new Set()
  }

  const keys = parsed.filter((value): value is string => typeof value === 'string' && value.length > 0)
  return new Set(keys)
}

const normalizeBudgetKeys = (budgetKey: BudgetKeyInput): readonly string[] => {
  return typeof budgetKey === 'string' ? [budgetKey] : budgetKey
}

export const shouldSkipBudgetKeys = (budgetKey: BudgetKeyInput): boolean => {
  const skipKeys = parseBudgetKeySet('AUTOSHOW_TEST_BUDGET_SKIP_KEYS') ?? new Set()
  return normalizeBudgetKeys(budgetKey).some((key) => skipKeys.has(key))
}

const findUnevaluatedBudgetKeys = (budgetKey: BudgetKeyInput): string[] => {
  const evaluatedKeys = parseBudgetKeySet('AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS')
  if (evaluatedKeys === null) {
    return []
  }

  return normalizeBudgetKeys(budgetKey).filter(key => !evaluatedKeys.has(key))
}

const registerBudgetedTest = (
  budgetKey: BudgetKeyInput,
  name: string,
  fn: () => void | Promise<void>,
  timeoutMs: number
): void => {
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
  test(name, fn, timeoutMs)
}

export const budgetedTest = (
  budgetKey: BudgetKeyInput,
  name: string,
  fn: () => void | Promise<void>,
  timeoutMs: number = E2E_TEST_TIMEOUT_MS
): void => {
  registerBudgetedTest(budgetKey, name, fn, timeoutMs)
}
