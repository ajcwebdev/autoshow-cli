import type { CliFlagDefinition, Step2BooleanProviderRegistryEntry, Step2BooleanSelectionKey, Step2Command, Step2Modality, Step2ModelProviderRegistryEntry, Step2ProviderOptionSurface, Step2ShortcutFlag } from '~/types'

type BooleanProviderEntry<FlagName extends string, RuntimeKey extends Step2BooleanSelectionKey> =
  Omit<Step2BooleanProviderRegistryEntry, 'flagName' | 'selection'> & {
    flagName: FlagName
    selection: Omit<Step2BooleanProviderRegistryEntry['selection'], 'runtimeKey'> & { runtimeKey: RuntimeKey }
  }

type ModelProviderEntry<
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

const createBooleanFlag = (
  description: string
): CliFlagDefinition => ({
  description,
  type: Boolean,
  default: false,
  negatable: false
})

const createRepeatableModelFlag = (
  description: string,
  defaultValue?: string[]
): CliFlagDefinition => ({
  description,
  type: [String] as [StringConstructor],
  ...(defaultValue ? { default: defaultValue } : {})
} as CliFlagDefinition)

const step2ConfigPath = (
  step: Step2Command,
  key: string
): readonly string[] => ['defaults', 'extract', step, key]

export const booleanProvider = <
  const FlagName extends string,
  const RuntimeKey extends Step2BooleanSelectionKey
>(
  entry: {
    step: Step2Command
    modality: Step2Modality
    flagName: FlagName
    targetService: string
    providerSpecProvider: string
    bootstrapProviderId: string
    configKey: string
    allShortcut?: Step2ShortcutFlag | undefined
    runtimeKey: RuntimeKey
    model: string
    description: string
  }
): BooleanProviderEntry<FlagName, RuntimeKey> => ({
  step: entry.step,
  modality: entry.modality,
  flagName: entry.flagName,
  targetService: entry.targetService,
  providerSpecProvider: entry.providerSpecProvider,
  bootstrapProviderId: entry.bootstrapProviderId,
  configPath: step2ConfigPath(entry.step, entry.configKey),
  resumeSelectable: true,
  ...(entry.allShortcut ? { allShortcut: entry.allShortcut } : {}),
  selection: {
    type: 'boolean',
    runtimeKey: entry.runtimeKey,
    model: entry.model
  },
  flag: createBooleanFlag(entry.description)
})

export const modelProvider = <
  const FlagName extends string,
  const RuntimeModelsKey extends keyof Step2ProviderOptionSurface,
  const RuntimeModelKey extends keyof Step2ProviderOptionSurface
>(
  entry: {
    step: Step2Command
    modality: Step2Modality
    flagName: FlagName
    targetService: string
    providerSpecProvider: string
    bootstrapProviderId: string
    configKey: string
    allShortcut?: Step2ShortcutFlag | undefined
    runtimeModelsKey: RuntimeModelsKey
    runtimeModelKey: RuntimeModelKey
    supportedModels: readonly string[]
    validateModel: (value: string) => string
    description: string
  }
): ModelProviderEntry<FlagName, RuntimeModelsKey, RuntimeModelKey> => ({
  step: entry.step,
  modality: entry.modality,
  flagName: entry.flagName,
  targetService: entry.targetService,
  providerSpecProvider: entry.providerSpecProvider,
  bootstrapProviderId: entry.bootstrapProviderId,
  configPath: step2ConfigPath(entry.step, entry.configKey),
  resumeSelectable: true,
  ...(entry.allShortcut ? { allShortcut: entry.allShortcut } : {}),
  selection: {
    type: 'models',
    runtimeModelsKey: entry.runtimeModelsKey,
    runtimeModelKey: entry.runtimeModelKey,
    supportedModels: entry.supportedModels,
    validateModel: entry.validateModel
  },
  flag: createRepeatableModelFlag(entry.description)
})

type RuntimeModelKeyStem = {
  [Key in Extract<keyof Step2ProviderOptionSurface, string>]: Key extends `${infer Stem}Models`
    ? `${Stem}Model` extends keyof Step2ProviderOptionSurface
      ? Stem
      : never
    : never
}[Extract<keyof Step2ProviderOptionSurface, string>]

type SttRuntimeModelKeyStem = Extract<RuntimeModelKeyStem, `${string}Stt` | 'whisper' | 'whisperfile'>
type OcrRuntimeModelKeyStem = Extract<RuntimeModelKeyStem, `${string}Ocr`>

type RuntimeModelsKey<Stem extends RuntimeModelKeyStem> = Extract<keyof Step2ProviderOptionSurface, `${Stem}Models`>
type RuntimeModelKey<Stem extends RuntimeModelKeyStem> = Extract<keyof Step2ProviderOptionSurface, `${Stem}Model`>

type ConventionModelProviderOptions = {
  supportedModels: readonly string[]
  validateModel: (value: string) => string
  description: string
}

type SttModelProviderOptions = ConventionModelProviderOptions & {
  allShortcut?: Extract<Step2ShortcutFlag, 'all-stt' | 'all-local-stt'> | false | undefined
  targetService?: string | undefined
  providerSpecProvider?: string | undefined
  bootstrapProviderId?: string | undefined
}

const runtimeSelectionKeys = <Stem extends RuntimeModelKeyStem>(keyStem: Stem): {
  runtimeModelsKey: RuntimeModelsKey<Stem>
  runtimeModelKey: RuntimeModelKey<Stem>
} => ({
  runtimeModelsKey: `${keyStem}Models` as RuntimeModelsKey<Stem>,
  runtimeModelKey: `${keyStem}Model` as RuntimeModelKey<Stem>
})

export const sttModelProvider = <const Slug extends string, Stem extends SttRuntimeModelKeyStem>(
  slug: Slug,
  keyStem: Stem,
  options: SttModelProviderOptions
): ModelProviderEntry<`${Slug}-stt`, RuntimeModelsKey<Stem>, RuntimeModelKey<Stem>> => {
  const flagName = `${slug}-stt` as `${Slug}-stt`
  return modelProvider({
    step: 'stt',
    modality: 'media',
    flagName,
    targetService: options.targetService ?? slug,
    providerSpecProvider: options.providerSpecProvider ?? slug,
    bootstrapProviderId: options.bootstrapProviderId ?? flagName,
    configKey: keyStem,
    allShortcut: options.allShortcut === false ? undefined : options.allShortcut ?? 'all-stt',
    ...runtimeSelectionKeys(keyStem),
    supportedModels: options.supportedModels,
    validateModel: options.validateModel,
    description: options.description
  })
}

export const ocrModelProvider = <const Slug extends string, Stem extends OcrRuntimeModelKeyStem>(
  slug: Slug,
  keyStem: Stem,
  options: ConventionModelProviderOptions
): ModelProviderEntry<`${Slug}-ocr`, RuntimeModelsKey<Stem>, RuntimeModelKey<Stem>> => {
  const flagName = `${slug}-ocr` as `${Slug}-ocr`
  return modelProvider({
    step: 'ocr',
    modality: 'document',
    flagName,
    targetService: slug,
    providerSpecProvider: flagName,
    bootstrapProviderId: flagName,
    configKey: keyStem,
    allShortcut: 'all-ocr',
    ...runtimeSelectionKeys(keyStem),
    supportedModels: options.supportedModels,
    validateModel: options.validateModel,
    description: options.description
  })
}
