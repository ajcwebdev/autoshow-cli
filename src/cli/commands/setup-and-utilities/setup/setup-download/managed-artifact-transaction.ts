import { constants } from 'node:fs'
import { link, lstat, mkdir, open, rename, rm, unlink } from 'node:fs/promises'
import { hostname } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { assertRuntimeContainedPath, RUNTIME_DIR } from '~/utils/runtime-paths'
import { isIgnoredManagedArtifactPath } from './managed-artifact-schema'

type TransactionPhase = 'prepared' | 'previous-moved' | 'candidate-promoted' | 'committed' | 'recovering' | 'recovered'
type ManagedToolTransaction = {
  schemaVersion: 1
  id: string
  phase: TransactionPhase
  ownerPid: number
  ownerHost: string
  hadPreviousInstall: boolean
  destination: string
  staging: string
  backup: string
  evidence: string
}

function transactionFailure(message: string, cause?: unknown): never {
  throw InfraError(message, { stage: 'setup:managed-artifact', retryable: false, ...(cause === undefined ? {} : { cause }) })
}

const containedTarget = (path: string): string => {
  if (isIgnoredManagedArtifactPath(path)) throw ValidationError('Managed tool destinations must name a managed package.', { stage: 'setup:managed-artifact' })
  const target = assertRuntimeContainedPath(path)
  if (target === resolve(RUNTIME_DIR)) throw ValidationError('A managed package cannot replace the runtime root.', { stage: 'setup:managed-artifact' })
  assertRuntimeContainedPath(dirname(target))
  return target
}

const present = async (path: string): Promise<boolean> => {
  containedTarget(path)
  try { await lstat(path); return true } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

const syncDirectory = async (path: string): Promise<void> => {
  assertRuntimeContainedPath(path)
  const handle = await open(path, 'r')
  try { await handle.sync() } finally { await handle.close() }
}

const renameContained = async (from: string, to: string): Promise<void> => {
  containedTarget(from)
  containedTarget(to)
  await rename(from, to)
  await syncDirectory(dirname(from))
  if (dirname(from) !== dirname(to)) await syncDirectory(dirname(to))
}

const removeContained = async (path: string): Promise<void> => {
  containedTarget(path)
  await rm(path, { recursive: true, force: true })
  await syncDirectory(dirname(path))
}

export const managedToolTransactionPath = (destination: string): string => {
  destination = containedTarget(destination)
  return containedTarget(join(dirname(destination), `.${basename(destination)}.transaction.json`))
}
const relativeRuntimePath = (path: string): string => relative(RUNTIME_DIR, containedTarget(path)).replaceAll('\\', '/')

const persistTransaction = async (path: string, transaction: ManagedToolTransaction, exclusive = false): Promise<void> => {
  containedTarget(path)
  const temporary = containedTarget(`${path}.pending-${crypto.randomUUID()}`)
  const handle = await open(temporary, 'wx', 0o600)
  try { await handle.writeFile(`${JSON.stringify(transaction)}\n`); await handle.sync() }
  finally { await handle.close() }
  try {
    containedTarget(path)
    containedTarget(temporary)
    if (exclusive) await link(temporary, path)
    else {
      const metadata = await lstat(path)
      if (!metadata.isFile() || metadata.isSymbolicLink()) transactionFailure('Managed installation transaction must be a regular file.')
      await rename(temporary, path)
    }
    await syncDirectory(dirname(path))
  } finally {
    containedTarget(temporary)
    await unlink(temporary).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error })
  }
}

const readTransaction = async (path: string, destination: string): Promise<ManagedToolTransaction | undefined> => {
  containedTarget(path)
  let handle
  try { handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error }
  try {
    const metadata = await handle.stat()
    if (!metadata.isFile() || metadata.size > 32 * 1024) transactionFailure('Managed installation transaction must be a bounded regular file.')
    const value: unknown = JSON.parse(await handle.readFile('utf8'))
    if (value === null || typeof value !== 'object' || Array.isArray(value)) transactionFailure('Managed installation transaction is invalid; existing evidence was preserved.')
    const record = value as Record<string, unknown>
    const fields = ['schemaVersion', 'id', 'phase', 'ownerPid', 'ownerHost', 'hadPreviousInstall', 'destination', 'staging', 'backup', 'evidence']
    if (Object.keys(record).some(key => !fields.includes(key)) || record['schemaVersion'] !== 1 || typeof record['id'] !== 'string' || !/^[a-f0-9-]{36}$/.test(record['id']) || typeof record['ownerPid'] !== 'number' || !Number.isSafeInteger(record['ownerPid']) || record['ownerPid'] <= 0 || typeof record['ownerHost'] !== 'string' || typeof record['hadPreviousInstall'] !== 'boolean' || !['prepared', 'previous-moved', 'candidate-promoted', 'committed', 'recovering', 'recovered'].includes(String(record['phase']))) transactionFailure('Managed installation transaction identity is invalid; existing evidence was preserved.')
    for (const key of ['destination', 'staging', 'backup', 'evidence']) {
      const entry = record[key]
      if (typeof entry !== 'string' || !entry || isAbsolute(entry) || entry.includes('\\') || entry.split('/').some(part => !part || part === '.' || part === '..') || isIgnoredManagedArtifactPath(entry)) transactionFailure('Managed installation transaction paths are invalid; existing evidence was preserved.')
      containedTarget(join(RUNTIME_DIR, entry))
    }
    const transaction = value as ManagedToolTransaction
    if (resolve(RUNTIME_DIR, transaction.destination) !== destination || resolve(RUNTIME_DIR, transaction.backup) !== `${destination}.backup-${transaction.id}` || resolve(RUNTIME_DIR, transaction.evidence) !== join(dirname(destination), `.${basename(destination)}.interrupted-${transaction.id}`) || transaction.staging === transaction.destination || transaction.staging === transaction.backup || transaction.staging === transaction.evidence) transactionFailure('Managed installation transaction does not match its destination; existing evidence was preserved.')
    return transaction
  } finally { await handle.close() }
}

const ownerIsAlive = (transaction: ManagedToolTransaction): boolean => {
  if (transaction.ownerHost !== hostname()) return true
  try { process.kill(transaction.ownerPid, 0); return true }
  catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH' }
}

const recoverTransaction = async (destination: string, allowCurrentOwner: boolean): Promise<void> => {
  destination = containedTarget(destination)
  const journal = managedToolTransactionPath(destination)
  const transaction = await readTransaction(journal, destination)
  if (!transaction) return
  if (transaction.ownerHost !== hostname() && transaction.phase !== 'committed') transactionFailure('Managed installation recovery cannot verify the owner on another host; preserve the transaction and confirm that the original setup has stopped before manual recovery.')
  if (transaction.ownerHost === hostname() && ownerIsAlive(transaction) && !(allowCurrentOwner && transaction.ownerPid === process.pid)) transactionFailure('A live process owns this managed installation transaction; retry after that setup finishes.')
  const staging = containedTarget(join(RUNTIME_DIR, transaction.staging))
  const backup = containedTarget(join(RUNTIME_DIR, transaction.backup))
  const evidence = containedTarget(join(RUNTIME_DIR, transaction.evidence))
  if (transaction.phase === 'committed') {
    if (!await present(destination)) transactionFailure('Committed managed installation is missing; transaction evidence was preserved.')
    if (await present(backup)) await removeContained(backup)
    containedTarget(journal)
    await unlink(journal)
    await syncDirectory(dirname(journal))
    return
  }
  const archive = containedTarget(join(dirname(destination), `.${basename(destination)}.transaction-${transaction.id}.interrupted.json`))
  if (transaction.phase !== 'recovered') {
    const hasBackup = await present(backup)
    const hasDestination = await present(destination)
    if (transaction.hadPreviousInstall && !hasBackup && (!hasDestination || !['prepared', 'recovering'].includes(transaction.phase))) transactionFailure('The previous managed installation cannot be recovered automatically; transaction evidence was preserved.')
    transaction.phase = 'recovering'
    await persistTransaction(journal, transaction)
    if (hasBackup) {
      if (hasDestination) {
        if (await present(evidence)) transactionFailure('Interrupted managed candidate evidence already exists; recovery stopped without replacing it.')
        await renameContained(destination, evidence)
      }
      await renameContained(backup, destination)
    } else if (!transaction.hadPreviousInstall && hasDestination) {
      if (await present(evidence)) transactionFailure('Interrupted managed candidate evidence already exists; recovery stopped without replacing it.')
      await renameContained(destination, evidence)
    }
    // The original staging path remains intact when it has not been promoted.
    // Its identity and the retained candidate path are preserved in this receipt.
    containedTarget(staging)
    transaction.phase = 'recovered'
    await persistTransaction(journal, transaction)
  }
  if (await present(archive)) transactionFailure('Interrupted managed transaction evidence already exists; recovery stopped without replacing it.')
  await renameContained(journal, archive)
}

export const recoverManagedToolDirectory = async (destination: string): Promise<void> => {
  await recoverTransaction(destination, false)
}

export const readManagedToolTransactionIssue = async (destination: string): Promise<string | undefined> => {
  try {
    destination = containedTarget(destination)
    const transaction = await readTransaction(managedToolTransactionPath(destination), destination)
    if (!transaction) return undefined
    return `Managed installation has an unfinished ${transaction.phase} transaction; run setup to recover or finalize the installation before using it.`
  } catch (error) {
    return `Managed installation transaction could not be inspected: ${error instanceof Error ? error.message : String(error)}`
  }
}

export const createManagedToolStagingDirectory = async (toolDir: string): Promise<string> => {
  toolDir = containedTarget(toolDir)
  const parent = assertRuntimeContainedPath(dirname(toolDir))
  await mkdir(parent, { recursive: true })
  assertRuntimeContainedPath(parent)
  await recoverManagedToolDirectory(toolDir)
  const stagingDir = containedTarget(join(parent, `.${basename(toolDir)}.staging-${crypto.randomUUID()}`))
  await mkdir(stagingDir, { recursive: false })
  containedTarget(stagingDir)
  await syncDirectory(parent)
  return stagingDir
}

export const promoteManagedToolDirectory = async (options: {
  stagingDir: string
  destinationDir: string
  validateStaging: (path: string) => Promise<void>
  activate?: () => Promise<void>
  rollbackActivation?: (hadPreviousInstall: boolean) => Promise<void>
  checkpoint?: (phase: 'journal-prepared' | 'previous-renamed' | 'candidate-renamed' | 'committed') => Promise<void>
}): Promise<void> => {
  const destination = containedTarget(options.destinationDir)
  const staging = containedTarget(options.stagingDir)
  if (destination === staging || staging.startsWith(`${destination}/`) || destination.startsWith(`${staging}/`)) transactionFailure('Managed staging and destination directories must be distinct, non-nested paths.')
  await mkdir(assertRuntimeContainedPath(dirname(destination)), { recursive: true })
  assertRuntimeContainedPath(dirname(destination))
  await recoverManagedToolDirectory(destination)
  await options.validateStaging(staging)
  containedTarget(staging)
  containedTarget(destination)
  const id = crypto.randomUUID()
  const backup = containedTarget(`${destination}.backup-${id}`)
  const journal = managedToolTransactionPath(destination)
  const transaction: ManagedToolTransaction = {
    schemaVersion: 1, id, phase: 'prepared', ownerPid: process.pid, ownerHost: hostname(), hadPreviousInstall: await present(destination),
    destination: relativeRuntimePath(destination), staging: relativeRuntimePath(staging), backup: relativeRuntimePath(backup),
    evidence: relativeRuntimePath(join(dirname(destination), `.${basename(destination)}.interrupted-${id}`))
  }
  await persistTransaction(journal, transaction, true)
  try {
    await options.checkpoint?.('journal-prepared')
    if (transaction.hadPreviousInstall) {
      await renameContained(destination, backup)
      await options.checkpoint?.('previous-renamed')
      transaction.phase = 'previous-moved'
      await persistTransaction(journal, transaction)
    }
    await renameContained(staging, destination)
    await options.checkpoint?.('candidate-renamed')
    transaction.phase = 'candidate-promoted'
    await persistTransaction(journal, transaction)
    await options.activate?.()
    containedTarget(destination)
    await options.validateStaging(destination)
    transaction.phase = 'committed'
    await persistTransaction(journal, transaction)
    await options.checkpoint?.('committed')
  } catch (error) {
    const failures: unknown[] = [error]
    try { await recoverTransaction(destination, true) } catch (recoveryError) { failures.push(recoveryError) }
    try { await options.rollbackActivation?.(transaction.hadPreviousInstall) } catch (rollbackError) { failures.push(rollbackError) }
    if (failures.length > 1) throw new AggregateError(failures, `Managed promotion failed: ${error instanceof Error ? error.message : String(error)}; recovery or activation rollback also failed.`, { cause: error })
    throw error
  }
  // A durable committed receipt permits safe cleanup after interruption.
  await recoverTransaction(destination, true)
}
