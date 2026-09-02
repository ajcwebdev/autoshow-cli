import type { LogSink, LogSinkEvent } from '~/types'
import { colorizeLogBatchPrefix, colorizeLogLevelSymbol, colorizeLogMessage, colorizeLogTimestamp } from '~/utils/app-logger/log-colors'

const getBatchItemPrefix = (event: LogSinkEvent): string => {
  const itemIndex = event.context?.['itemIndex']
  const itemCount = event.context?.['itemCount']
  return typeof itemIndex === 'number'
    && Number.isFinite(itemIndex)
    && typeof itemCount === 'number'
    && Number.isFinite(itemCount)
    && itemIndex >= 1
    && itemCount >= itemIndex
    ? `[${itemIndex}/${itemCount}] `
    : ''
}

const getLevelSymbol = (level: LogSinkEvent['level']): string => {
  switch (level) {
    case 'info': return '•'
    case 'warn': return '⚠'
    case 'error': return '✖'
    case 'success': return '✓'
    case 'debug': return '○'
  }
}

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return `[${timestamp}]`
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return `[${hours}:${minutes}:${seconds}.${ms}]`
}

const formatMessage = (event: LogSinkEvent): string => {
  const timestamp = colorizeLogTimestamp(formatTimestamp(event.timestamp))
  const symbol = colorizeLogLevelSymbol(getLevelSymbol(event.level), event.level)
  const batchPrefix = colorizeLogBatchPrefix(getBatchItemPrefix(event))
  return `${timestamp} ${symbol} ${batchPrefix}${colorizeLogMessage(event.message, event.category)}`
}

export const createTextSink = (options: { interactive?: boolean } = {}): LogSink => (event) => {
  const message = formatMessage(event)
  if (event.level === 'warn') console.warn(message)
  else if (event.level === 'error') console.error(message)
  else if (options.interactive === true || process.stdout.isTTY === true) console.log(message)
  else console.error(message)
}
