import type { Logger, WriteManifestMetadata, WriteManifestSourceRefs } from '~/types'
import { l } from '~/utils/app-logger/app-logger'
import { createKeyValueTable } from '~/utils/app-logger/human-table/human-table'
import { PIPELINE_MANIFEST_FILE } from '../pipeline-manifest'
import { buildWriteManifestConsoleSummary } from './manifest-log-console-summary'

export const logManifestLocation = (
  outputDir: string,
  logger: Pick<Logger, 'write'> = l,
  command = 'write'
): string => {
  const manifestPath = `${outputDir}/${PIPELINE_MANIFEST_FILE}`
  logger.write('info', 'Locations', {
    category: 'artifact',
    humanTable: createKeyValueTable([['manifest', manifestPath]], 'artifact', 'path'),
    metadata: {
      path: manifestPath,
      command
    }
  })
  return manifestPath
}

export const logWriteManifestConsoleSummary = (
  outputDir: string,
  metadata: WriteManifestMetadata,
  refs: WriteManifestSourceRefs = {},
  logger: Pick<Logger, 'write' | 'debug'> = l
): void => {
  logManifestConsoleSummary(outputDir, 'write', metadata, refs, logger)
}

export const logExtractManifestConsoleSummary = (
  outputDir: string,
  metadata: WriteManifestMetadata,
  refs: WriteManifestSourceRefs = {},
  logger: Pick<Logger, 'write' | 'debug'> = l
): void => {
  logManifestConsoleSummary(outputDir, 'extract', metadata, refs, logger)
}

const logManifestConsoleSummary = (
  outputDir: string,
  command: string,
  metadata: WriteManifestMetadata,
  refs: WriteManifestSourceRefs,
  logger: Pick<Logger, 'write' | 'debug'>
): void => {
  const summary = buildWriteManifestConsoleSummary(metadata, refs)

  logManifestLocation(outputDir, logger, command)

  if (summary.runSummary) {
    logger.write('info', 'Run Summary', {
      category: 'artifact',
      humanTable: summary.runSummary.humanTable,
      metadata: {
        columns: summary.runSummary.columns,
        rows: summary.runSummary.rows
      }
    })
  }

  if (summary.promptUsage) {
    logger.write('info', 'Prompt Usage', {
      category: 'usage',
      humanTable: summary.promptUsage.humanTable,
      metadata: {
        columns: summary.promptUsage.columns,
        rows: summary.promptUsage.rows
      }
    })
  }

  if (summary.ocrCostCalculation) {
    logger.write('info', 'OCR Cost Calculation', {
      category: 'usage',
      humanTable: summary.ocrCostCalculation.humanTable,
      metadata: {
        columns: summary.ocrCostCalculation.columns,
        rows: summary.ocrCostCalculation.rows
      }
    })
  }

  if (summary.hostedOcrScheduler) {
    logger.write('info', 'Hosted OCR Scheduler', {
      category: 'usage',
      humanTable: summary.hostedOcrScheduler.humanTable,
      metadata: {
        columns: summary.hostedOcrScheduler.columns,
        rows: summary.hostedOcrScheduler.rows
      }
    })
  }

  logger.debug(`Manifest item metadata:\n${JSON.stringify({ command, metadata }, null, 2)}`)
}
