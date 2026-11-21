import type { ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, LlmModel, LocationPromotionTransactionBoundary, LocationPromotionTransactionRecord, LocationReferenceCatalog, LocationReferenceEntry, LocationSketchManifest, LocationSketchRegistration, LocationSketchViewRegistration, LocationView, LocationViewLineage, ReferenceSketchCommandOptions } from '~/types'

export type LocationReferenceCommandDependencies = {
  aggregateSpecification?: (input: { key: string; scripts: Array<{ path: string; content: string }>; model: string }) => Promise<{ name: string; specification: string }>
  requestImage?: typeof import('~/cli/commands/visuals/comic/comic-image-services/comic-image-targets').createImage
  writeImage?: typeof import('~/cli/commands/visuals/comic/comic-image-services/image-writer').writeGeneratedImage
  promoteImage?: (stagedPath: string, targetPath: string) => Promise<void>
  generationId?: () => string
  injectPromotionFault?: (boundary: LocationPromotionTransactionBoundary, transaction: Readonly<LocationPromotionTransactionRecord>) => void | Promise<void>
}

export type ResolvedLocationReferenceRequest = {
  key: string
  view: LocationView
  model: ImageGenerationModel
  size: ImageGenerationSize
  quality: ImageGenerationQuality
  revise: boolean
  notes?: string
  aggregationModel: LlmModel
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
  lineage: LocationViewLineage
}

export type LocationReferencePreparation = { kind: 'noop' } | LocationReferenceContext

export type LocationViewGeneration = {
  generationId: string
  attemptsRoot: string
  stagedImagePath: string
}
