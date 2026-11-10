import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, readFile, realpath, rename, rm, unlink } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { InfraError, UsageError } from '~/utils/error-handler'

export type SpendingReceipt = {
  id: string
  operation: string
  createdAt: string
  updatedAt: string
  reservedCents: number
  chargedCents: number
  status: 'reserved' | 'settled' | 'rejected' | 'uncertain'
  reconciliationEvidence?: string
}

export type SpendingLedger = {
  schemaVersion: 1
  budgetCents: number
  receipts: SpendingReceipt[]
  fatal?: string
}

type LedgerOptions = { path: string, budgetCents: number, lockTimeoutMs?: number }
export type SpendingReservationOptions = LedgerOptions & { reserveCents: number, operation: string, id?: string }
export type SpendingReservation = {
  id: string
  settle: (chargedCents: number) => Promise<void>
  retainUncertain: () => Promise<void>
  releaseRejected: () => Promise<void>
}

const money = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const errno = (error: unknown): string | undefined => (error as NodeJS.ErrnoException)?.code
const fail = (message: string): never => { throw UsageError(`Spending ledger: ${message}`, { stage: 'budget:ledger' }) }
const shortText = (value: unknown, maximum: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= maximum && !/[\u0000-\u001f]/.test(value)

export const spendingHeldCents = (ledger: SpendingLedger): number => ledger.receipts.reduce((sum, receipt) => sum + (
  receipt.status === 'reserved' || receipt.status === 'uncertain' ? receipt.reservedCents : receipt.chargedCents
), 0)

const validate = (value: unknown): SpendingLedger => {
  if (!object(value) || value['schemaVersion'] !== 1 || !money(value['budgetCents']) || !Array.isArray(value['receipts'])) fail('invalid schema or monetary accounting')
  const ledger = value as SpendingLedger
  if (ledger.fatal !== undefined && !shortText(ledger.fatal, 2000)) fail('invalid fatal state')
  const ids = new Set<string>()
  for (const receipt of ledger.receipts) {
    if (!object(receipt) || !shortText(receipt.id, 256) || !shortText(receipt.operation, 512)
      || !shortText(receipt.createdAt, 64) || !Number.isFinite(Date.parse(receipt.createdAt))
      || !shortText(receipt.updatedAt, 64) || !Number.isFinite(Date.parse(receipt.updatedAt))
      || !money(receipt.reservedCents) || !money(receipt.chargedCents)
      || !['reserved', 'settled', 'rejected', 'uncertain'].includes(receipt.status)
      || ids.has(receipt.id)) fail('invalid or repeated receipt')
    if (receipt.status !== 'settled' && receipt.chargedCents !== 0) fail('unsettled receipt contains a charge')
    if (receipt.reconciliationEvidence !== undefined && !shortText(receipt.reconciliationEvidence, 2000)) fail('invalid reconciliation evidence')
    if (receipt.chargedCents > receipt.reservedCents && !ledger.fatal) fail('unrecorded reservation breach')
    ids.add(receipt.id)
  }
  const held = spendingHeldCents(ledger)
  if (!money(held) || held > ledger.budgetCents && !ledger.fatal) fail('invalid or over-budget accounting')
  return ledger
}

const ledgerPath = async (path: string): Promise<string> => {
  if (!path.trim() || path.includes('\0')) fail('a ledger file path is required')
  const requested = resolve(path)
  // Canonicalizing the parent gives aliases the same lock, without following a ledger symlink.
  return join(await realpath(dirname(requested)), basename(requested))
}

const readLedger = async (path: string, budgetCents?: number): Promise<SpendingLedger> => {
  let file
  try { file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK) }
  catch (error) {
    if (errno(error) === 'ENOENT' && budgetCents !== undefined) return { schemaVersion: 1, budgetCents, receipts: [] }
    throw InfraError('Spending ledger cannot be read as a regular file', { stage: 'budget:ledger', cause: error })
  }
  try {
    const stat = await file.stat()
    if (!stat.isFile() || stat.size > 16 * 1024 * 1024) fail('ledger must be a bounded regular file')
    let data: unknown
    try { data = JSON.parse(await file.readFile('utf8')) } catch { fail('ledger JSON is invalid; existing evidence was preserved') }
    const ledger = validate(data)
    if (budgetCents !== undefined && ledger.budgetCents !== budgetCents) fail('existing budget differs; never reset a ledger to resume work')
    return ledger
  } finally { await file.close() }
}

export const readSpendingLedger = async (path: string): Promise<SpendingLedger> => await readLedger(await ledgerPath(path))

const persist = async (path: string, ledger: SpendingLedger): Promise<void> => {
  const temporary = `${path}.${randomUUID()}.tmp`
  const file = await open(temporary, 'wx', 0o600)
  try {
    await file.writeFile(`${JSON.stringify(ledger, null, 2)}\n`)
    await file.sync()
  } catch (error) { await unlink(temporary).catch(() => undefined); throw error }
  finally { await file.close() }
  try {
    try { if ((await lstat(path)).isSymbolicLink()) fail('ledger symlinks are forbidden') } catch (error) { if (errno(error) !== 'ENOENT') throw error }
    await rename(temporary, path)
    const parent = await open(dirname(path), 'r')
    try { await parent.sync() } finally { await parent.close() }
  } finally { await unlink(temporary).catch(() => undefined) }
}

const locked = async <T>(options: LedgerOptions, action: (ledger: SpendingLedger) => T): Promise<T> => {
  if (!money(options.budgetCents)) fail('budgetCents must be nonnegative safe-integer cents')
  const timeout = options.lockTimeoutMs ?? 5000
  if (!Number.isSafeInteger(timeout) || timeout < 0 || timeout > 60_000) fail('invalid lock timeout')
  const path = await ledgerPath(options.path), lock = `${path}.lock`, token = randomUUID(), deadline = Date.now() + timeout
  while (true) {
    try { await mkdir(lock, { mode: 0o700 }); break }
    catch (error) {
      if (errno(error) !== 'EEXIST') throw error
      let stat
      try { stat = await lstat(lock) } catch (error) { if (errno(error) === 'ENOENT') continue; throw error }
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail('lock must be a real directory')
      if (Date.now() >= deadline) throw InfraError('Spending ledger lock is busy; no stale lock or reservation was removed', { stage: 'budget:lock' })
      await new Promise(resolveWait => setTimeout(resolveWait, 10))
    }
  }
  const owner = join(lock, 'owner')
  try {
    const handle = await open(owner, 'wx', 0o600)
    try { await handle.writeFile(token) } finally { await handle.close() }
    const ledger = await readLedger(path, options.budgetCents)
    const result = action(ledger)
    if (await readFile(owner, 'utf8') !== token) throw InfraError('Spending ledger lock ownership changed; refusing write', { stage: 'budget:lock' })
    await persist(path, ledger)
    return result
  } finally {
    // Never remove another owner's lock, including one changed while an operation was running.
    if (await readFile(owner, 'utf8').catch(() => '') === token) await rm(lock, { recursive: true })
  }
}

const receiptById = (ledger: SpendingLedger, id: string): SpendingReceipt => ledger.receipts.find(receipt => receipt.id === id) ?? fail('reservation does not exist')

const settleReceipt = (ledger: SpendingLedger, receipt: SpendingReceipt, chargedCents: number): boolean => {
  if (!money(chargedCents)) fail('chargedCents must be nonnegative safe-integer cents')
  receipt.status = 'settled'
  receipt.chargedCents = chargedCents
  receipt.updatedAt = new Date().toISOString()
  if (chargedCents > receipt.reservedCents || spendingHeldCents(ledger) > ledger.budgetCents) {
    ledger.fatal = 'A reconciled charge exceeded its reservation; no further admission is permitted.'
    return true
  }
  return false
}

export const reserveSpendingBudget = async (options: SpendingReservationOptions): Promise<SpendingReservation> => {
  if (!money(options.reserveCents)) fail('reserveCents must be nonnegative safe-integer cents')
  if (!shortText(options.operation, 512)) fail('a bounded operation name is required')
  const id = options.id ?? randomUUID()
  if (!shortText(id, 256)) fail('invalid reservation id')
  await locked(options, ledger => {
    if (ledger.fatal) fail(ledger.fatal)
    if (ledger.receipts.some(receipt => receipt.id === id)) fail('reservation id already exists; reconcile existing work explicitly')
    if (options.reserveCents > ledger.budgetCents - spendingHeldCents(ledger)) fail('shared budget cannot admit another reservation')
    const now = new Date().toISOString()
    ledger.receipts.push({ id, operation: options.operation, createdAt: now, updatedAt: now, reservedCents: options.reserveCents, chargedCents: 0, status: 'reserved' })
  })
  return {
    id,
    settle: async chargedCents => {
      const breach = await locked(options, ledger => {
        const receipt = receiptById(ledger, id)
        if (receipt.status === 'settled' && receipt.chargedCents === chargedCents) return false
        if (receipt.status !== 'reserved') fail('only an active reservation can settle; uncertain work requires explicit reconciliation evidence')
        return settleReceipt(ledger, receipt, chargedCents)
      })
      if (breach) fail('charge exceeded its reservation; breach was recorded and further admission is blocked')
    },
    retainUncertain: async () => await locked(options, ledger => {
      const receipt = receiptById(ledger, id)
      if (receipt.status === 'uncertain') return
      if (receipt.status !== 'reserved') fail('settled or rejected work cannot become uncertain')
      receipt.status = 'uncertain'; receipt.updatedAt = new Date().toISOString()
    }),
    releaseRejected: async () => await locked(options, ledger => {
      const receipt = receiptById(ledger, id)
      if (receipt.status === 'rejected') return
      if (receipt.status !== 'reserved') fail('only a never-dispatched reservation can be released without reconciliation')
      receipt.status = 'rejected'; receipt.updatedAt = new Date().toISOString()
    })
  }
}

export const reconcileSpendingReservation = async (options: LedgerOptions & { id: string, chargedCents: number, evidence: string, confirmStopped: boolean }): Promise<void> => {
  if (!shortText(options.evidence, 2000)) fail('explicit reconciliation evidence is required')
  if (options.confirmStopped !== true) fail('confirm all participating processes are stopped and provider requests are resolved before reconciliation')
  const breach = await locked(options, ledger => {
    const receipt = receiptById(ledger, options.id)
    if (!['reserved', 'uncertain'].includes(receipt.status)) fail('only an outstanding hold can be reconciled')
    receipt.reconciliationEvidence = options.evidence.trim()
    return settleReceipt(ledger, receipt, options.chargedCents)
  })
  if (breach) fail('reconciled charge exceeded its reservation; breach was recorded')
}
