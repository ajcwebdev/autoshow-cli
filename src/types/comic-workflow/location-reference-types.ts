export type LocationView = (typeof import('~/cli/commands/process-steps/step-8-comic/comic-utils/location-reference').LOCATION_VIEWS)[number]

export type LocationReferenceEntry = {
  key: string
  name: string
  aliases?: string[]
  referenceDirectory?: string
  referenceFilename?: string
  specification: string
  sourceScripts: string[]
}

export type LocationReferenceCatalog = {
  schemaVersion: 1
  styleImage: string
  locations: LocationReferenceEntry[]
}

export type LocationSketchViewRegistration = {
  view: LocationView
  generationId: string
  image: string
  imageSha256: string
  model: string
  createdAt: string
  priorGenerationId?: string
}

export type LocationSketchRegistration = {
  locationKey: string
  specificationSha256: string
  views: LocationSketchViewRegistration[]
}

export type LocationSketchManifest = { schemaVersion: 2; sketches: LocationSketchRegistration[] }

export type CurrentLocationReference = {
  entry: LocationReferenceEntry
  registration: LocationSketchRegistration
  views: Array<LocationSketchViewRegistration & { imagePath: string }>
  sheetPath: string
}

export type LocationReferenceSnapshot = {
  schemaVersion: 2
  snapshotId: string
  locationKey: string
  specification: string
  sourceScripts: string[]
  sourceViews: Array<{ view: LocationView; generationId: string; imageSha256: string }>
  sheet: { path: string; sha256: string }
}

export type LocationReferenceSnapshotManifest = { schemaVersion: 2; snapshots: LocationReferenceSnapshot[] }
