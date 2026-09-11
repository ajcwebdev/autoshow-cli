import type * as v from 'valibot'
import type { CharacterReferenceConfig, HostedConcurrencyCoordinator, HostedConcurrencyMode, LlmModel, LocationReferenceCatalog, StructuredScriptData } from '~/types'

export type TreatmentCatalogPolicy = 'skip-existing' | 'fail'

export type TreatmentVoicePacing = 'exclusive' | 'mixed'

export type TreatmentPanelRange = {
  minimum: number
  maximum: number
}

export type TreatmentSourceKind = 'markdown' | 'text' | 'pdf'

export type TreatmentSource = {
  path: string
  kind: TreatmentSourceKind
  text: string
  title: string
  defaultSlug: string
  pageCount: number
}

export type TreatmentDraft = v.InferOutput<typeof import('~/cli/commands/visuals/comic/comic-commands/draft-treatment/treatment-schemas').TreatmentDraftSchema>

export type TreatmentDraftCharacter = TreatmentDraft['characters'][number]

export type TreatmentDraftLocation = TreatmentDraft['locations'][number]

export type TreatmentDraftPanel = TreatmentDraft['panels'][number]

export type TreatmentDraftRequest = {
  prompt: string
  schemaName: string
  jsonSchema: Record<string, unknown>
  model: LlmModel
  attempt: number
  slug: string
}

export type TreatmentDraftResponse = {
  text: string
  inputTokens?: number | undefined
  outputTokens?: number | undefined
  returnedModel?: string | undefined
}

export type ParsedDraftTreatmentArgs = {
  showHelp: boolean
  price?: boolean
  treatmentPath: string
  panelRange: TreatmentPanelRange
  voicePacing: TreatmentVoicePacing
  episode?: string
  scene: string
  slug?: string
  speakers: string[]
  styleSeed?: string
  catalogPolicy: TreatmentCatalogPolicy
  force?: boolean
  llmModel?: LlmModel
  concurrencyMode?: HostedConcurrencyMode
}

export type DraftTreatmentCommandOptions = Omit<ParsedDraftTreatmentArgs, 'showHelp' | 'price'> & {
  hostedConcurrencyCoordinator?: HostedConcurrencyCoordinator | undefined
  /** Internal override for tests; the CLI always writes under input/scripts. */
  scriptsRoot?: string | undefined
  requestDraft?: ((request: TreatmentDraftRequest) => Promise<TreatmentDraftResponse>) | undefined
}

export type TreatmentDraftValidationContext = {
  panelRange: TreatmentPanelRange
  voicePacing: TreatmentVoicePacing
  speakers: readonly string[]
  catalogPolicy: TreatmentCatalogPolicy
  existingCharacters: CharacterReferenceConfig
  existingLocations: LocationReferenceCatalog | undefined
}

export type TreatmentDroppedAlias = {
  key: string
  alias: string
  reason: string
}

export type TreatmentStyleImageAction = 'created' | 'set' | 'kept'

export type TreatmentCatalogMergeReport = {
  charactersAdded: string[]
  charactersSkipped: string[]
  droppedAliases: TreatmentDroppedAlias[]
  locationsAdded: string[]
  locationsSkipped: string[]
  styleImage: { action: TreatmentStyleImageAction; value: string }
}

export type TreatmentCatalogInputs = {
  charactersRoot: string
  characterConfigPath: string
  characters: CharacterReferenceConfig
  locationsRoot: string
  locationCatalogPath: string
  locations: LocationReferenceCatalog | undefined
}

export type TreatmentScriptRenderInput = {
  draft: TreatmentDraft
  episode: string
  sourceDisplayPath: string
  characterNames: ReadonlyMap<string, string>
  locationSluglines: ReadonlyMap<string, string>
}

export type DraftTreatmentResult = {
  scriptPath: string
  shorthand: string
  runDirectory: string
  attempts: number
  panelCount: number
  voiceSwitches: number
  report: TreatmentCatalogMergeReport
  structuredScript: StructuredScriptData
}
