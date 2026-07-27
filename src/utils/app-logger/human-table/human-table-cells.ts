import type { HumanLogTableCell } from '~/types'

const normalizeTableCell = (value: unknown): HumanLogTableCell => {
  if (value === null) {
    return null
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (value === undefined) {
    return ''
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof URL) {
    return value.toString()
  }

  if (Array.isArray(value)) {
    return value.map(item => String(normalizeTableCell(item))).join(', ')
  }

  return Bun.inspect(value)
}

export const formatTableCell = (value: HumanLogTableCell | undefined): string => {
  if (value === undefined) {
    return ''
  }

  if (value === null) {
    return 'null'
  }

  return String(value)
}

export const toHumanTableCell = normalizeTableCell
