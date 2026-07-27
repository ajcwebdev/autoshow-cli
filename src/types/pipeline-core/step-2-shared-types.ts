import type { CliFlagDefinition, ProviderIdentityBase, RuntimeOptions, Step2Modality, Step2ProviderSelectionOrigin } from '~/types'

export type OcrModelOverrideOptions = {
  mistralOcrModel?: string | undefined
  glmOcrModel?: string | undefined
  kimiOcrModel?: string | undefined
  openaiOcrModel?: string | undefined
  grokOcrModel?: string | undefined
  anthropicOcrModel?: string | undefined
  geminiOcrModel?: string | undefined
  deepinfraOcrModel?: string | undefined
}


export type ResolvedStep2Provider = ProviderIdentityBase & {
  origin?: Step2ProviderSelectionOrigin | undefined
}

export type Step2ShortcutFlag = 'all-stt' | 'all-local-stt' | 'all-ocr' | 'all-local-ocr' | 'all-url' | 'all-local-url'
export type Step2Command = 'stt' | 'ocr' | 'url'
export type Step2BooleanSelectionKey = 'useReverb' | 'useTesseract'

export type Step2ProviderSelectionFilter = {
  includeOrigins?: readonly Step2ProviderSelectionOrigin[] | undefined
}

export type Step2ResolvedProviderSelection = {
  flagName: string
  step: Step2Command
  modality: Step2Modality
  targetService: string
  providerSpecProvider: string
  bootstrapProviderId: string
  configPath: readonly string[]
  model: string
  selectionKind: 'boolean' | 'models' | 'fixed'
  origin: Step2ProviderSelectionOrigin
}

type Step2ProviderRegistryEntryBase = {
  step: Step2Command
  modality: Step2Modality
  flagName: string
  targetService: string
  providerSpecProvider: string
  bootstrapProviderId: string
  configPath: readonly string[]
  resumeSelectable: true
  allShortcut?: Step2ShortcutFlag
}

export type Step2BooleanProviderRegistryEntry = Step2ProviderRegistryEntryBase & {
  selection: {
    type: 'boolean'
    runtimeKey: Step2BooleanSelectionKey
    model: string
  }
  flag: CliFlagDefinition
}

export type Step2ModelProviderRegistryEntry = Step2ProviderRegistryEntryBase & {
  selection: {
    type: 'models'
    runtimeModelsKey: keyof RuntimeOptions
    runtimeModelKey: keyof RuntimeOptions
    supportedModels: readonly string[]
    validateModel: (value: string) => string
  }
  flag: CliFlagDefinition
}

export type Step2FixedProviderRegistryEntry = Step2ProviderRegistryEntryBase & {
  selection: {
    type: 'fixed'
    model: string
  }
  flag: CliFlagDefinition
}

export type Step2ProviderRegistryEntry =
  | Step2BooleanProviderRegistryEntry
  | Step2ModelProviderRegistryEntry
  | Step2FixedProviderRegistryEntry


export type ProviderRunStateBase<TService extends string, TError> = ProviderIdentityBase<TService> & {
  artifactDir: string
  status: 'succeeded' | 'missing' | 'failed' | 'skipped'
  attempts: number
  lastError?: TError | undefined
}

export type ProviderErrorSummaryFields = {
  message: string
  stage?: string | undefined
  status?: number | undefined
  retryAfterMs?: number | undefined
  errorFile?: string | undefined
  rawResponseFile?: string | undefined
}


export type OcrStep2ResolutionOptions = Pick<
  RuntimeOptions,
  | 'useTesseract'
  | 'step2SelectionOrigins'
  | 'mistralOcrModel'
  | 'mistralOcrModels'
  | 'glmOcrModel'
  | 'glmOcrModels'
  | 'kimiOcrModel'
  | 'kimiOcrModels'
  | 'openaiOcrModel'
  | 'openaiOcrModels'
  | 'grokOcrModel'
  | 'grokOcrModels'
  | 'anthropicOcrModel'
  | 'anthropicOcrModels'
  | 'geminiOcrModel'
  | 'geminiOcrModels'
  | 'deepinfraOcrModel'
  | 'deepinfraOcrModels'
  | 'useEpubBun'
  | 'useEpubCalibre'
  | 'urlBackend'
  | 'urlBackendExplicit'
  | 'urlBackends'
> & {
  preparedMarkdown?: string | undefined
  localHtmlDocument?: boolean | undefined
}

export type SttStep2ResolutionOptions = Pick<
  RuntimeOptions,
  | 'useReverb'
  | 'step2SelectionOrigins'
  | 'whisperModel'
  | 'whisperModels'
  | 'deepinfraSttModel'
  | 'deepinfraSttModels'
  | 'deepgramSttModel'
  | 'deepgramSttModels'
  | 'sonioxSttModel'
  | 'sonioxSttModels'
  | 'speechmaticsSttModel'
  | 'speechmaticsSttModels'
  | 'revSttModel'
  | 'revSttModels'
  | 'groqSttModel'
  | 'groqSttModels'
  | 'grokSttModel'
  | 'grokSttModels'
  | 'mistralSttModel'
  | 'mistralSttModels'
  | 'assemblyaiSttModel'
  | 'assemblyaiSttModels'
  | 'gladiaSttModel'
  | 'gladiaSttModels'
  | 'happyscribeSttModel'
  | 'happyscribeSttModels'
  | 'supadataSttModel'
  | 'supadataSttModels'
  | 'scrapecreatorsSttModel'
  | 'scrapecreatorsSttModels'
>
