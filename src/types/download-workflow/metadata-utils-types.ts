import type { FileFingerprint, VideoMetadata } from '~/types'

export type LocalFileMetadataCacheEntry = {
  data: VideoMetadata
  fingerprint: FileFingerprint
}
