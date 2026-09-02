import type { LogLevel } from '~/types'

export type ReconfigureOptions = {
  verbose?: boolean
  quiet?: boolean
  json?: boolean
  logLevel?: LogLevel
}
