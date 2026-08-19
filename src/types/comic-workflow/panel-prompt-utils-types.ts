import type { Dirent } from 'node:fs'
import type { PanelBundleData } from '~/types'

export type PanelPrimaryReferenceInput = {
  panelDirectory: string
  entries: Dirent[]
  bundleData: PanelBundleData
}

export type ResolvedLocationReference = {
  key: string
  snapshotId: string
  specification: string
  path: string
}
