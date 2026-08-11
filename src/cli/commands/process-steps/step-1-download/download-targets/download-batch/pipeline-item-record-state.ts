import { derivePipelineItemRecord, readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { InternalError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import type { PipelineItemErrorRecord, PipelineItemRecord, PipelineItemStatus, ProcessCommand } from '~/types'

export const toBatchCommand = (command: ProcessCommand): 'metadata' | 'download' | 'extract' | 'write' => {
  if (command === 'metadata' || command === 'download' || command === 'extract' || command === 'write') {
    return command
  }

  throw InternalError('Unsupported canonical batch command: ' + command, { stage: 'batch:manifest' })
}

export { isRecord }

export const getPipelineItemErrorCount = (record: PipelineItemRecord | null): number => {
  if (!record) {
    return 0
  }

  const errors = record['errors']
  return Array.isArray(errors) ? errors.length : 0
}

export const getPipelineItemErrors = (record: PipelineItemRecord | null): PipelineItemErrorRecord[] => {
  if (!record) {
    return []
  }

  const errors = record['errors']
  return Array.isArray(errors)
    ? errors.filter((value): value is PipelineItemErrorRecord => typeof value === 'object' && value !== null)
    : []
}

export const getErrorOutputDir = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object' || !('outputDir' in error)) {
    return undefined
  }

  const outputDir = (error as { outputDir?: unknown }).outputDir
  return typeof outputDir === 'string' && outputDir.length > 0 ? outputDir : undefined
}

export const readBatchChildItemRecord = async (
  outputDir: string,
  command: ProcessCommand
): Promise<PipelineItemRecord | null> => {
  const manifest = await readManifest(outputDir).catch(() => undefined)
  const item = manifest?.items[0]
  if (!manifest || manifest.command !== toBatchCommand(command) || manifest.scope !== 'single' || !item) {
    return null
  }
  return derivePipelineItemRecord(outputDir, item)
}

export const attachOutputDir = (
  itemRecord: PipelineItemRecord | null,
  outputDir: string
): PipelineItemRecord =>
  itemRecord
    ? { ...itemRecord, outputDir }
    : { outputDir }

export const getPipelineItemStatus = (
  record: PipelineItemRecord | null
): PipelineItemStatus | undefined => {
  if (!record) {
    return undefined
  }

  const completionStatus = record['completionStatus']
  if (completionStatus === 'full' || completionStatus === 'incomplete' || completionStatus === 'failed' || completionStatus === 'skipped') {
    return completionStatus
  }

  return undefined
}
