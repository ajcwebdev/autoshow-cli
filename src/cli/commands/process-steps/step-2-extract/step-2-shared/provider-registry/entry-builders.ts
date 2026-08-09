import type { CliFlagDefinition, RuntimeOptions, Step2BooleanProviderRegistryEntry, Step2BooleanSelectionKey, Step2Command, Step2Modality, Step2ModelProviderRegistryEntry, Step2ShortcutFlag } from '~/types'

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

export const booleanProvider = (
  entry: {
    step: Step2Command
    modality: Step2Modality
    flagName: string
    targetService: string
    providerSpecProvider: string
    bootstrapProviderId: string
    configKey: string
    allShortcut?: Step2ShortcutFlag | undefined
    runtimeKey: Step2BooleanSelectionKey
    model: string
    description: string
  }
): Step2BooleanProviderRegistryEntry => ({
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

export const modelProvider = (
  entry: {
    step: Step2Command
    modality: Step2Modality
    flagName: string
    targetService: string
    providerSpecProvider: string
    bootstrapProviderId: string
    configKey: string
    allShortcut?: Step2ShortcutFlag | undefined
    runtimeModelsKey: keyof RuntimeOptions
    runtimeModelKey: keyof RuntimeOptions
    supportedModels: readonly string[]
    validateModel: (value: string) => string
    description: string
  }
): Step2ModelProviderRegistryEntry => ({
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
  [Key in Extract<keyof RuntimeOptions, string>]: Key extends `${infer Stem}Models`
    ? `${Stem}Model` extends keyof RuntimeOptions
      ? Stem
      : never
    : never
}[Extract<keyof RuntimeOptions, string>]

type SttRuntimeModelKeyStem = Extract<RuntimeModelKeyStem, `${string}Stt` | 'whisper' | 'whisperfile'>
type OcrRuntimeModelKeyStem = Extract<RuntimeModelKeyStem, `${string}Ocr`>

type RuntimeModelsKey<Stem extends RuntimeModelKeyStem> = Extract<keyof RuntimeOptions, `${Stem}Models`>
type RuntimeModelKey<Stem extends RuntimeModelKeyStem> = Extract<keyof RuntimeOptions, `${Stem}Model`>

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

export const sttModelProvider = <Stem extends SttRuntimeModelKeyStem>(
  slug: string,
  keyStem: Stem,
  options: SttModelProviderOptions
): Step2ModelProviderRegistryEntry => {
  const flagName = `${slug}-stt`
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

export const ocrModelProvider = <Stem extends OcrRuntimeModelKeyStem>(
  slug: string,
  keyStem: Stem,
  options: ConventionModelProviderOptions
): Step2ModelProviderRegistryEntry => {
  const flagName = `${slug}-ocr`
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
