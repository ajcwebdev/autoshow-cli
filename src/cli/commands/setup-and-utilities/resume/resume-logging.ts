import { createSingleRowTable } from '~/utils/app-logger/human-table/human-table'
import type { HumanLogTable, LogLevel, ResumeItemSummary, ResumeSuiteSummary, ResumeTotals, TableLogger } from '~/types'

const buildResumeItemTable = (
  summary: ResumeItemSummary
): HumanLogTable =>
  createSingleRowTable(summary, ['item', 'status', 'outputDir', 'providers', 'detail'])

export const logResumeItem = (
  logger: TableLogger,
  summary: ResumeItemSummary,
  level: LogLevel
): void => {
  logger.write(level, 'Resume Item', {
    category: 'pipeline',
    humanTable: buildResumeItemTable(summary),
    metadata: summary
  })
}

export const buildResumeSummaryTable = (
  totals: ResumeTotals
): HumanLogTable =>
  createSingleRowTable(totals, ['full', 'incomplete', 'failed'])

export const logResumeSummary = (
  logger: TableLogger,
  totals: ResumeTotals,
  level: LogLevel = totals.incomplete > 0 || totals.failed > 0 ? 'warn' : 'info'
): void => {
  logger.write(level, 'Resume Summary', {
    category: 'pipeline',
    humanTable: buildResumeSummaryTable(totals),
    metadata: totals
  })
}

const buildResumeSuiteSummaryTable = (
  summary: ResumeSuiteSummary
): HumanLogTable =>
  createSingleRowTable(summary, ['directories', 'full', 'incomplete', 'failed'])

export const logResumeSuiteSummary = (
  logger: TableLogger,
  summary: ResumeSuiteSummary,
  level: LogLevel = summary.incomplete > 0 || summary.failed > 0 ? 'warn' : 'info'
): void => {
  logger.write(level, 'Resume Suite Summary', {
    category: 'pipeline',
    humanTable: buildResumeSuiteSummaryTable(summary),
    metadata: summary
  })
}
