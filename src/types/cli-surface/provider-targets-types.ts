type GenerationSelectionField = {
  readonly modelsKey: string
}

export type GenerationSelectionFields<TProviderTargets extends Readonly<Record<string, string>>> = {
  readonly [Service in keyof TProviderTargets]: GenerationSelectionField
}

export type GenerationSelectionDescriptor = {
  readonly providerTargets: Readonly<Record<string, string>>
  readonly selections: Readonly<Record<string, GenerationSelectionField>>
}

export type GenerationPricingProviders<TDescriptor extends GenerationSelectionDescriptor> = Array<{
  [Service in keyof TDescriptor['providerTargets'] & keyof TDescriptor['selections'] & string]: {
    service: Service
    modelsKey: TDescriptor['selections'][Service]['modelsKey']
  }
}[keyof TDescriptor['providerTargets'] & keyof TDescriptor['selections'] & string]>
