import type { AggregatedPriceEstimate } from '~/types'

export const LOG_LEVELS = ['debug', 'info', 'success', 'warn', 'error'] as const

export type LogLevel = typeof LOG_LEVELS[number]

export const LOG_LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  success: 30,
  warn: 40,
  error: 50
}

const LOG_CATEGORIES = ['command', 'artifact', 'pricing', 'pipeline', 'retry', 'runtime', 'usage'] as const

export type LogCategory = typeof LOG_CATEGORIES[number]
export type LogContext = Readonly<Record<string, string | number | boolean | null | undefined>>
export type LogMetadata = Readonly<Record<string, unknown>>
export type SerializedLogError = Readonly<Record<string, unknown>>

export type LogWriteOptions = {
  category: LogCategory
  metadata?: LogMetadata
  context?: LogContext
  error?: unknown
}

export type LogSinkEvent = {
  schemaVersion: 1
  type: 'log'
  timestamp: string
  level: LogLevel
  message: string
  category: LogCategory
  runId: string
  command?: string
  step?: string
  context?: LogContext
  metadata?: LogMetadata
  error?: SerializedLogError
}

export type LogSink = (event: LogSinkEvent) => void

export type MutableLoggerConfig = {
  sinks: LogSink[]
  minLevel: LogLevel
  runId: string
}

export interface Logger {
  write: (level: LogLevel, message: string, options: LogWriteOptions) => void
  debug: (message: string, options: LogWriteOptions) => void
  warn: (message: string, options: LogWriteOptions) => void
  error: (message: string, options: LogWriteOptions) => void
  config: MutableLoggerConfig
}

export type StepTimingCost = {
  label: string
  providerModel?: string
  processingTime: number
  cost: number
}

export type ReporterMetricValue = string | number | boolean | null

export type CompleteOptions = {
  metrics?: Record<string, ReporterMetricValue>
  steps?: StepTimingCost[]
  totalTimeMs?: number
  totalCost?: number
}

export type Reporter = {
  expectedOutput: (outputDir: string, files: string[]) => void
  estimate: (estimate: AggregatedPriceEstimate) => void
  price: (estimate: AggregatedPriceEstimate) => void
  complete: (outputDir: string, files: Record<string, string>, options?: CompleteOptions) => void
  result: (data: Record<string, unknown>, message?: string) => void
}

export type GlobalLogger = Logger & { report: Reporter }
