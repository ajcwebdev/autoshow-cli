import type { DirectoryEntry } from '../runtime-core/filesystem-types'
import type { LocationView, PanelBundleData } from '~/types'

export type PanelPrimaryReferenceInput = {
  panelDirectory: string
  entries: DirectoryEntry[]
  bundleData: PanelBundleData
}

export type ResolvedLocationReferenceView = {
  view: LocationView
  path: string
  label: string
}

export type ResolvedLocationReference = {
  key: string
  snapshotId: string
  specification: string
  path: string
  view: LocationView
  views: ResolvedLocationReferenceView[]
}

export type ResolveLocationReferenceOptions = {
  cameraMatched?: boolean | undefined
}
