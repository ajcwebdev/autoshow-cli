import { readSpendingLedger, reconcileSpendingReservation, spendingHeldCents } from '~/utils/spending-ledger'
import { UsageError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'

const USAGE = 'usage: bun src/tools/spending-ledger-command.ts status <ledger> [--id <reservation>] | reconcile <ledger> --budget-cents <integer> --id <reservation> --charged-cents <integer> --evidence <billing explanation> --confirm-stopped'

const integer = (value: string | undefined, key: string, minimum: number): number => {
  if (!value || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < minimum) throw UsageError(`${key} must be a safe integer at least ${minimum}. ${USAGE}`)
  return Number(value)
}

export const runSpendingLedgerCommand = async (args: string[]): Promise<Record<string, unknown>> => {
  const [command, path, ...rest] = args
  if (!path || !['status', 'reconcile'].includes(command ?? '')) throw UsageError(USAGE)
  const options = new Map<string, string>()
  const allowed = command === 'status' ? ['--id'] : ['--budget-cents', '--id', '--charged-cents', '--evidence', '--confirm-stopped']
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i]
    if (!key || !allowed.includes(key) || options.has(key)) throw UsageError(USAGE)
    if (key === '--confirm-stopped') { options.set(key, 'true'); continue }
    const value = rest[++i]
    if (!value || value.startsWith('--')) throw UsageError(USAGE)
    options.set(key, value)
  }
  if (command === 'reconcile') {
    const id = options.get('--id'), evidence = options.get('--evidence')
    if (!id || !evidence?.trim()) throw UsageError(USAGE)
    await reconcileSpendingReservation({ path, budgetCents: integer(options.get('--budget-cents'), '--budget-cents', 1), id,
      chargedCents: integer(options.get('--charged-cents'), '--charged-cents', 0), evidence, confirmStopped: options.has('--confirm-stopped') })
  }
  const ledger = await readSpendingLedger(path)
  const id = options.get('--id')
  const receipts = id ? ledger.receipts.filter(receipt => receipt.id === id) : ledger.receipts.slice(-20)
  if (id && !receipts.length) throw UsageError('Reservation was not found in the selected ledger')
  return { schemaVersion: ledger.schemaVersion, budgetCents: ledger.budgetCents, heldCents: spendingHeldCents(ledger),
    receiptCount: ledger.receipts.length, omittedReceiptCount: ledger.receipts.length - receipts.length,
    ...(ledger.fatal ? { fatal: ledger.fatal } : {}), receipts }
}

if (import.meta.main) {
  try { writeCommandPayload(`${JSON.stringify(await runSpendingLedgerCommand(Bun.argv.slice(2)), null, 2)}\n`) }
  catch (error) { writeCommandPayload(`${error instanceof Error ? error.message : String(error)}\n`, 'stderr'); process.exitCode = 1 }
}
