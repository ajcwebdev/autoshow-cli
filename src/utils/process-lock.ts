import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir, hostname } from 'node:os'
import { join } from 'node:path'
import type { ActiveProcessLockOwner, HeartbeatHealth, ProcessLockDirIdentity, ProcessLockOptions, ProcessLockOwner, ProcessLockOwnerReadResult } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { InfraError } from '~/utils/error-handler'

const DEFAULT_LOCK_STALE_MS = 60_000
const DEFAULT_LOCK_WAIT_TIMEOUT_MS = 2 * 60 * 60 * 1000
const DEFAULT_LOCK_WAIT_MS = 100
const DEFAULT_LOCK_HEARTBEAT_MS = 5_000
const LIVE_OWNER_STALE_MULTIPLIER = 10
const LOCK_OWNER_FILE = 'owner.json'
const CURRENT_HOSTNAME = hostname()

const getErrorCode = (error: unknown): string | undefined =>
  error instanceof Error && 'code' in error ? (error as Error & { code?: string }).code : undefined

const safeErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const resolvePositiveInteger = (
  optionValue: number | undefined,
  fallback: number
): number => {
  if (typeof optionValue === 'number' && Number.isFinite(optionValue) && optionValue > 0) {
    return Math.floor(optionValue)
  }
  return fallback
}

const sanitizeLockName = (lockName: string): string => {
  const sanitized = lockName
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120)

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return 'process-lock'
  }

  return sanitized
}

const getDefaultProcessStateDir = (): string =>
  join(homedir(), '.cache', 'autoshow-cli')

export const resolveProcessLockRoot = (options: ProcessLockOptions = {}): string =>
  options.lockRoot ?? join(getDefaultProcessStateDir(), 'process-locks')

const getLockOwnerPath = (lockDir: string): string => join(lockDir, LOCK_OWNER_FILE)

const readProcessLockOwnerState = async (lockDir: string): Promise<ProcessLockOwnerReadResult> => {
  const ownerPath = getLockOwnerPath(lockDir)
  try {
    const parsed = JSON.parse(await readFile(ownerPath, 'utf-8')) as Record<string, unknown>
    return {
      owner: {
      ...(typeof parsed['ownerId'] === 'string' ? { ownerId: parsed['ownerId'] } : {}),
      ...(typeof parsed['lockName'] === 'string' ? { lockName: parsed['lockName'] } : {}),
      ...(typeof parsed['pid'] === 'number' ? { pid: parsed['pid'] } : {}),
      ...(typeof parsed['hostname'] === 'string' ? { hostname: parsed['hostname'] } : {}),
      ...(typeof parsed['createdAt'] === 'string' ? { createdAt: parsed['createdAt'] } : {}),
      ...(typeof parsed['updatedAt'] === 'string' ? { updatedAt: parsed['updatedAt'] } : {})
      },
      ownerPath
    }
  } catch (error) {
    if (getErrorCode(error) === 'ENOENT') {
      return { owner: null, ownerPath }
    }
    return {
      owner: null,
      ownerPath,
      parseError: safeErrorMessage(error)
    }
  }
}

const readProcessLockOwner = async (lockDir: string): Promise<ProcessLockOwner | null> =>
  (await readProcessLockOwnerState(lockDir)).owner

const isProcessRunning = (pid: number | undefined): boolean => {
  if (!Number.isInteger(pid) || (pid ?? 0) < 1) {
    return false
  }

  try {
    process.kill(pid as number, 0)
    return true
  } catch (error) {
    return getErrorCode(error) === 'EPERM'
  }
}

const writeProcessLockOwner = async (
  lockDir: string,
  owner: ActiveProcessLockOwner
): Promise<void> => {
  const ownerPath = getLockOwnerPath(lockDir)
  const tempOwnerPath = join(lockDir, `${LOCK_OWNER_FILE}.${owner.ownerId}.${randomUUID()}.tmp`)
  await writeFile(tempOwnerPath, JSON.stringify(owner, null, 2))
  await rename(tempOwnerPath, ownerPath)
}

const refreshProcessLockOwner = async (
  lockDir: string,
  owner: ActiveProcessLockOwner
): Promise<void> => {
  const current = await readProcessLockOwnerState(lockDir)
  if (current.parseError) {
    throw InfraError(`Failed to read process lock owner metadata at ${current.ownerPath}: ${current.parseError}`, { stage: 'lock:process' })
  }
  const currentOwner = current.owner
  if (currentOwner?.ownerId !== owner.ownerId) {
    return
  }

  await writeProcessLockOwner(lockDir, {
    ...owner,
    updatedAt: new Date().toISOString()
  })
}

const getProcessLockAgeMs = async (
  lockDir: string,
  owner: ProcessLockOwner | null
): Promise<number | null> => {
  try {
    const lockStats = await stat(owner ? getLockOwnerPath(lockDir) : lockDir)
    return Date.now() - lockStats.mtimeMs
  } catch {
    return null
  }
}

const getProcessLockDirIdentity = async (lockDir: string): Promise<ProcessLockDirIdentity | null> => {
  try {
    const lockStats = await stat(lockDir)
    return { dev: lockStats.dev, ino: lockStats.ino }
  } catch {
    return null
  }
}

const isSameProcessLockDir = (
  observed: ProcessLockDirIdentity,
  takenOver: ProcessLockDirIdentity | null
): boolean =>
  takenOver !== null && observed.dev === takenOver.dev && observed.ino === takenOver.ino

const removeStaleProcessLock = async (
  lockDir: string,
  staleMs: number
): Promise<boolean> => {
  const observedLockDir = await getProcessLockDirIdentity(lockDir)
  if (!observedLockDir) {
    return true
  }

  const ownerState = await readProcessLockOwnerState(lockDir)
  const owner = ownerState.owner
  const sameHost = owner?.hostname === CURRENT_HOSTNAME
  const ownerIsRunning = sameHost && owner?.pid !== undefined && isProcessRunning(owner.pid)
  const ownerIsGone = sameHost && owner?.pid !== undefined && !ownerIsRunning
  const ageMs = await getProcessLockAgeMs(lockDir, owner)
  const staleThresholdMs = ownerIsRunning
    ? staleMs * LIVE_OWNER_STALE_MULTIPLIER
    : staleMs
  const heartbeatIsStale = ageMs !== null && ageMs > staleThresholdMs

  if (!ownerIsGone && !heartbeatIsStale) {
    if (ownerState.parseError) {
      l.write('warn', `Process lock owner metadata at ${ownerState.ownerPath} could not be parsed; keeping non-stale lock`, {
        metadata: {
          lockDir,
          ownerPath: ownerState.ownerPath,
          ageMs,
          staleMs,
          parseError: ownerState.parseError
        }
      })
    }
    return false
  }

  const reapDir = `${lockDir}.reap-${randomUUID()}`
  try {
    await rename(lockDir, reapDir)
  } catch (error) {
    if (getErrorCode(error) === 'ENOENT') {
      return true
    }
    throw error
  }

  const takenOverOwner = await readProcessLockOwner(reapDir)
  const tookObservedLock = isSameProcessLockDir(
    observedLockDir,
    await getProcessLockDirIdentity(reapDir)
  ) && (owner?.ownerId === undefined || takenOverOwner?.ownerId === owner.ownerId)

  if (!tookObservedLock) {
    // A third contender can acquire the canonical path before this restore and make
    // it fail. That residual window is accepted; orphaned .reap-* directories are
    // ignored because acquisition only considers the canonical lock directory.
    try {
      await rename(reapDir, lockDir)
    } catch {
      return false
    }
    return false
  }

  l.write('warn', `Removing stale process lock at ${lockDir}`, {
    metadata: {
      lockDir,
      ownerPath: ownerState.ownerPath,
      ownerId: owner?.ownerId,
      lockName: owner?.lockName,
      pid: owner?.pid,
      hostname: owner?.hostname,
      ageMs,
      staleMs,
      staleThresholdMs,
      ownerIsRunning,
      ownerIsGone,
      heartbeatIsStale,
      ...(ownerState.parseError ? { parseError: ownerState.parseError } : {})
    }
  })
  await rm(reapDir, { recursive: true, force: true })
  return true
}

const releaseProcessLock = async (
  lockDir: string,
  ownerId: string
): Promise<void> => {
  const owner = await readProcessLockOwner(lockDir)
  if (owner?.ownerId !== ownerId) {
    return
  }

  await rm(lockDir, { recursive: true, force: true })
}

export const withProcessLock = async <T,>(
  lockName: string,
  fn: () => Promise<T>,
  options: ProcessLockOptions = {}
): Promise<T> => {
  const lockRoot = resolveProcessLockRoot(options)
  const lockDir = join(lockRoot, sanitizeLockName(lockName))
  const heartbeatMs = resolvePositiveInteger(options.heartbeatMs, DEFAULT_LOCK_HEARTBEAT_MS)
  const staleMs = Math.max(
    heartbeatMs * 2,
    resolvePositiveInteger(options.staleMs, DEFAULT_LOCK_STALE_MS)
  )
  const waitTimeoutMs = DEFAULT_LOCK_WAIT_TIMEOUT_MS
  const waitMs = resolvePositiveInteger(options.waitMs, DEFAULT_LOCK_WAIT_MS)
  const startedAt = Date.now()

  await mkdir(lockRoot, { recursive: true })

  let owner: ActiveProcessLockOwner | null = null
  while (owner === null) {
    try {
      await mkdir(lockDir)
      const now = new Date().toISOString()
      const acquiredOwner: ActiveProcessLockOwner = {
        ownerId: randomUUID(),
        lockName,
        pid: process.pid,
        hostname: CURRENT_HOSTNAME,
        createdAt: now,
        updatedAt: now
      }

      try {
        await writeProcessLockOwner(lockDir, acquiredOwner)
      } catch (error) {
        await rm(lockDir, { recursive: true, force: true })
        throw error
      }
      owner = acquiredOwner
    } catch (error) {
      if (getErrorCode(error) !== 'EEXIST') {
        throw error
      }

      if (await removeStaleProcessLock(lockDir, staleMs)) {
        continue
      }

      if (Date.now() - startedAt > waitTimeoutMs) {
        throw InfraError(`Timed out waiting for process lock ${lockName} at ${lockDir}`, { stage: 'lock:process' })
      }

      await Bun.sleep(waitMs)
    }
  }

  const activeOwner = owner
  const heartbeatHealth: HeartbeatHealth = { failureCount: 0 }
  let heartbeatRefresh: Promise<void> | undefined
  const heartbeat = setInterval(() => {
    if (heartbeatRefresh) {
      return
    }

    heartbeatRefresh = refreshProcessLockOwner(lockDir, activeOwner).catch((error) => {
      heartbeatHealth.failureCount += 1
      heartbeatHealth.lastFailureAt = new Date().toISOString()
      heartbeatHealth.lastError = safeErrorMessage(error)
      l.write('warn', `Failed to refresh process lock heartbeat for ${lockName}`, {
        metadata: {
          lockName,
          lockDir,
          ownerId: activeOwner.ownerId,
          pid: activeOwner.pid,
          hostname: activeOwner.hostname,
          heartbeatFailureCount: heartbeatHealth.failureCount,
          lastFailureAt: heartbeatHealth.lastFailureAt,
          error: heartbeatHealth.lastError
        }
      })
    }).finally(() => {
      heartbeatRefresh = undefined
    })
  }, heartbeatMs)
  heartbeat.unref?.()

  try {
    return await fn()
  } finally {
    clearInterval(heartbeat)
    await heartbeatRefresh
    if (heartbeatHealth.failureCount > 0) {
      l.write('warn', `Process lock ${lockName} completed after heartbeat refresh failures`, {
        metadata: {
          lockName,
          lockDir,
          ownerId: activeOwner.ownerId,
          heartbeatFailureCount: heartbeatHealth.failureCount,
          lastFailureAt: heartbeatHealth.lastFailureAt,
          lastError: heartbeatHealth.lastError
        }
      })
    }
    await releaseProcessLock(lockDir, activeOwner.ownerId)
  }
}
