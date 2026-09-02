import type { LocationReferenceCatalog, LocationReferenceEntry, LocationSketchManifest, LocationSketchRegistration, LocationSketchViewRegistration, LocationView, LocationViewLineage } from '~/types'

export type LocationPromotionTransactionBoundary = (typeof import('~/cli/commands/process-steps/step-8-comic/comic-commands/reference-sketch/location-reference-transaction').LOCATION_PROMOTION_TRANSACTION_BOUNDARIES)[number]

export type LocationPromotionFileRecord = {
  path: string
  backupPath: string
  existed: boolean
  backupCreated: boolean
  promoted: boolean
}

export type LocationPromotionTransactionRecord = {
  id: string
  stagedImagePath: string
  attemptsRoot: string
  priorImage?: LocationPromotionFileRecord
  image: LocationPromotionFileRecord
  catalog: LocationPromotionFileRecord & { temporaryPath: string }
  manifest: LocationPromotionFileRecord & { temporaryPath: string }
}

export type PromoteLocationRegistrationInput = {
  key: string
  view: LocationView
  model: string
  entry: LocationReferenceEntry
  catalog: LocationReferenceCatalog
  manifest: LocationSketchManifest
  prior?: LocationSketchRegistration
  priorTarget?: LocationSketchViewRegistration
  generationId: string
  attemptsRoot: string
  stagedImagePath: string
  lineage?: LocationViewLineage
  promoteImage?: (stagedPath: string, targetPath: string) => Promise<void>
  injectFault?: (boundary: LocationPromotionTransactionBoundary, transaction: Readonly<LocationPromotionTransactionRecord>) => void | Promise<void>
}
