import type { BatchItem, ProcessCommand, ProcessPlanningOptions, ResolvedBatch } from '~/types'
import { selectBatchItems } from '../metadata-batch/metadata-batch-select'
import { tryResolveBatchSource } from '../metadata-batch/metadata-batch-router'

const buildInputListBatchItems = (items: string[]): BatchItem[] =>
  items.map((item, index) => ({
    id: String(index + 1),
    url: item
  }))

export const resolveListBatchItems = async (
  items: string[],
  sourceUrl: string,
  command: ProcessCommand,
  opts: ProcessPlanningOptions
): Promise<ResolvedBatch> => {
  const batchOpts = {
    limit: opts.batchLimit,
    order: opts.batchOrder
  }

  const selectedListItems = selectBatchItems(buildInputListBatchItems(items), batchOpts)
  const flattenedLeafItems = (await Promise.all(selectedListItems.map(async (item) => {
    const resolved = await tryResolveBatchSource(item.url, command, opts)
    return resolved?.selectedItems.length ? resolved.selectedItems : [item]
  }))).flat()

  return {
    source: {
      sourceKind: 'url_list',
      sourceUrl,
      title: 'Input list',
      items: flattenedLeafItems
    },
    selectedUrls: flattenedLeafItems.map(item => item.url),
    selectedItems: flattenedLeafItems,
    totalCount: flattenedLeafItems.length
  }
}
