import type { BooleanProviderEntry, CliFlagDefinition, ConventionModelProviderOptions, ModelProviderEntry, OcrRuntimeModelKeyStem, RuntimeModelKey, RuntimeModelKeyStem, RuntimeModelsKey, Step2BooleanSelectionKey, Step2Command, Step2Modality, Step2ProviderOptionSurface, Step2ShortcutFlag, SttModelProviderOptions, SttRuntimeModelKeyStem } from '~/types'

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

const providerEntryHeader = <const FlagName extends string>(entry: {
  step: Step2Command
  modality: Step2Modality
  flagName: FlagName
  targetService: string
  providerSpecProvider: string
  bootstrapProviderId: string
  configKey: string
  allShortcut?: Step2ShortcutFlag | undefined
}): {
  step: Step2Command
  modality: Step2Modality
  flagName: FlagName
  targetService: string
  providerSpecProvider: string
  bootstrapProviderId: string
  configPath: readonly string[]
  resumeSelectable: true
  allShortcut?: Step2ShortcutFlag
} => ({
  step: entry.step,
  modality: entry.modality,
  flagName: entry.flagName,
  targetService: entry.targetService,
  providerSpecProvider: entry.providerSpecProvider,
  bootstrapProviderId: entry.bootstrapProviderId,
  configPath: step2ConfigPath(entry.step, entry.configKey),
  resumeSelectable: true as const,
  ...(entry.allShortcut ? { allShortcut: entry.allShortcut } : {})
})

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
  ...providerEntryHeader(entry),
  selection: {
    type: 'boolean',
    runtimeKey: entry.runtimeKey,
    model: entry.model
  },
  flag: createBooleanFlag(entry.description)
})

const modelProvider = <
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
  ...providerEntryHeader(entry),
  selection: {
    type: 'models',
    runtimeModelsKey: entry.runtimeModelsKey,
    runtimeModelKey: entry.runtimeModelKey,
    supportedModels: entry.supportedModels,
    validateModel: entry.validateModel
  },
  flag: createRepeatableModelFlag(entry.description)
})

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
