import type { AdditiveResumeProviderSelection, ProviderIdentity } from '~/types'

export const getResumeProviderKey = (
  provider: ProviderIdentity
): string => `${provider.service}:${provider.model}`

const appendUniqueProvider = <TProvider extends ProviderIdentity>(
  providers: TProvider[],
  provider: TProvider,
  seen: Set<string>
): void => {
  const key = getResumeProviderKey(provider)
  if (seen.has(key)) {
    return
  }
  providers.push(provider)
  seen.add(key)
}

export const uniqueResumeProviders = <TProvider extends ProviderIdentity>(
  providers: readonly TProvider[]
): TProvider[] => {
  const seen = new Set<string>()
  const unique: TProvider[] = []
  for (const provider of providers) {
    appendUniqueProvider(unique, provider, seen)
  }
  return unique
}

export const resolveAdditiveResumeProviderSelection = <TProvider extends ProviderIdentity>(
  options: {
    storedProviders: readonly TProvider[]
    runnableStoredProviders: readonly TProvider[]
    selectedProviders?: readonly TProvider[] | undefined
    successfulProviderKeys?: ReadonlySet<string> | undefined
  }
): AdditiveResumeProviderSelection<TProvider> => {
  const storedProviders = uniqueResumeProviders(options.storedProviders)
  const storedKeys = new Set(storedProviders.map(getResumeProviderKey))
  const runnableStoredKeys = new Set(options.runnableStoredProviders.map(getResumeProviderKey))
  const successfulKeys = options.successfulProviderKeys ?? new Set<string>()

  if (!options.selectedProviders) {
    return {
      requestedProviders: storedProviders,
      providersToRun: uniqueResumeProviders(options.runnableStoredProviders)
        .filter((provider) => !successfulKeys.has(getResumeProviderKey(provider))),
      skippedSuccessfulProviders: []
    }
  }

  const selectedProviders = uniqueResumeProviders(options.selectedProviders)
  const requestedProviders = [...storedProviders]
  const requestedKeys = new Set(storedKeys)
  for (const provider of selectedProviders) {
    appendUniqueProvider(requestedProviders, provider, requestedKeys)
  }

  const providersToRun: TProvider[] = []
  const skippedSuccessfulProviders: TProvider[] = []
  for (const provider of selectedProviders) {
    const key = getResumeProviderKey(provider)
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
