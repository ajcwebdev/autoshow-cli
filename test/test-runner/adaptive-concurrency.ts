import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { withProcessLock } from '~/utils/process-lock'
import type {
  AdaptiveCommandAttemptRecord,
  AdaptiveConcurrencyConfig,
  AdaptiveConcurrencySnapshot,
  AdaptiveGroupState,
  AdaptiveLease,
  AdaptiveLeaseState,
  AdaptivePressureKind,
  AdaptiveProviderGroup,
  AdaptiveSchedulerState
} from '~/types'
import {
  RATE_LIMIT_PATTERN,
  TIMEOUT_PATTERN,
  TRANSIENT_PATTERN
} from '../test-utils/provider-failure-classifiers'

const STATE_FILE = 'adaptive-concurrency.json'
const LOCK_NAME = 'adaptive-concurrency-state'

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_INITIAL_PROVIDER_LIMIT = 10
const DEFAULT_GROUP_INITIAL_LIMITS: Record<string, number> = {}
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60_000
const DEFAULT_TRANSIENT_COOLDOWN_MS = 5_000
const DEFAULT_SUCCESS_STREAK_TO_INCREASE = 3
const DEFAULT_ACQUIRE_POLL_MS = 100
const DEFAULT_LOCK_WAIT_MS = 25
const DEFAULT_LOCK_STALE_MS = 30_000

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const initialLimitForGroup = (
  group: AdaptiveProviderGroup,
  config: AdaptiveConcurrencyConfig
): number => config.groupInitialLimits[group] ?? config.initialProviderLimit

export const resolveAdaptiveConcurrencyConfig = (
  stateDir: string,
  overrides: Partial<Omit<AdaptiveConcurrencyConfig, 'stateDir'>> = {}
): AdaptiveConcurrencyConfig => ({
  stateDir,
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
  initialProviderLimit: DEFAULT_INITIAL_PROVIDER_LIMIT,
  rateLimitCooldownMs: DEFAULT_RATE_LIMIT_COOLDOWN_MS,
  transientCooldownMs: DEFAULT_TRANSIENT_COOLDOWN_MS,
  successStreakToIncrease: DEFAULT_SUCCESS_STREAK_TO_INCREASE,
  acquirePollMs: DEFAULT_ACQUIRE_POLL_MS,
  lockWaitMs: DEFAULT_LOCK_WAIT_MS,
  lockStaleMs: DEFAULT_LOCK_STALE_MS,
  ...overrides,
  groupInitialLimits: { ...DEFAULT_GROUP_INITIAL_LIMITS, ...overrides.groupInitialLimits },
})

const statePath = (config: AdaptiveConcurrencyConfig): string => join(config.stateDir, STATE_FILE)

const emptyState = (): AdaptiveSchedulerState => ({
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  groups: {},
})

const parseLeaseState = (value: unknown): AdaptiveLeaseState | null => {
  if (!isRecord(value)) {
    return null
  }
  const pid = value['pid']
  const acquiredAtMs = value['acquiredAtMs']
  const expiresAtMs = value['expiresAtMs']
  const command = value['command']
  if (
    typeof pid !== 'number'
    || typeof acquiredAtMs !== 'number'
    || typeof expiresAtMs !== 'number'
    || typeof command !== 'string'
  ) {
    return null
  }
  return { pid, acquiredAtMs, expiresAtMs, command }
}

const parseGroupState = (
  group: AdaptiveProviderGroup,
  value: unknown,
  config: AdaptiveConcurrencyConfig
): AdaptiveGroupState | null => {
  if (!isRecord(value)) {
    return null
  }
  const leases: Record<string, AdaptiveLeaseState> = {}
  const rawLeases = value['leases']
  if (isRecord(rawLeases)) {
    for (const [leaseId, leaseValue] of Object.entries(rawLeases)) {
      const lease = parseLeaseState(leaseValue)
      if (lease) {
        leases[leaseId] = lease
      }
    }
  }

  const initialLimit = initialLimitForGroup(group, config)
  const maxLimit = typeof value['maxLimit'] === 'number'
    ? Math.max(1, Math.floor(value['maxLimit']))
    : initialLimit
  const effectiveMaxLimit = Math.max(1, initialLimit, maxLimit)
  const limit = typeof value['limit'] === 'number'
    ? Math.max(1, Math.min(effectiveMaxLimit, Math.floor(value['limit'])))
    : initialLimit

  return {
    limit,
    maxLimit: effectiveMaxLimit,
    cooldownUntilMs: typeof value['cooldownUntilMs'] === 'number' ? Math.max(0, value['cooldownUntilMs']) : 0,
    successStreak: typeof value['successStreak'] === 'number' ? Math.max(0, Math.floor(value['successStreak'])) : 0,
    failureStreak: typeof value['failureStreak'] === 'number' ? Math.max(0, Math.floor(value['failureStreak'])) : 0,
    leases,
  }
}

const readSchedulerState = async (config: AdaptiveConcurrencyConfig): Promise<AdaptiveSchedulerState> => {
  try {
    const parsed = JSON.parse(await readFile(statePath(config), 'utf8')) as unknown
    if (!isRecord(parsed) || parsed['schemaVersion'] !== 1 || !isRecord(parsed['groups'])) {
      return emptyState()
    }

    const groups: Record<string, AdaptiveGroupState> = {}
    for (const [groupKey, rawGroup] of Object.entries(parsed['groups'])) {
      const group = parseGroupState(groupKey as AdaptiveProviderGroup, rawGroup, config)
      if (group) {
        groups[groupKey] = group
      }
    }

    return {
      schemaVersion: 1,
      updatedAt: typeof parsed['updatedAt'] === 'string' ? parsed['updatedAt'] : new Date().toISOString(),
      groups,
    }
  } catch {
    return emptyState()
  }
}

const writeSchedulerState = async (
  config: AdaptiveConcurrencyConfig,
  state: AdaptiveSchedulerState
): Promise<void> => {
  await mkdir(config.stateDir, { recursive: true })
  state.updatedAt = new Date().toISOString()
  await writeFile(statePath(config), `${JSON.stringify(state, null, 2)}\n`)
}

const withStateLock = async <T,>(
  config: AdaptiveConcurrencyConfig,
  fn: (state: AdaptiveSchedulerState) => Promise<T>
): Promise<T> => {
  await mkdir(config.stateDir, { recursive: true })
  return await withProcessLock(
    LOCK_NAME,
    async () => {
      const state = await readSchedulerState(config)
      const result = await fn(state)
      await writeSchedulerState(config, state)
      return result
    },
    {
      lockRoot: join(config.stateDir, 'locks'),
      waitMs: config.lockWaitMs,
      heartbeatMs: Math.max(10, config.lockWaitMs),
      staleMs: config.lockStaleMs,
    }
  )
}

const ensureGroupState = (
  state: AdaptiveSchedulerState,
  group: AdaptiveProviderGroup,
  config: AdaptiveConcurrencyConfig
): AdaptiveGroupState => {
  const existing = state.groups[group]
  const initialLimit = initialLimitForGroup(group, config)
  if (existing) {
    existing.maxLimit = Math.max(existing.maxLimit, initialLimit)
    existing.limit = Math.max(1, Math.min(existing.limit, existing.maxLimit))
    return existing
  }

  const created: AdaptiveGroupState = {
    limit: initialLimit,
    maxLimit: initialLimit,
    cooldownUntilMs: 0,
    successStreak: 0,
    failureStreak: 0,
    leases: {},
  }
  state.groups[group] = created
  return created
}

const pruneExpiredLeases = (group: AdaptiveGroupState, nowMs: number): void => {
  for (const [leaseId, lease] of Object.entries(group.leases)) {
    if (lease.expiresAtMs <= nowMs) {
      delete group.leases[leaseId]
    }
  }
}

const activeCount = (group: AdaptiveGroupState): number => Object.keys(group.leases).length

const nextWaitMs = (
  groups: AdaptiveGroupState[],
  nowMs: number,
  config: AdaptiveConcurrencyConfig
): number => {
  const cooldownWaits = groups
    .map(group => group.cooldownUntilMs - nowMs)
    .filter(wait => wait > 0)
  const cooldownWait = cooldownWaits.length > 0 ? Math.min(...cooldownWaits) : config.acquirePollMs
  return Math.max(1, Math.min(config.acquirePollMs, cooldownWait))
}

export const acquireAdaptiveProviderLease = async (
  groups: AdaptiveProviderGroup[],
  config: AdaptiveConcurrencyConfig,
  options: { command: string, leaseTtlMs: number }
): Promise<AdaptiveLease> => {
  const sortedGroups = [...new Set(groups)].sort((left, right) => left.localeCompare(right))
  if (sortedGroups.length === 0) {
    return {
      id: 'no-adaptive-groups',
      groups: [],
      release: async () => {},
    }
  }

  const leaseId = randomUUID()

  while (true) {
    const acquired = await withStateLock(config, async (state) => {
      const nowMs = Date.now()
      const groupStates = sortedGroups.map((group) => {
        const groupState = ensureGroupState(state, group, config)
        pruneExpiredLeases(groupState, nowMs)
        return groupState
      })
      const ready = groupStates.every(group =>
        activeCount(group) < group.limit && group.cooldownUntilMs <= nowMs
      )

      if (!ready) {
        return {
          acquired: false,
          waitMs: nextWaitMs(groupStates, nowMs, config),
        }
      }

      for (const group of groupStates) {
        group.leases[leaseId] = {
          pid: process.pid,
          acquiredAtMs: nowMs,
          expiresAtMs: nowMs + options.leaseTtlMs,
          command: options.command,
        }
      }

      return {
        acquired: true,
        waitMs: 0,
      }
    })

    if (acquired.acquired) {
      return {
        id: leaseId,
        groups: sortedGroups,
        release: async () => {
          await releaseAdaptiveProviderLease(leaseId, sortedGroups, config)
        },
      }
    }

    await Bun.sleep(acquired.waitMs)
  }
}

export const releaseAdaptiveProviderLease = async (
  leaseId: string,
  groups: AdaptiveProviderGroup[],
  config: AdaptiveConcurrencyConfig
): Promise<void> => {
  if (groups.length === 0) {
    return
  }

  await withStateLock(config, async (state) => {
    for (const group of groups) {
      const groupState = ensureGroupState(state, group, config)
      delete groupState.leases[leaseId]
      pruneExpiredLeases(groupState, Date.now())
    }
  })
}

export const recordAdaptiveSuccess = async (
  groups: AdaptiveProviderGroup[],
  config: AdaptiveConcurrencyConfig
): Promise<void> => {
  if (groups.length === 0) {
    return
  }

  await withStateLock(config, async (state) => {
    const nowMs = Date.now()
    for (const group of groups) {
      const groupState = ensureGroupState(state, group, config)
      pruneExpiredLeases(groupState, nowMs)
      groupState.failureStreak = 0
      groupState.successStreak += 1
      if (groupState.limit < groupState.maxLimit && groupState.successStreak >= config.successStreakToIncrease) {
        groupState.limit += 1
        groupState.successStreak = 0
      }
    }
  })
}

export const recordAdaptivePressure = async (
  groups: AdaptiveProviderGroup[],
  pressure: AdaptivePressureKind,
  config: AdaptiveConcurrencyConfig
): Promise<void> => {
  if (groups.length === 0) {
    return
  }

  await withStateLock(config, async (state) => {
    const nowMs = Date.now()
    for (const group of groups) {
      const groupState = ensureGroupState(state, group, config)
      pruneExpiredLeases(groupState, nowMs)
      groupState.failureStreak += 1
      groupState.successStreak = 0

      if (pressure === 'rate-limit' || pressure === 'timeout') {
        groupState.limit = 1
        groupState.cooldownUntilMs = Math.max(groupState.cooldownUntilMs, nowMs + config.rateLimitCooldownMs)
      } else {
        groupState.limit = Math.max(1, Math.ceil(groupState.limit / 2))
        groupState.cooldownUntilMs = Math.max(groupState.cooldownUntilMs, nowMs + config.transientCooldownMs)
      }
    }
  })
}

export const classifyAdaptivePressure = (
  output: string,
  exitCode: number,
  timedOut: boolean
): AdaptivePressureKind | null => {
  if (exitCode === 0) {
    return null
  }
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '')
  if (timedOut || RATE_LIMIT_PATTERN.test(clean)) {
    return RATE_LIMIT_PATTERN.test(clean) ? 'rate-limit' : 'timeout'
  }
  if (TIMEOUT_PATTERN.test(clean)) {
    return 'timeout'
  }
  if (TRANSIENT_PATTERN.test(clean)) {
    return 'transient'
  }
  return null
}

export const formatAdaptiveRetrySummary = (
  records: AdaptiveCommandAttemptRecord[],
  finalExitCode: number
): string => {
  if (records.length === 0) {
    return ''
  }

  const lines = [
    'Adaptive concurrency retry summary:',
    `Final exit code: ${finalExitCode}`,
  ]
  for (const record of records) {
    lines.push(`- attempt ${record.attempt}: ${record.pressure}; groups=${record.groups.join(', ')}`)
  }
  return lines.join('\n')
}

export const readAdaptiveConcurrencySnapshot = async (
  config: AdaptiveConcurrencyConfig
): Promise<AdaptiveConcurrencySnapshot> => {
  const state = await readSchedulerState(config)
  const nowMs = Date.now()
  const groups: AdaptiveConcurrencySnapshot['groups'] = {}
  for (const [groupKey, groupState] of Object.entries(state.groups)) {
    pruneExpiredLeases(groupState, nowMs)
    groups[groupKey] = {
      limit: groupState.limit,
      maxLimit: groupState.maxLimit,
      active: activeCount(groupState),
      cooldownUntilMs: groupState.cooldownUntilMs,
      successStreak: groupState.successStreak,
      failureStreak: groupState.failureStreak,
    }
  }
  return { groups }
}
