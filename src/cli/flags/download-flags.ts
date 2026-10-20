import { articleFlags, batchFlags, priceFlag } from './shared-flags'
import { boolFlag, strFlag, withHelpGroup } from './flag-utils'
import type { CliFlagsDefinition } from '~/types'
import { DEFAULT_DOWNLOAD_MEDIA_QUALITY, DOWNLOAD_MEDIA_QUALITIES } from './download-media-quality-contract'

const downloadDocumentFlags = {
  password: strFlag('Password for encrypted PDFs')
} as const satisfies CliFlagsDefinition

const mediaDownloadFlags = {
  'media-quality': strFlag(`Media preparation: ${DOWNLOAD_MEDIA_QUALITIES.join('|')}; audio creates compressed audio, original keeps source audio/media, best selects the best video+audio where available and keeps source media`, DEFAULT_DOWNLOAD_MEDIA_QUALITY),
  'keep-original-media': { ...boolFlag('Compatibility alias for --media-quality original; cannot combine with --media-quality'), help: { hidden: true } },
  'best-quality': { ...boolFlag('Compatibility alias for --media-quality best; cannot combine with --media-quality'), help: { hidden: true } },
  'flat-batch': boolFlag('Batch media downloads: place primary media files directly in the batch output directory; otherwise use one subdirectory per item')
} as const satisfies CliFlagsDefinition

export const downloadFlags = {
  ...withHelpGroup(downloadDocumentFlags, 'document-options'),
  ...withHelpGroup(mediaDownloadFlags, 'media-download'),
  ...withHelpGroup(articleFlags, 'article-extraction'),
  ...withHelpGroup(batchFlags, 'batch-processing'),
  ...withHelpGroup(priceFlag, 'pricing'),
} as const satisfies CliFlagsDefinition
