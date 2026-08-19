import type { AdditiveResumeProviderSelection, ProviderIdentity, ResumeProviderKey } from '~/types'

export const getResumeProviderKey = (
  provider: ProviderIdentity
): string => `${provider.service}:${provider.model}`

const appendUniqueProvider = <TProvider extends ProviderIdentity>(
  providers: TProvider[],
  provider: TProvider,
  seen: Set<string>,
  getKey: ResumeProviderKey
): void => {
  const key = getKey(provider)
  if (seen.has(key)) {
    return
  }
  providers.push(provider)
  seen.add(key)
}

export const uniqueResumeProviders = <TProvider extends ProviderIdentity>(
  providers: readonly TProvider[],
  getKey: ResumeProviderKey = getResumeProviderKey
): TProvider[] => {
  const seen = new Set<string>()
  const unique: TProvider[] = []
  for (const provider of providers) {
    appendUniqueProvider(unique, provider, seen, getKey)
  }
  return unique
}

export const resolveAdditiveResumeProviderSelection = <TProvider extends ProviderIdentity>(
  options: {
    storedProviders: readonly TProvider[]
    runnableStoredProviders: readonly TProvider[]
    selectedProviders?: readonly TProvider[] | undefined
    successfulProviderKeys?: ReadonlySet<string> | undefined
  },
  getKey: ResumeProviderKey = getResumeProviderKey
): AdditiveResumeProviderSelection<TProvider> => {
  const storedProviders = uniqueResumeProviders(options.storedProviders, getKey)
  const storedKeys = new Set(storedProviders.map(getKey))
  const runnableStoredKeys = new Set(options.runnableStoredProviders.map(getKey))
  const successfulKeys = options.successfulProviderKeys ?? new Set<string>()

  if (!options.selectedProviders) {
    return {
      requestedProviders: storedProviders,
      providersToRun: uniqueResumeProviders(options.runnableStoredProviders, getKey)
        .filter((provider) => !successfulKeys.has(getKey(provider))),
      skippedSuccessfulProviders: []
    }
  }

  const selectedProviders = uniqueResumeProviders(options.selectedProviders, getKey)
  const requestedProviders = [...storedProviders]
  const requestedKeys = new Set(storedKeys)
  for (const provider of selectedProviders) {
    appendUniqueProvider(requestedProviders, provider, requestedKeys, getKey)
  }

  const providersToRun: TProvider[] = []
  const skippedSuccessfulProviders: TProvider[] = []
  for (const provider of selectedProviders) {
    const key = getKey(provider)
    if (successfulKeys.has(key)) {
      skippedSuccessfulProviders.push(provider)
      continue
    }
    if (!storedKeys.has(key) || runnableStoredKeys.has(key)) {
      providersToRun.push(provider)
    }
  }

  return {
    requestedProviders,
    providersToRun,
    skippedSuccessfulProviders
  }
}
