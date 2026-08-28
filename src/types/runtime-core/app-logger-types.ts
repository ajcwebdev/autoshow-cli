import type { LogCategory, LogFormat, LogLevel } from '~/types'

export type LogFormatChoice = Exclude<LogFormat, 'auto'>

export type ReconfigureOptions = {
  verbose?: boolean
  quiet?: boolean
  json?: boolean
  logLevel?: LogLevel
  logFormat?: LogFormatChoice
  suppressCategories?: readonly LogCategory[]
}
