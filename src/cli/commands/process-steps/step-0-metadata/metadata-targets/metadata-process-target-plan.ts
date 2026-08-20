import * as l from '~/utils/app-logger/app-logger'
import { CLIUsageError } from '~/utils/error-handler'
import type { BatchExecutionPlan, BatchItem, ProcessCommand, ProcessPlanningOptions, ResolvedBatch, ResolvedProcessTargetPlan } from '~/types'
import {
  classifyTopLevelTarget,
  collectInputFiles,
  isInputDirectoryPath,
  readInputList
} from './metadata-input-collection'
import { planBatchInputsForCommand } from '../metadata-batch/metadata-batch-planner'
import { resolveInputListBatch } from '../metadata-sources/metadata-url-list-target'
import { resolveListBatchItems } from '../metadata-sources/metadata-list-batch-resolver'
import { resolveYoutubeCollectionItems } from '../metadata-sources/metadata-youtube-collection-target'
import { tryResolveBatchSource } from '../metadata-batch/metadata-batch-router'
import { collectTextInputFiles, isTextInputPath } from '~/cli/commands/process-steps/step-3-write/text-input-utils'

export const resolveProcessTargetPlan = async (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: ProcessPlanningOptions
): Promise<ResolvedProcessTargetPlan> => {
  if (command === 'write' && opts.textInput) {
    if (/^https?:\/\//i.test(resolvedTarget)) {
      throw CLIUsageError('write --text-input only accepts local .md or .txt files or directories')
    }

    const topLevel = await classifyTopLevelTarget(resolvedTarget)
    if (!topLevel.exists) {
      throw CLIUsageError(`Input does not exist: ${resolvedTarget}. Run: bun autoshow help write`)
    }

    if (topLevel.kind === 'directory') {
      return {
        kind: 'directory',
        targets: await collectTextInputFiles(resolvedTarget)
      }
    }

    if (!isTextInputPath(resolvedTarget)) {
      throw CLIUsageError(`write --text-input only accepts .md or .txt files. Got: ${resolvedTarget}`)
    }

    return { kind: 'single', target: resolvedTarget }
  }

  const topLevel = await classifyTopLevelTarget(resolvedTarget)

  if (topLevel.kind === 'directory') {
    const allFiles = await collectInputFiles(resolvedTarget)

    const includeUrlsFromInputDir = isInputDirectoryPath(resolvedTarget)
    const listedInputEntries = includeUrlsFromInputDir
      ? await readInputList(`${resolvedTarget}/2-urls.md`)
      : []
    const listedInputs = listedInputEntries.length > 0
      ? (await resolveListBatchItems(listedInputEntries, `${resolvedTarget}/2-urls.md`, command, opts)).selectedUrls
      : []

    const all = includeUrlsFromInputDir ? [...allFiles, ...listedInputs] : allFiles
    if (all.length === 0) {
      l.warn(`No inputs found in ${resolvedTarget}`, { category: 'pipeline', metadata: { target: resolvedTarget } })
    }
    return { kind: 'directory', targets: all }
  }

  if (topLevel.kind === 'input_list') {
    return {
      kind: 'input_list',
      resolvedBatch: await resolveInputListBatch(resolvedTarget, command, opts)
    }
  }

  const resolved = await tryResolveBatchSource(resolvedTarget, command, opts)
  if (resolved) {
    return { kind: 'resolved_batch', resolvedBatch: resolved }
  }

  const youtubeCollectionItems = await resolveYoutubeCollectionItems(resolvedTarget)
  if (youtubeCollectionItems) {
    return { kind: 'youtube_collection', targets: youtubeCollectionItems }
  }

  return { kind: 'single', target: resolvedTarget }
}

const planResolvedBatchExecution = async (
  resolvedBatch: ResolvedBatch,
  command: ProcessCommand,
  opts: ProcessPlanningOptions,
  label: string
): Promise<BatchExecutionPlan> => {
  const batchPlan = await planBatchInputsForCommand(
    command,
    resolvedBatch.selectedUrls,
    opts,
    resolvedBatch.selectedItems
  )

  return {
    label,
    items: batchPlan.items,
    ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
    initialRecords: batchPlan.initialRecords,
    resultEntryIndexes: batchPlan.resultEntryIndexes,
    plannedInputs: batchPlan.plannedInputs,
    source: resolvedBatch.source,
    totalCount: resolvedBatch.totalCount
  }
}

const planDirectoryBatchExecution = async (
  resolvedTarget: string,
  command: ProcessCommand,
  opts: ProcessPlanningOptions
): Promise<BatchExecutionPlan | undefined> => {
  const allFiles = command === 'write' && opts.textInput
    ? await collectTextInputFiles(resolvedTarget)
    : await collectInputFiles(resolvedTarget)
  const includeUrlsFromInputDir = !opts.textInput && isInputDirectoryPath(resolvedTarget)
  const listedInputEntries = includeUrlsFromInputDir ? await readInputList(`${resolvedTarget}/2-urls.md`) : []
  const resolvedListedInputs = listedInputEntries.length > 0
    ? await resolveListBatchItems(listedInputEntries, `${resolvedTarget}/2-urls.md`, command, opts)
    : undefined
  const listedInputs = resolvedListedInputs?.selectedUrls ?? []
  const all = includeUrlsFromInputDir ? [...allFiles, ...listedInputs] : allFiles

  if (all.length === 0) {
    return undefined
  }

  const selectedItems: Array<BatchItem | undefined> | undefined = includeUrlsFromInputDir
    ? [
        ...allFiles.map(() => undefined),
        ...(resolvedListedInputs?.selectedItems ?? [])
      ]
    : undefined
  const batchPlan = await planBatchInputsForCommand(command, all, opts, selectedItems)

  return {
    label: command === 'write' && opts.textInput
      ? 'text'
      : includeUrlsFromInputDir
        ? 'input'
        : 'files',
    items: batchPlan.items,
    ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
    initialRecords: batchPlan.initialRecords,
    resultEntryIndexes: batchPlan.resultEntryIndexes,
    plannedInputs: batchPlan.plannedInputs
  }
}

export const planProcessTargetBatchExecution = async (
  plan: ResolvedProcessTargetPlan,
  command: ProcessCommand,
  opts: ProcessPlanningOptions,
  resolvedTarget: string
): Promise<BatchExecutionPlan | undefined> => {
  if (plan.kind === 'directory') {
    return await planDirectoryBatchExecution(resolvedTarget, command, opts)
  }

  if (plan.kind === 'input_list') {
    return await planResolvedBatchExecution(plan.resolvedBatch, command, opts, 'inputs')
  }

  if (plan.kind === 'resolved_batch') {
    return await planResolvedBatchExecution(
      plan.resolvedBatch,
      command,
      opts,
      plan.resolvedBatch.source.title ?? plan.resolvedBatch.source.sourceKind
    )
  }

  if (plan.kind === 'youtube_collection') {
    const batchPlan = await planBatchInputsForCommand(command, plan.targets, opts)
    return {
      label: 'youtube_collection',
      items: batchPlan.items,
      ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
      initialRecords: batchPlan.initialRecords,
      resultEntryIndexes: batchPlan.resultEntryIndexes,
      plannedInputs: batchPlan.plannedInputs
    }
  }

  return undefined
}
