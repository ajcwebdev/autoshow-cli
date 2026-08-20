import { basename } from 'node:path'
import { createHumanTable, createKeyValueTable, createLocationsTable } from '~/utils/app-logger/human-table/human-table'
import { defineTableLog } from '~/utils/app-logger/table-log-definition'
import type { AudioDownloadSummary, AudioNormalizeSummary, HumanLogTable, TableLogger } from '~/types'

const buildAudioDownloadRows = (
  summary: AudioDownloadSummary
): Array<{ status: string, source: string, target: string, detail: string }> => [{
  status: summary.status,
  source: summary.source,
  target: summary.target,
  detail: summary.detail ?? ''
}]

const buildAudioDownloadTableValue = (
  summary: AudioDownloadSummary
): HumanLogTable =>
  createHumanTable(buildAudioDownloadRows(summary), ['status', 'source', 'target', 'detail'])

export const { log: logAudioDownload } = defineTableLog<AudioDownloadSummary>({
  title: 'Audio Download',
  category: 'pipeline',
  buildTable: buildAudioDownloadTableValue,
  level: summary => summary.status === 'downloaded' ? 'success' : 'info',
  metadata: summary => summary
})

export const buildAudioNormalizeTable = (
  summary: AudioNormalizeSummary
): HumanLogTable =>
  createKeyValueTable([
    ['status', summary.status],
    ['mode', summary.plan.mode],
    ['codec', `${summary.plan.sourceCodecName}->${summary.plan.outputCodecName}`],
    ['input', basename(summary.inputPath) || 'audio'],
    ['output', basename(summary.outputPath) || 'audio'],
    ['detail', summary.plan.reason]
  ])

export const logAudioNormalize = (
  logger: TableLogger,
  summary: AudioNormalizeSummary
): void => {
  logger.write('info', 'Audio Normalize', {
    category: 'pipeline',
    humanTable: buildAudioNormalizeTable(summary),
    metadata: {
      status: summary.status,
      inputPath: summary.inputPath,
      outputPath: summary.outputPath,
      plan: summary.plan
    }
  })
}

export const logAudioOutput = (
  logger: TableLogger,
  audioPath: string
): void => {
  logger.write('success', 'Audio Output', {
    category: 'artifact',
    humanTable: createLocationsTable([{ artifact: 'audio', path: audioPath }]),
    metadata: { audioPath }
  })
}
