import type { LogContext, LogLevel, LogSink } from '~/types'

export type CreateLoggerOptions = {
  runId?: string
  context?: LogContext
  sinks?: readonly LogSink[]
  minLevel?: LogLevel
}
