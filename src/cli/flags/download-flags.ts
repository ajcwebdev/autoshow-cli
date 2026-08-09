import { articleFlags, batchFlags, priceFlag } from './shared-flags'
import { boolFlag, strFlag, withHelpGroup } from './flag-utils'
import type { CliFlagsDefinition } from '~/types'

const downloadDocumentFlags = {
  password: strFlag('Password for encrypted PDFs')
} as const satisfies CliFlagsDefinition

const mediaDownloadFlags = {
  'keep-original-media': boolFlag('Keep downloaded media in its original/downloaded format instead of creating the normalized compressed audio artifact'),
  'best-quality': boolFlag('Download the best available video+audio media and skip audio-only normalization'),
  'flat-batch': boolFlag('Batch download: place primary media files directly in the batch output directory')
} as const satisfies CliFlagsDefinition

export const downloadFlags = {
  ...withHelpGroup(downloadDocumentFlags, 'document-options'),
  ...withHelpGroup(mediaDownloadFlags, 'media-download'),
  ...withHelpGroup(articleFlags, 'article-extraction'),
  ...withHelpGroup(batchFlags, 'batch-processing'),
  ...withHelpGroup(priceFlag, 'pricing'),
} as const satisfies CliFlagsDefinition
