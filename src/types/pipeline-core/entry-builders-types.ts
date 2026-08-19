import type {
  Step2BooleanProviderRegistryEntry,
  Step2BooleanSelectionKey,
  Step2ModelProviderRegistryEntry,
  Step2ProviderOptionSurface,
  Step2ShortcutFlag
} from '~/types'

export type BooleanProviderEntry<FlagName extends string, RuntimeKey extends Step2BooleanSelectionKey> =
  Omit<Step2BooleanProviderRegistryEntry, 'flagName' | 'selection'> & {
    flagName: FlagName
    selection: Omit<Step2BooleanProviderRegistryEntry['selection'], 'runtimeKey'> & { runtimeKey: RuntimeKey }
  }

export type ModelProviderEntry<
  FlagName extends string,
  RuntimeModelsKey extends keyof Step2ProviderOptionSurface,
  RuntimeModelKey extends keyof Step2ProviderOptionSurface
> = Omit<Step2ModelProviderRegistryEntry, 'flagName' | 'selection'> & {
  flagName: FlagName
  selection: Omit<Step2ModelProviderRegistryEntry['selection'], 'runtimeModelsKey' | 'runtimeModelKey'> & {
    runtimeModelsKey: RuntimeModelsKey
    runtimeModelKey: RuntimeModelKey
  }
}

export type RuntimeModelKeyStem = {
  [Key in Extract<keyof Step2ProviderOptionSurface, string>]: Key extends `${infer Stem}Models`
    ? `${Stem}Model` extends keyof Step2ProviderOptionSurface
      ? Stem
      : never
    : never
}[Extract<keyof Step2ProviderOptionSurface, string>]

export type SttRuntimeModelKeyStem = Extract<RuntimeModelKeyStem, `${string}Stt` | 'whisper' | 'whisperfile'>
export type OcrRuntimeModelKeyStem = Extract<RuntimeModelKeyStem, `${string}Ocr`>

export type RuntimeModelsKey<Stem extends RuntimeModelKeyStem> = Extract<keyof Step2ProviderOptionSurface, `${Stem}Models`>
export type RuntimeModelKey<Stem extends RuntimeModelKeyStem> = Extract<keyof Step2ProviderOptionSurface, `${Stem}Model`>

export type ConventionModelProviderOptions = {
  supportedModels: readonly string[]
  validateModel: (value: string) => string
  description: string
}

export type SttModelProviderOptions = ConventionModelProviderOptions & {
  allShortcut?: Extract<Step2ShortcutFlag, 'all-stt' | 'all-local-stt'> | false | undefined
  targetService?: string | undefined
  providerSpecProvider?: string | undefined
  bootstrapProviderId?: string | undefined
}
