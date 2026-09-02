import { paint, terminalPalette, terminalStyles } from '~/utils/terminal-colors'
import type { LogCategory, LogLevel } from '~/types'

const CATEGORY_COLORS: Partial<Record<LogCategory, string>> = {
  command: terminalPalette.info,
  artifact: terminalPalette.path,
  pricing: terminalPalette.cost,
  pipeline: terminalPalette.pending,
  retry: terminalPalette.warning,
  runtime: terminalPalette.muted,
  usage: 'lightsalmon'
}

export const colorizeLogTimestamp = (timestamp: string): string => terminalStyles.muted(timestamp)

export const colorizeLogLevelSymbol = (symbol: string, level: LogLevel): string => {
  switch (level) {
    case 'success': return terminalStyles.success(symbol)
    case 'warn': return terminalStyles.warning(symbol)
    case 'error': return terminalStyles.error(symbol)
    case 'debug': return terminalStyles.muted(symbol)
    case 'info': return terminalStyles.info(symbol)
  }
}

export const colorizeLogBatchPrefix = (prefix: string): string => terminalStyles.muted(prefix)

export const colorizeLogMessage = (message: string, category: LogCategory): string => {
  const color = CATEGORY_COLORS[category]
  return color ? paint(message, color) : message
}
