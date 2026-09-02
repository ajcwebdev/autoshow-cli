import type { ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, LlmModel, LocationPromotionTransactionBoundary, LocationPromotionTransactionRecord, LocationReferenceCatalog, LocationReferenceEntry, LocationSketchManifest, LocationSketchRegistration, LocationSketchViewRegistration, LocationView, LocationViewLineage, ReferenceSketchCommandOptions } from '~/types'

export type LocationViewQaResult = {
  pass: boolean
  stableFeaturesMatch: boolean
  crossViewGeometryMatch: boolean
  requestedAngleMatch: boolean
  materiallyDistinctFromExistingViews: boolean
  houseStyleMatch: boolean
  noPeople: boolean
  noCopiedStyleContent: boolean
  failedChecks: string[]
  editInstructions: string
  summary: string
}

export type LocationReferenceCommandDependencies = {
  aggregateSpecification?: (input: { key: string; scripts: Array<{ path: string; content: string }>; model: string }) => Promise<{ name: string; specification: string }>
  requestImage?: typeof import('~/cli/commands/process-steps/step-8-comic/comic-image-services/comic-image-targets').createImage
  writeImage?: typeof import('~/cli/commands/process-steps/step-8-comic/comic-image-services/image-writer').writeGeneratedImage
  promoteImage?: (stagedPath: string, targetPath: string) => Promise<void>
  judgeView?: (input: LocationViewJudgeInput) => Promise<LocationViewQaResult>
  generationId?: () => string
  injectPromotionFault?: (boundary: LocationPromotionTransactionBoundary, transaction: Readonly<LocationPromotionTransactionRecord>) => void | Promise<void>
}

export type LocationViewJudgeInput = {
  imagePath: string
  view: LocationView
  specification: string
  existingViewPaths: string[]
  styleReference: string
  model: string
  cameraFacts?: string | undefined
}

export type LocationViewAnchorProjection = {
  key: string
  projection: string
  establishingProjection: string
  inFrame: boolean
}

export type LocationViewCameraFacts = {
  view: LocationView
  cameraCell: { id: string; position: { x: number; y: number }; heightM: number; synthetic: boolean }
  target: { x: number; y: number }
  headingDeg: number
  anchors: LocationViewAnchorProjection[]
  text: string
}

export type ResolvedLocationReferenceRequest = {
  key: string
  view: LocationView
  model: ImageGenerationModel
  size: ImageGenerationSize
  quality: ImageGenerationQuality
  revise: boolean
  notes?: string
  qaEnabled: boolean
  maxRepairs: number
  aggregationModel: LlmModel
  qaModel: LlmModel
  concurrency: number
  hostedConcurrencyCoordinator?: ReferenceSketchCommandOptions['hostedConcurrencyCoordinator']
}

type ExistingLocationView = LocationSketchViewRegistration & { imagePath: string }

export type LocationReferenceContext = {
  kind: 'ready'
  catalog: LocationReferenceCatalog
  manifest: LocationSketchManifest
  entry: LocationReferenceEntry
  prior?: LocationSketchRegistration
  priorTarget?: LocationSketchViewRegistration
  stylePath: string
  otherExisting: ExistingLocationView[]
  freshReferences: string[]
  cameraFacts?: LocationViewCameraFacts
  lineage: LocationViewLineage
}

export type LocationReferencePreparation = { kind: 'noop' } | LocationReferenceContext

export type LocationViewQaReport = {
  view: LocationView
  attempt: number
  retryMode: 'fresh' | 'edit'
  result?: LocationViewQaResult
  error?: string
}

export type LocationViewGeneration = {
  generationId: string
  attemptsRoot: string
  stagedImagePath: string
}
