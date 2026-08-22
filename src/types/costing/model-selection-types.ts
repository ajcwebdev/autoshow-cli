type StringArrayKey<T extends object> = {
  [K in keyof T]-?: Exclude<T[K], undefined> extends readonly string[] ? K : never
}[keyof T] & string

export type ProviderModelSelectionSpec<Options extends object, Service extends string> = {
  service: Service
  modelsKey: StringArrayKey<Options>
}

export type ProviderModelSelection<Service extends string> = {
  service: Service
  model: string
}

export type SelectionSpec = {
  service: string
  modelsKey: string
}

export type SelectionKey<Providers extends readonly SelectionSpec[]> = Providers[number]['modelsKey']
