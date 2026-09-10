import type { WriteManifestMetadata, WriteManifestSourceRefs } from '~/types'
import { l } from '~/utils/app-logger/app-logger'
import { PIPELINE_MANIFEST_FILE } from '../pipeline-manifest'
import { buildWriteManifestSummary } from './manifest-log-console-summary'

export const logManifestLocation = (
  outputDir: string,
  command = 'write'
): string => {
  const manifestPath = `${outputDir}/${PIPELINE_MANIFEST_FILE}`
  l.write('info', `Manifest: ${manifestPath}`, {
    category: 'artifact',
    metadata: {
      path: manifestPath,
      command
    }
  })
  return manifestPath
}

export const logWriteManifestSummary = (
  outputDir: string,
  metadata: WriteManifestMetadata,
  refs: WriteManifestSourceRefs = {}
): void => {
  logManifestSummary(outputDir, 'write', metadata, refs)
}

export const logExtractManifestSummary = (
  outputDir: string,
  metadata: WriteManifestMetadata,
  refs: WriteManifestSourceRefs = {}
): void => {
  logManifestSummary(outputDir, 'extract', metadata, refs)
}

const logManifestSummary = (
  outputDir: string,
  command: string,
  metadata: WriteManifestMetadata,
  refs: WriteManifestSourceRefs
): void => {
  const summary = buildWriteManifestSummary(metadata, refs)

  logManifestLocation(outputDir, command)

  if (summary.runSummary) {
    l.write('info', `Run summary: ${summary.runSummary.entries.length} steps`, {
      category: 'artifact',
      metadata: {
        entries: summary.runSummary.entries
      }
    })
  }

  if (summary.promptUsage) {
    l.write('info', `Prompt usage: ${summary.promptUsage.entries.length} entries`, {
      category: 'usage',
      metadata: {
        entries: summary.promptUsage.entries
      }
    })
  }

  if (summary.ocrCostCalculation) {
    l.write('info', `OCR cost calculation: ${summary.ocrCostCalculation.entries.length} providers`, {
      category: 'usage',
      metadata: {
        entries: summary.ocrCostCalculation.entries
      }
    })
  }

  if (summary.hostedOcrScheduler) {
    l.write('info', `Hosted OCR scheduler: ${summary.hostedOcrScheduler.entries.length} lanes`, {
      category: 'usage',
      metadata: {
        entries: summary.hostedOcrScheduler.entries
      }
    })
  }

  l.debug('Manifest item metadata', { category: 'usage', metadata: { command, metadata } })
}
