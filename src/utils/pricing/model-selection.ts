type StringArrayKey<T extends object> = {
  [K in keyof T]-?: Exclude<T[K], undefined> extends readonly string[] ? K : never
}[keyof T] & string

type StringKey<T extends object> = {
  [K in keyof T]-?: Exclude<T[K], undefined> extends string ? K : never
}[keyof T] & string

export type ProviderModelSelectionSpec<Options extends object, Service extends string> = {
  service: Service
  modelsKey: StringArrayKey<Options>
  modelKey: StringKey<Options>
}

export type ProviderModelSelection<Service extends string> = {
  service: Service
  model: string
}

type SelectionSpec = {
  service: string
  modelsKey: string
  modelKey: string
}

type SelectionKey<Providers extends readonly SelectionSpec[]> = Providers[number]['modelsKey' | 'modelKey']

const readModels = <Options extends object>(
  options: Options,
  provider: ProviderModelSelectionSpec<Options, string>
): readonly string[] => {
  const plural = options[provider.modelsKey] as readonly string[] | undefined
  if (plural !== undefined) return plural

  const singular = options[provider.modelKey] as string | undefined
  return singular ? [singular] : []
}

export const collectSelections = <Options extends object, Service extends string>(
  options: Options,
  providers: readonly ProviderModelSelectionSpec<Options, Service>[]
): ProviderModelSelection<Service>[] =>
  providers.flatMap((provider) =>
    readModels(options, provider).map((model) => ({ service: provider.service, model }))
  )

export const optionsForService = <Options extends object, Service extends string>(
  providers: readonly ProviderModelSelectionSpec<Options, Service>[],
  service: Service,
  models: string | readonly string[]
): Partial<Options> => {
  const provider = providers.find((candidate) => candidate.service === service)
  if (!provider) return {}

  if (typeof models === 'string') {
    return { [provider.modelKey]: models } as Partial<Options>
  }

  return {
    [provider.modelsKey]: [...models],
    [provider.modelKey]: models[0]
  } as Partial<Options>
}

export const hasAnySelection = <Options extends object, Service extends string>(
  options: Options,
  providers: readonly ProviderModelSelectionSpec<Options, Service>[]
): boolean => collectSelections(options, providers).length > 0

export const passThroughKeys = <const Providers extends readonly SelectionSpec[]>(
  providers: Providers
): readonly SelectionKey<Providers>[] =>
  providers.flatMap((provider) => [provider.modelsKey, provider.modelKey]) as SelectionKey<Providers>[]
