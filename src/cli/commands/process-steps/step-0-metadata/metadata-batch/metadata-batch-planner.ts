import * as l from '~/utils/app-logger/app-logger'
import { isExtractCommand, usesExtractInputRouting } from '~/cli/commands/process-steps/process-command-kinds'
import type { BatchItem, PipelineItemRecord, PlannedBatchInput, ProcessCommand, ProcessPlanningOptions } from '~/types'
import { buildPipelineItemRecord } from './pipeline-item-record-builder'
import { describeUnsupportedInputForCommand, resolveInputRoutingForCommand } from '../metadata-targets/metadata-input-routing'

export const planBatchInputsForCommand = async (
  command: ProcessCommand,
  items: string[],
  opts: ProcessPlanningOptions,
  selectedItems?: Array<BatchItem | undefined>,
  logSkips = true
): Promise<{
  items: string[]
  selectedItems?: Array<BatchItem | undefined>
  initialRecords: PipelineItemRecord[]
  resultEntryIndexes: number[]
  plannedInputs: PlannedBatchInput[]
}> => {
  if (command === 'write' && opts.textInput) {
    return {
      items,
      ...(selectedItems ? { selectedItems } : {}),
      initialRecords: items.map((item, index) => ({
        ...buildPipelineItemRecord(item, selectedItems?.[index]),
        sourceKind: 'text-input'
      })),
      resultEntryIndexes: items.map((_, index) => index),
      plannedInputs: items.map((item, index) => ({
        input: item,
        inputFamily: 'unsupported',
        resolvedStep2: {
          route: 'unsupported',
          sourceKind: 'unsupported'
        },
        ...(selectedItems?.[index] ? { batchItem: selectedItems[index] } : {})
      }))
    }
  }

  const shouldResolveRouting = usesExtractInputRouting(command)
  if (!shouldResolveRouting) {
    return {
      items,
      ...(selectedItems ? { selectedItems } : {}),
      initialRecords: items.map((item, index) => buildPipelineItemRecord(item, selectedItems?.[index])),
      resultEntryIndexes: items.map((_, index) => index),
      plannedInputs: items.map((item, index) => ({
        input: item,
        inputFamily: 'unsupported',
        resolvedStep2: {
          route: 'unsupported',
          sourceKind: 'unsupported'
        },
        ...(selectedItems?.[index] ? { batchItem: selectedItems[index] } : {})
      }))
    }
  }

  const filteredItems: string[] = []
  const filteredSelectedItems: Array<BatchItem | undefined> = []
  const initialRecords: PipelineItemRecord[] = []
  const resultEntryIndexes: number[] = []
  const plannedInputs: PlannedBatchInput[] = []

  for (const [index, item] of items.entries()) {
    const batchItem = selectedItems?.[index]
    const routing = await resolveInputRoutingForCommand(command, item, opts)
    const recordBase = {
      ...buildPipelineItemRecord(item, batchItem),
      ...(routing.family !== 'unsupported' ? { inputFamily: routing.family } : {}),
      step2Route: routing.step2Route,
      resolvedStep2: routing.resolvedStep2,
      ...(routing.extractRoute ? { extractRoute: routing.extractRoute } : {})
    }
    plannedInputs.push({
      input: item,
      inputFamily: routing.family,
      resolvedStep2: routing.resolvedStep2,
      ...(routing.extractRoute ? { extractRoute: routing.extractRoute } : {}),
      ...(batchItem ? { batchItem } : {})
    })

    if (!routing.supported) {
      const reason = routing.skipReason ?? describeUnsupportedInputForCommand(command, routing.family)
      if (logSkips && isExtractCommand(command)) {
        l.warn(`Skipping ${routing.family} input in ${command} batch: ${item} (${reason})`, {
      category: 'pipeline',
      metadata: { command, family: routing.family, item, reason }
    })
      }
      initialRecords.push({
        ...recordBase,
        completionStatus: 'skipped',
        inputFamily: routing.family,
        skipReason: reason
      })
      continue
    }

    initialRecords.push(recordBase)
    resultEntryIndexes.push(initialRecords.length - 1)
    filteredItems.push(item)
    if (batchItem) {
      filteredSelectedItems.push(batchItem)
    }
  }

  return {
    items: filteredItems,
    ...(selectedItems ? { selectedItems: filteredSelectedItems } : {}),
    initialRecords,
    resultEntryIndexes,
    plannedInputs
  }
}
