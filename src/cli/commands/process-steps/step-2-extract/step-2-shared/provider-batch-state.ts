import { AppInfrastructureError, InfraError } from '~/utils/error-handler'
import type { ProviderCompletionStatus, ProviderIdentityLike, ProviderStateLike } from '~/types'
import { isRecord } from '~/utils/value-helpers'

const STORED_PROVIDER_STATUSES = ['running', 'succeeded', 'missing', 'failed', 'skipped'] as const

/**
 * The fields every persisted provider-state entry carries regardless of step. A stored
 * entry that fails these checks is dropped rather than repaired, so a manifest written by
 * a newer schema degrades to "not recorded" instead of resuming against a partial state.
 * Target identity and the step's failure shape are decoded by the caller and merged in.
 */
export const parseStoredProviderStateCore = (value: unknown): {
  status: ProviderStateLike['status']
  artifactDir: string
  attempts: number
  metadata?: Record<string, unknown> | undefined
  result?: Record<string, unknown> | undefined
} | undefined => {
  if (!isRecord(value)) return undefined
  if (!(STORED_PROVIDER_STATUSES as readonly unknown[]).includes(value['status'])) return undefined
  if (typeof value['artifactDir'] !== 'string' || typeof value['attempts'] !== 'number') return undefined

  return {
    status: value['status'] as ProviderStateLike['status'],
    artifactDir: value['artifactDir'],
    attempts: value['attempts'],
    ...(isRecord(value['metadata']) ? { metadata: value['metadata'] } : {}),
    ...(isRecord(value['result']) ? { result: value['result'] } : {})
  }
}

const getProviderKey = (provider: ProviderIdentityLike): string =>
  `${provider.service}:${provider.model}`

export const parseStoredProviderArray = <T>(value: unknown, parse: (entry: unknown) => T | undefined): T[] =>
  Array.isArray(value)
    ? value.map(parse).filter((entry): entry is T => entry !== undefined)
    : []

export const parseStoredProviderStateMap = <TState extends ProviderStateLike>(value: unknown, parse: (entry: unknown) => TState | undefined): Map<string, TState> =>
  new Map(parseStoredProviderArray(value, parse).map((state) => [getProviderKey(state), state]))

export const resolveRequestedProviderCompletionStatus = <TTarget extends ProviderIdentityLike, TState extends ProviderStateLike>(
  requestedTargets: readonly TTarget[],
  providerStates: ReadonlyMap<string, TState>,
  isIgnoredState: (state: TState | undefined) => boolean
): ProviderCompletionStatus => {
  let succeeded = 0
  let incomplete = false

  for (const target of requestedTargets) {
    const key = getProviderKey(target)
    const state = providerStates.get(key)
    if (isIgnoredState(state)) {
      continue
    }

    if (state?.status === 'succeeded') {
      succeeded += 1
    } else {
      incomplete = true
    }
  }

  return succeeded === 0 ? 'failed' : incomplete ? 'incomplete' : 'full'
}

export const collectMissingProviderTargets = <TTarget extends ProviderIdentityLike, TState extends ProviderStateLike>(
  requestedTargets: readonly TTarget[],
  providerStates: ReadonlyMap<string, TState>,
  isMissingTarget: (target: TTarget, state: TState | undefined) => boolean
): TTarget[] => {
  const missingTargets = new Map<string, TTarget>()

  for (const target of requestedTargets) {
    const key = getProviderKey(target)
    if (isMissingTarget(target, providerStates.get(key))) {
      missingTargets.set(key, target)
    }
  }

  return [...missingTargets.values()]
}

export const resolveProviderCompletionStatus = <TState extends ProviderStateLike>(providerStates: readonly TState[], skippedPolicy: 'complete' | 'incomplete'): ProviderCompletionStatus => {
  if (!providerStates.some((state) => state.status === 'succeeded')) {
    return providerStates.some((state) => state.status === 'running' || state.status === 'missing')
      ? 'incomplete'
      : 'failed'
  }

  return providerStates.every((state) =>
    state.status === 'succeeded' || (skippedPolicy === 'complete' && state.status === 'skipped')
  )
    ? 'full'
    : 'incomplete'
}

export const buildRequestedProviderList = <TTarget extends ProviderIdentityLike, TState extends ProviderStateLike, TRequested>(
  providerStates: readonly TState[],
  requestedTargets: readonly TTarget[],
  includeState: (state: TState) => boolean,
  toRequestedProvider: (target: TTarget) => TRequested
): TRequested[] => {
  const includedKeys = new Set(providerStates.filter(includeState).map(getProviderKey))
  return requestedTargets
    .filter((target) => includedKeys.has(getProviderKey(target)))
    .map(toRequestedProvider)
}

/**
 * The single spelling of "a batch or resume finished with work still outstanding".
 *
 * Exit code 2 (rather than the infrastructure default of 1) marks partial completion as
 * distinct from an outright failure. It used to be expressed three ways — this class, an
 * unrelated `SttBatchIncompleteError`, and eight `InfraError(..., { exitCode: 2 })` resume
 * sites — so callers could not classify it without knowing which spelling they had.
 */
const PARTIAL_COMPLETION_EXIT_CODE = 2

export class ProviderBatchCompletionError extends AppInfrastructureError {
  readonly outputDir: string
  readonly completionStatus: ProviderCompletionStatus

  constructor(name: string, outputDir: string, completionStatus: ProviderCompletionStatus, message: string) {
    super(message, {
      exitCode: PARTIAL_COMPLETION_EXIT_CODE,
      stage: 'batch:completion',
      retryable: false,
      metadata: { outputDir, completionStatus }
    })
    this.name = name
    this.outputDir = outputDir
    this.completionStatus = completionStatus
  }
}

/** Non-provider partial completions (resume flows) that need the same classification. */
export const partialCompletionError = (
  message: string,
  options: { stage: string, metadata?: Record<string, unknown> }
): AppInfrastructureError => InfraError(message, {
  stage: options.stage,
  exitCode: PARTIAL_COMPLETION_EXIT_CODE,
  retryable: false,
  ...(options.metadata ? { metadata: options.metadata } : {})
})
