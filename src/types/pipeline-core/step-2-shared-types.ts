import type { CliFlagDefinition, HtmlArticleBackend, OcrRuntimeOptions, ProviderIdentityBase, Step2Modality, Step2ProviderSelectionOrigin, SttRuntimeOptions } from '~/types'
import type { STEP2_OCR_PROVIDER_REGISTRY } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry/ocr-providers'
import type { STEP2_STT_PROVIDER_REGISTRY } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry/stt-providers'

export type Step2ProviderOptionSurface = SttRuntimeOptions & OcrRuntimeOptions

type RegistrySelectionOptionKey<Entry> = Entry extends {
  selection: infer Selection
}
  ? Selection extends { type: 'boolean', runtimeKey: infer Key extends keyof Step2ProviderOptionSurface }
    ? Key
    : Selection extends {
      type: 'models'
      runtimeModelsKey: infer ModelsKey extends keyof Step2ProviderOptionSurface
      runtimeModelKey: infer ModelKey extends keyof Step2ProviderOptionSurface
    }
      ? ModelsKey | ModelKey
      : never
  : never

type RegistryModelOptionKey<Entry> = Entry extends {
  selection: {
    type: 'models'
    runtimeModelKey: infer Key extends keyof Step2ProviderOptionSurface
  }
} ? Key : never

type SttRegistryEntry = typeof STEP2_STT_PROVIDER_REGISTRY[number]
type OcrRegistryEntry = typeof STEP2_OCR_PROVIDER_REGISTRY[number]

export type SttSelectionOptions = Partial<Pick<
  Step2ProviderOptionSurface,
  RegistrySelectionOptionKey<SttRegistryEntry>
>> & Step2SelectionOriginOptions

export type OcrSelectionOptions = Partial<Pick<
  Step2ProviderOptionSurface,
  RegistrySelectionOptionKey<OcrRegistryEntry>
>> & Step2SelectionOriginOptions

export type OcrModelOverrideOptions = Partial<Pick<
  Step2ProviderOptionSurface,
  RegistryModelOptionKey<OcrRegistryEntry>
>>

export type Step2SelectionOriginOptions = {
  step2SelectionOrigins?: Partial<Record<string, Step2ProviderSelectionOrigin>> | undefined
}

export type UrlSelectionOptions = Step2SelectionOriginOptions & {
  urlBackend: HtmlArticleBackend
  urlBackendExplicit: boolean
  urlBackends: HtmlArticleBackend[] | undefined
}


export type ResolvedStep2Provider = ProviderIdentityBase & {
  origin?: Step2ProviderSelectionOrigin | undefined
}

export type Step2ShortcutFlag = 'all-stt' | 'all-local-stt' | 'all-ocr' | 'all-local-ocr' | 'all-url' | 'all-local-url'
export type Step2Command = 'stt' | 'ocr' | 'url'
export type Step2BooleanSelectionKey = 'useTesseract'

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
    runtimeModelsKey: keyof Step2ProviderOptionSurface
    runtimeModelKey: keyof Step2ProviderOptionSurface
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
  status: 'running' | 'succeeded' | 'missing' | 'failed' | 'skipped'
  attempts: number
  metadata?: Record<string, unknown> | undefined
  result?: Record<string, unknown> | undefined
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


export type OcrStep2ResolutionOptions = OcrSelectionOptions & Partial<UrlSelectionOptions> & {
  preparedMarkdown?: string | undefined
  localHtmlDocument?: boolean | undefined
}

export type SttStep2ResolutionOptions = SttSelectionOptions
