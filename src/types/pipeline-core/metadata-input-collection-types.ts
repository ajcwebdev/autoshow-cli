import type { FileFingerprint } from '~/types'

export type MetadataTopLevelTargetKind = 'directory' | 'input_list' | 'single'

export type MetadataTopLevelTargetInfo = {
  kind: MetadataTopLevelTargetKind
  exists: boolean
  isDirectory: boolean
  isFile: boolean
}

export type BatchListCacheEntry = {
  items: string[]
  fingerprint: FileFingerprint
}
