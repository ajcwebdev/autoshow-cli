import type { HumanLogTable, SetupToolStatus, SetupToolStatusRow } from '~/types'
import { createHumanTable } from '~/utils/app-logger/human-table/human-table'
import { defineTableLog } from '~/utils/app-logger/table-log-definition'

const isPathLikeDetail = (detail: string): boolean => {
  const value = detail.trim()
  return /^(?:\.{1,2}[\\/]|~[\\/]|[\\/]|[A-Za-z]:[\\/])/.test(value)
    || value.includes('\\')
    || value.split('/').length > 2
}

const buildSetupToolStatusRows = (
  summary: SetupToolStatus
): SetupToolStatusRow[] => {
  const detail = summary.detail ?? ''
  return [{
    tool: summary.tool,
    status: summary.status,
    ...(detail.length > 0
      ? isPathLikeDetail(detail) ? { path: detail } : { detail }
      : { detail: '' })
  }]
}

const buildSetupToolStatusTableValue = (
  summary: SetupToolStatus
): HumanLogTable => {
  const rows = buildSetupToolStatusRows(summary)
  const pathRow = rows.find(row => row.path !== undefined)
  if (pathRow?.path !== undefined) {
    const table = createHumanTable(
      rows.map(({ path: _path, ...row }) => row),
      ['tool', 'status']
    )
    return {
      ...table,
      details: [
        ...(table.details ?? []),
        { label: 'path', value: pathRow.path }
      ]
    }
  }

  return createHumanTable(
    rows,
    ['tool', 'status', 'detail']
  )
}

export const { buildTable: buildSetupToolStatusTable, log: logSetupToolStatus } = defineTableLog<SetupToolStatus>({
  title: 'Setup Tool Status',
  category: 'command',
  buildTable: buildSetupToolStatusTableValue,
  level: summary => summary.status === 'installed' || summary.status === 'ready' || summary.status === 'ok' ? 'success' : 'info',
  metadata: summary => summary
})
