import type { DirectoryEntry } from '../runtime-core/filesystem-types'
import type { PanelBundleData } from '~/types'

export type PanelPrimaryReferenceInput = {
  panelDirectory: string
  entries: DirectoryEntry[]
  bundleData: PanelBundleData
}

export type ResolvedLocationReference = {
  key: string
  snapshotId: string
  specification: string
  path: string
}
