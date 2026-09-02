import type { LogLevel, ResumeItemSummary, ResumeSuiteSummary, ResumeTotals } from '~/types'
import * as l from '~/utils/app-logger/app-logger'

export const logResumeItem = (summary: ResumeItemSummary, level: LogLevel): void => {
  l.write(level === 'success' ? 'info' : level, `Resume item ${summary.item}: ${summary.status}`, {
    category: 'pipeline',
    metadata: summary
  })
}

export const logResumeSummary = (totals: ResumeTotals): void => {
  const level = totals.incomplete > 0 || totals.failed > 0 ? 'warn' : 'info'
  l.write(level, `Resume summary: ${totals.full} full, ${totals.incomplete} incomplete, ${totals.failed} failed`, {
    category: 'pipeline',
    metadata: totals
  })
}

export const logResumeSuiteSummary = (summary: ResumeSuiteSummary): void => {
  const level = summary.incomplete > 0 || summary.failed > 0 ? 'warn' : 'info'
  l.write(level, `Resume suite: ${summary.directories} directories, ${summary.incomplete} incomplete, ${summary.failed} failed`, {
    category: 'pipeline',
    metadata: summary
  })
}
