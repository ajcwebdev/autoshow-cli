import { AsyncLocalStorage } from 'node:async_hooks'
import { resolve } from 'node:path'
import { UsageError } from '~/utils/error-handler'
import { reserveSpendingBudget } from '~/utils/spending-ledger'

const KEYS = ['AUTOSHOW_BUDGET_LEDGER', 'AUTOSHOW_BUDGET_CENTS', 'AUTOSHOW_BUDGET_RESERVE_CENTS'] as const
const SUPPORTED_COMMANDS = new Set(['write', 'extract', 'download', 'tts', 'image', 'video', 'music'])
type RuntimeBudget = { reserveCents: number; preflightAccepted: boolean }
const activeBudget = new AsyncLocalStorage<RuntimeBudget>()

const positiveCents = (value: string | undefined, name: string): number => {
  if (!value || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw UsageError(`${name} must be a positive safe integer number of cents`, { stage: 'budget:configuration' })
  }
  return Number(value)
}

export const resolveRuntimeBudgetMaxCents = (configured: number | undefined): number | undefined => {
  const budget = activeBudget.getStore()
  return budget ? Math.min(configured ?? budget.reserveCents, budget.reserveCents) : configured
}

/** Reservations cannot be bypassed by --allow-over-budget or a partially priced batch. */
export const assertRuntimeBudgetEstimate = (totalCents: number, skippedTargets = 0): void => {
  const budget = activeBudget.getStore()
  if (!budget) return
  if (skippedTargets > 0 || !Number.isFinite(totalCents) || totalCents < 0 || totalCents > budget.reserveCents) {
    throw UsageError('The complete command estimate must fit its shared budget reservation; skipped or unknown prices cannot dispatch', {
      stage: 'budget:preflight', metadata: { estimatedCents: totalCents, reserveCents: budget.reserveCents, skippedTargets }
    })
  }
  budget.preflightAccepted = true
}

export const assertRuntimeBudgetDispatch = (): void => {
  const budget = activeBudget.getStore()
  if (budget && !budget.preflightAccepted) {
    throw UsageError('A complete accepted price preflight is required before budgeted provider dispatch', { stage: 'budget:dispatch' })
  }
}

/** Command-admission accounting: success consumes the declared allocation, failures retain it. */
export const withRuntimeSpendingBudget = async <T>(
  command: string,
  flags: Readonly<Record<string, unknown>>,
  execute: () => Promise<T>,
  environment: NodeJS.ProcessEnv = process.env
): Promise<T> => {
  if (flags['require-shared-budget'] !== true && !KEYS.some(key => environment[key] !== undefined)) return await execute()
  const path = environment['AUTOSHOW_BUDGET_LEDGER']?.trim()
  if (!path || path.includes('\0')) throw UsageError('AUTOSHOW_BUDGET_LEDGER must name a ledger file', { stage: 'budget:configuration' })
  const budgetCents = positiveCents(environment['AUTOSHOW_BUDGET_CENTS'], 'AUTOSHOW_BUDGET_CENTS')
  const reserveCents = positiveCents(environment['AUTOSHOW_BUDGET_RESERVE_CENTS'], 'AUTOSHOW_BUDGET_RESERVE_CENTS')
  if (reserveCents > budgetCents) throw UsageError('Command reservation exceeds the shared budget ceiling', { stage: 'budget:configuration' })
  if (flags['price'] === true) return await execute()
  if (!SUPPORTED_COMMANDS.has(command.split(' ', 1)[0] ?? '')) {
    throw UsageError(`Shared runtime budgeting does not support ${command}; refusing execution before dispatch`, { stage: 'budget:configuration' })
  }
  const reservation = await reserveSpendingBudget({ path: resolve(path), budgetCents, reserveCents, operation: command })
  let result: T
  try {
    result = await activeBudget.run({ reserveCents, preflightAccepted: false }, execute)
  } catch (error) {
    await reservation.retainUncertain()
    throw error
  }
  // Booking the full allocation avoids presenting estimates as reconciled provider invoices.
  await reservation.settle(reserveCents)
  return result
}
