import type { LogCategory, LogContext, LogLevel, LogSink } from '~/types'

export type CreateLoggerOptions = {
  runId?: string
  context?: LogContext
  sinks?: readonly LogSink[]
  minLevel?: LogLevel
  // Passed by reference (not copied) so derived loggers observe later suppression changes.
  suppressedCategories?: LogCategory[]
}
