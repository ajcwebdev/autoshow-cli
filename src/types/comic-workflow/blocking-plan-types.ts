import type * as v from 'valibot'
import type { CharacterCatalogService, HostedConcurrencyRuntimeOptions, LlmModel, StructuredScriptData } from '~/types'

type BlockingSchemas = typeof import('~/cli/commands/process-steps/step-8-comic/schemas/blocking-plan-schemas')

export type BlockingPlan = v.InferOutput<BlockingSchemas['BlockingPlanSchema']>
export type BlockingPlanDraft = v.InferOutput<BlockingSchemas['BlockingPlanDraftSchema']>
export type BlockingLocationMap = BlockingPlan['locations'][number]
export type BlockingAnchor = v.InferOutput<BlockingSchemas['BlockingAnchorSchema']>
export type BlockingSuppressedAnchor = v.InferOutput<BlockingSchemas['BlockingSuppressedAnchorSchema']>
export type BlockingDressingItem = v.InferOutput<BlockingSchemas['BlockingDressingItemSchema']>
export type BlockingCameraCell = v.InferOutput<BlockingSchemas['BlockingCameraCellSchema']>
export type BlockingStageState = v.InferOutput<BlockingSchemas['BlockingStageStateSchema']>
export type BlockingCharacterMark = v.InferOutput<BlockingSchemas['BlockingCharacterMarkSchema']>
export type BlockingExtrasRegion = v.InferOutput<BlockingSchemas['BlockingExtrasRegionSchema']>
export type BlockingActionAxis = v.InferOutput<BlockingSchemas['BlockingActionAxisSchema']>
export type BlockingMove = v.InferOutput<BlockingSchemas['BlockingMoveSchema']>
export type BlockingCameraSetup = v.InferOutput<BlockingSchemas['BlockingCameraSetupSchema']>
export type BlockingCitation = v.InferOutput<BlockingSchemas['BlockingCitationSchema']>
export type BlockingPosition = v.InferOutput<BlockingSchemas['BlockingPositionSchema']>
export type BlockingFootprint = v.InferOutput<BlockingSchemas['BlockingFootprintSchema']>
export type BlockingRegion = v.InferOutput<BlockingSchemas['BlockingRegionSchema']>
export type BlockingBindings = v.InferOutput<BlockingSchemas['BlockingBindingsSchema']>
export type BlockingBindingsPanel = v.InferOutput<BlockingSchemas['BlockingBindingsPanelSchema']>
export type PanelBlockingCitation = v.InferOutput<BlockingSchemas['PanelBlockingCitationSchema']>
export type CompiledPanelBlocking = v.InferOutput<BlockingSchemas['CompiledPanelBlockingSchema']>
export type CompiledBlockingLedgerEntry = v.InferOutput<BlockingSchemas['CompiledBlockingLedgerEntrySchema']>
export type CompiledBlockingLines = CompiledPanelBlocking['lines']
export type BlockingLocationPlansRecord = v.InferOutput<BlockingSchemas['BlockingLocationPlansRecordSchema']>
export type BlockingLocationPlanEntry = v.InferOutput<BlockingSchemas['BlockingLocationPlanEntrySchema']>
export type BlockingLocationPlanAnchor = v.InferOutput<BlockingSchemas['BlockingLocationPlanAnchorSchema']>

export type BlockingPosture = BlockingSchemas['BLOCKING_POSTURES'][number]
export type BlockingLens = BlockingSchemas['BLOCKING_LENSES'][number]
export type BlockingFraming = BlockingSchemas['BLOCKING_FRAMINGS'][number]
export type BlockingElevation = BlockingSchemas['BLOCKING_ELEVATIONS'][number]
export type BlockingMoveType = BlockingSchemas['BLOCKING_MOVE_TYPES'][number]
export type BlockingWall = BlockingSchemas['BLOCKING_WALLS'][number]
export type BlockingAuditStatus = BlockingSchemas['BLOCKING_AUDIT_STATUSES'][number]
export type BlockingHardCandidateStatus = BlockingSchemas['BLOCKING_HARD_CANDIDATE_STATUSES'][number]
export type BlockingScreenSide = BlockingSchemas['BLOCKING_SCREEN_SIDES'][number]
export type BlockingDepthBand = BlockingSchemas['BLOCKING_DEPTH_BANDS'][number]
export type BlockingFacing = BlockingSchemas['BLOCKING_FACINGS'][number]
export type BlockingFrameStatus = BlockingSchemas['BLOCKING_FRAME_STATUSES'][number]
export type BlockingAxisSide = BlockingSchemas['BLOCKING_AXIS_SIDES'][number]
export type BlockingSeenFrom = BlockingSchemas['BLOCKING_SEEN_FROM'][number]
export type BlockingRegisteredView = BlockingSchemas['BLOCKING_REGISTERED_VIEWS'][number]

export type BlockingVector = { x: number; y: number }

export type BlockingCameraBasis = { forward: BlockingVector; right: BlockingVector }

export type BlockingPointProjection = { forward: number; lateral: number; inFrame: BlockingFrameStatus }

export type BlockingAnchorProjection = {
  screenSide: BlockingScreenSide
  depthBand: BlockingDepthBand
  seenFrom: BlockingSeenFrom
  projection: string
}

export type BlockingCameraLike = Pick<BlockingCameraSetup, 'position' | 'target' | 'lens'>

export type BlockingValidationIssue = { code: string; message: string; path: string }

export type BlockingScenePanelInput = {
  number: number
  characterKeys: readonly string[]
  sourceSegmentIds: readonly string[]
  locationKey: string
  blocking?: PanelBlockingCitation | undefined
}

export type BlockingLocationSpecification = { key: string; name?: string | undefined; specification: string }

export type BlockingValidationContext = {
  structuredScript: Pick<StructuredScriptData, 'sourceSegments'> & Partial<Pick<StructuredScriptData, 'beats' | 'scene'>>
  locationSpecifications: Readonly<Record<string, BlockingLocationSpecification>>
  catalog: Pick<CharacterCatalogService, 'characterKeys' | 'detectMentions'>
  locationPlans?: BlockingLocationPlansRecord | undefined
}

export type BlockingScenePanelValidationOptions = {
  segmentOrder?: readonly string[] | undefined
  bindings?: BlockingBindings | undefined
}

export type BlockingRebindResult = {
  plan: BlockingPlan
  remapped: Array<{ path: string; from: string; to: string }>
  unresolved: Array<{ path: string; sourceSegmentId: string; sourceSegmentSha256: string; reason: string }>
}

export type BlockingRebindOptions = {
  previousStructuredScript?: Pick<StructuredScriptData, 'sourceSegments'> | undefined
  structuredScriptSha256?: string | undefined
  catalog?: Pick<CharacterCatalogService, 'detectMentions'> | undefined
}

export type BlockingCompileOptions = {
  planSha256?: string | undefined
  segmentOrder?: readonly string[] | undefined
}

export type BlockingPanelSvg = { panelNumber: number; svg: string }
export type BlockingPanelLayoutGuide = { panelNumber: number; png: Uint8Array }

export type SceneBlockingCompilation = {
  planSha256: string
  panels: CompiledPanelBlocking[]
  ledgerMarkdown: string
  planOverviewSvg: string
  panelSvgs: BlockingPanelSvg[]
  panelLayoutGuides: BlockingPanelLayoutGuide[]
}

export type BlockingBracketNoteKind = 'BLOCKING' | 'CAMERA' | 'AXIS BREAK'

export type BlockingBracketNote = { sourceSegmentId: string; kind: BlockingBracketNoteKind; text: string }

export type BlockingDrafterLocationInput = {
  key: string
  name: string
  specification: string
  fixedAnchorSentence: string | null
  geometry?: BlockingLocationPlanEntry | undefined
}

export type BlockingDrafterCharacterInput = {
  key: string
  name: string
  description: string
  aliases?: readonly string[] | undefined
  variantOf?: string | undefined
  distinguishFrom?: ReadonlyArray<{ characterKey: string; cue: string }> | undefined
  wardrobe?: { colorTokens: readonly string[]; never?: readonly string[] | undefined; deviationStates?: ReadonlyArray<{ state: string; variantKey?: string | undefined; description: string }> | undefined } | undefined
}

export type BlockingDrafterBindPanelInput = {
  number: number
  description: string
  shotPlan: string
  characterKeys: readonly string[]
  sourceSegmentIds: readonly string[]
  locationKey: string
}

export type BlockingDrafterPromptInputs = {
  sceneSlug: string
  sceneTitle?: string | undefined
  segments: ReadonlyArray<Pick<StructuredScriptData['sourceSegments'][number], 'id' | 'type' | 'text' | 'speakerLabel' | 'location'>>
  locations: readonly BlockingDrafterLocationInput[]
  characters: readonly BlockingDrafterCharacterInput[]
  panelNotes?: readonly BlockingBracketNote[] | undefined
  bindPanels?: readonly BlockingDrafterBindPanelInput[] | undefined
  validationErrors?: readonly string[] | undefined
}

export type BlockingPlanRequest = {
  prompt: string
  imagePaths: readonly string[]
  schemaName: string
  jsonSchema: Record<string, unknown>
  model: LlmModel
  attempt: number
  sceneSlug: string
}

export type BlockingPlanResponse = {
  text: string
  inputTokens?: number | undefined
  outputTokens?: number | undefined
  returnedModel?: string | undefined
}

export type GenerateBlockingPlanOptions = HostedConcurrencyRuntimeOptions & {
  model: LlmModel
  concurrency?: number | undefined
  importPath?: string | undefined
  bind?: boolean | undefined
  locationPlans?: BlockingLocationPlansRecord | undefined
  requestPlan?: ((request: BlockingPlanRequest) => Promise<BlockingPlanResponse>) | undefined
  requireEstablishingImages?: boolean | undefined
}

export type GenerateBlockingPlanResult = {
  mode: 'llm' | 'import'
  bind: boolean
  planPath: string
  bindingsPath: string | null
  plan: BlockingPlan
  bindings: BlockingBindings | null
  attempts: number
  stats: { filesProcessed: number; totalInputTokens: number; totalOutputTokens: number; totalCachedTokens: number; totalCost: number; totalDurationMs: number }
}

export type BlockingPlanCallEstimate = {
  maxCalls: number
  outputUnitsPerCall: number
  inputUnitsPerCall: number
  imageInputUnitsPerCall: number
  locationCount: number
  segmentCount: number
}

export type BlockingPlanInputs = {
  sceneSlug: string
  structuredScript: StructuredScriptData
  structuredScriptSha256: string
  catalog: CharacterCatalogService
  locationKeys: string[]
  locations: BlockingDrafterLocationInput[]
  locationSpecifications: Record<string, BlockingLocationSpecification>
  establishingImages: Array<{ locationKey: string; path: string }>
  locationPlans: BlockingLocationPlansRecord | undefined
}
