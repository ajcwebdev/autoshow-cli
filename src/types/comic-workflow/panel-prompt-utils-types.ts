import type { Dirent } from 'node:fs'
import type { PanelBundleData } from '~/types'

export type PanelPrimaryReferenceInput = {
  panelDirectory: string
  entries: Dirent[]
  bundleData: PanelBundleData
}

export type ResolveReferenceImagesOptions = {
  includePriorPanelRefs?: boolean
  includeSecondaryRefs?: boolean
}
