import type { ProviderCompletionStatus } from '~/types'

type ProviderIdentityLike = { service: string, model: string }

export type ProviderStateLike = ProviderIdentityLike & { status: 'succeeded' | 'missing' | 'failed' | 'skipped' }

const getProviderKey = (provider: ProviderIdentityLike): string =>
  `${provider.service}:${provider.model}`

export const parseStoredProviderArray = <T>(value: unknown, parse: (entry: unknown) => T | undefined): T[] =>
  Array.isArray(value)
    ? value.map(parse).filter((entry): entry is T => entry !== undefined)
    : []

export const parseStoredProviderStateMap = <TState extends ProviderStateLike>(value: unknown, parse: (entry: unknown) => TState | undefined): Map<string, TState> =>
  new Map(parseStoredProviderArray(value, parse).map((state) => [getProviderKey(state), state]))

export const parseStoredSuccessfulProviderKeys = (value: unknown, parse: (entry: unknown) => ProviderIdentityLike | undefined): Set<string> => {
  const entries = Array.isArray(value) ? value : value === undefined ? [] : [value]
  return new Set(entries.flatMap((entry) => {
    const provider = parse(entry)
    return provider ? [getProviderKey(provider)] : []
  }))
}

export const resolveRequestedProviderCompletionStatus = <TTarget extends ProviderIdentityLike, TState extends ProviderStateLike>(
  requestedTargets: readonly TTarget[],
  successfulKeys: ReadonlySet<string>,
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

    if (successfulKeys.has(key) || state?.status === 'succeeded') {
      succeeded += 1
    } else {
      incomplete = true
    }
  }

  return succeeded === 0 ? 'failed' : incomplete ? 'incomplete' : 'full'
}

export const inferStoredProviderCompletionStatus = <TTarget extends ProviderIdentityLike, TState extends ProviderStateLike>(
  storedCompletionStatus: unknown,
  requestedTargets: readonly TTarget[],
  successfulKeys: ReadonlySet<string>,
  providerStates: ReadonlyMap<string, TState>,
  isIgnoredState: (state: TState | undefined) => boolean
): ProviderCompletionStatus => {
  if (providerStates.size === 0 && (storedCompletionStatus === 'full' || storedCompletionStatus === 'incomplete' || storedCompletionStatus === 'failed')) {
    return storedCompletionStatus
  }
  return resolveRequestedProviderCompletionStatus(requestedTargets, successfulKeys, providerStates, isIgnoredState)
}

export const collectMissingProviderTargets = <TTarget extends ProviderIdentityLike, TState extends ProviderStateLike>(
  explicitMissingTargets: readonly TTarget[],
  requestedTargets: readonly TTarget[],
  successfulKeys: ReadonlySet<string>,
  providerStates: ReadonlyMap<string, TState>,
  isMissingTarget: (target: TTarget, state: TState | undefined) => boolean
): TTarget[] => {
  const missingTargets = new Map<string, TTarget>()

  for (const target of explicitMissingTargets) {
    const key = getProviderKey(target)
    if (isMissingTarget(target, providerStates.get(key))) {
      missingTargets.set(key, target)
    }
  }

  for (const target of requestedTargets) {
    const key = getProviderKey(target)
    if (!successfulKeys.has(key) && isMissingTarget(target, providerStates.get(key))) {
      missingTargets.set(key, target)
    }
  }

  return [...missingTargets.values()]
}

export const resolveProviderCompletionStatus = <TState extends ProviderStateLike>(providerStates: readonly TState[], skippedPolicy: 'complete' | 'incomplete'): ProviderCompletionStatus => {
  if (!providerStates.some((state) => state.status === 'succeeded')) {
    return 'failed'
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

export class ProviderBatchCompletionError extends Error {
  readonly outputDir: string
  readonly completionStatus: ProviderCompletionStatus
  readonly exitCode = 2

  constructor(name: string, outputDir: string, completionStatus: ProviderCompletionStatus, message: string) {
    super(message)
    this.name = name
    this.outputDir = outputDir
    this.completionStatus = completionStatus
  }
}
