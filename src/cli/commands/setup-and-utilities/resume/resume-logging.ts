import { createSingleRowTable } from '~/utils/app-logger/human-table/human-table'
import { defineTableLog } from '~/utils/app-logger/table-log-definition'
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

const buildResumeSummaryTableValue = (
  totals: ResumeTotals
): HumanLogTable =>
  createSingleRowTable(totals, ['full', 'incomplete', 'failed'])

export const { buildTable: buildResumeSummaryTable, log: logResumeSummary } = defineTableLog<ResumeTotals>({
  title: 'Resume Summary',
  category: 'pipeline',
  buildTable: buildResumeSummaryTableValue,
  level: totals => totals.incomplete > 0 || totals.failed > 0 ? 'warn' : 'info',
  metadata: totals => totals
})

const buildResumeSuiteSummaryTableValue = (
  summary: ResumeSuiteSummary
): HumanLogTable =>
  createSingleRowTable(summary, ['directories', 'full', 'incomplete', 'failed'])

export const { log: logResumeSuiteSummary } = defineTableLog<ResumeSuiteSummary>({
  title: 'Resume Suite Summary',
  category: 'pipeline',
  buildTable: buildResumeSuiteSummaryTableValue,
  level: summary => summary.incomplete > 0 || summary.failed > 0 ? 'warn' : 'info',
  metadata: summary => summary
})
