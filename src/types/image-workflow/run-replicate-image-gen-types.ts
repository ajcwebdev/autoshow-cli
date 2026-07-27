import type { Step5Metadata } from '~/types'

export type ReplicateImageRequestMode = Step5Metadata['requestMode']

export type ReplicateImageSize = {
  requestValue?: string | undefined
  width?: number | undefined
  height?: number | undefined
  metadataValue?: string | undefined
}
