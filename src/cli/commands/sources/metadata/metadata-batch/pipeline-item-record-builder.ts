import { basename } from 'node:path'
import type { BatchItem, PipelineItemRecord } from '~/types'
import { isLikelyUrl } from '../metadata-targets/metadata-input-classifier'

export const buildPipelineItemRecord = (
  item: string,
  batchItem?: BatchItem
): PipelineItemRecord => {
  if (batchItem) {
    return {
      url: batchItem.url,
      title: batchItem.title ?? 'Untitled',
      channel: batchItem.author ?? 'Unknown',
      duration: batchItem.duration ?? 'Unknown',
      ...(batchItem.publishedAt ? { publishedAt: batchItem.publishedAt } : {}),
      ...(batchItem.description ? { description: batchItem.description } : {})
    }
  }

  const isUrl = isLikelyUrl(item)
  const title = basename(item).replace(/\.[^.]+$/, '')
  if (isUrl) {
    return { url: item, title, channel: 'URL', duration: 'Unknown' }
  }

  return { url: 'file://' + item, title, channel: 'Local', duration: 'Unknown' }
}
