import * as l from '~/utils/app-logger/app-logger'
import type { ProcessCommand, ProcessPlanningOptions, ResolvedBatch } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { readInputList } from '../metadata-targets/metadata-input-collection'
import { resolveListBatchItems } from './metadata-list-batch-resolver'

export const resolveInputListBatch = async (
  resolvedTarget: string,
  command: ProcessCommand,
  opts: ProcessPlanningOptions
): Promise<ResolvedBatch> => {
  l.write('info', `Reading inputs from ${resolvedTarget}`, { category: 'pipeline', metadata: { target: resolvedTarget } })
  const items = await readInputList(resolvedTarget)
  if (items.length === 0) {
    throw UsageError(`No valid inputs found in ${resolvedTarget}. Provide newline-delimited URLs or local file paths in a .md or .txt file.`)
  }

  return await resolveListBatchItems(items, resolvedTarget, command, opts)
}
