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

const LOG_CATEGORIES = [
  'general',
  'command',
  'artifact',
  'pricing',
  'pipeline',
  'tts',
  'usage'
] as const

export type LogCategory = typeof LOG_CATEGORIES[number]

export type LogContext = Readonly<Record<string, string | number | boolean | null | undefined>>

export type LogMetadata = Readonly<Record<string, unknown>>

export type HumanLogTableCell = string | number | boolean | null

export type HumanLogTableRow = Readonly<Record<string, HumanLogTableCell>>

export type HumanLogTableAlign = 'left' | 'right'

export type HumanLogTableDetail = {
  label: string
  value: HumanLogTableCell
}

export type HumanLogTable = {
  rows: readonly HumanLogTableRow[]
  columns?: readonly string[]
  align?: Readonly<Record<string, HumanLogTableAlign>>
  details?: readonly HumanLogTableDetail[]
  labels?: Readonly<Record<string, string>>
}

export type HumanLogSection = {
  title: string
  table: HumanLogTable
}

export type LogWriteOptions = {
  category: LogCategory
  metadata?: LogMetadata
  context?: LogContext
  indent?: boolean
  args?: readonly unknown[]
  humanTable?: HumanLogTable
  humanSections?: readonly HumanLogSection[]
}

type LogErrorOptions = LogWriteOptions & {
  error?: unknown
}

export type LogSinkEvent = {
  timestamp: string
  level: LogLevel
  message: string
  category: LogCategory
  runId: string
  command?: string
  step?: string
  context?: LogContext
  metadata?: LogMetadata
  indent: boolean
  args: readonly unknown[]
  humanTable?: HumanLogTable
  humanSections?: readonly HumanLogSection[]
}

export type LogSink = (event: LogSinkEvent) => void

export type MutableLoggerConfig = {
  sinks: LogSink[]
  minLevel: LogLevel
  suppressedCategories: LogCategory[]
}

export interface Logger {
  write: (level: LogLevel, message: string, options: LogWriteOptions) => void
  debug: (message: string, options: LogWriteOptions) => void
  warn: (message: string, options: LogWriteOptions) => void
  error: (message: string, options: LogErrorOptions) => void
  withContext: (context: LogContext) => Logger
  config: MutableLoggerConfig
}

export type TableLogger = Pick<Logger, 'write'>

export type LocationTableRow = {
  artifact: string
  path: unknown
  detail?: unknown
}

export type BatchItemTableRow = {
  status: string
  input: unknown
  detail?: unknown
}

export type HumanTableLogOptions = {
  level?: LogLevel
  category?: LogCategory
  metadata?: LogMetadata
}

export type StepTimingCost = {
  label: string
  providerModel?: string
  processingTime: number
  cost: number
}

export type ReporterMetricValue = string | number | boolean | null

export type HumanCompletionTables = {
  artifacts?: HumanLogTable
  providers?: HumanLogTable
  metrics?: HumanLogTable
  timing?: HumanLogTable
}

export type CompleteOptions = {
  metrics?: Record<string, ReporterMetricValue>
  steps?: StepTimingCost[]
  totalTimeMs?: number
  totalCost?: number
  summaryMessage?: string
  includeOutputDir?: boolean
}

type ReportResultOptions = {
  message?: string
  level?: LogLevel
  category?: LogCategory
  humanTable?: HumanLogTable
  humanSections?: readonly HumanLogSection[]
}

export type Reporter = {
  expectedOutput: (outputDir: string, files: string[]) => void
  estimate: (estimate: AggregatedPriceEstimate) => void
  complete: (outputDir: string, files: Record<string, string>, options?: CompleteOptions) => void
  result: (data: Record<string, unknown>, options?: ReportResultOptions) => void
}

export type StepSummaryEntry = {
  step: string
  providerModel?: string
  time: string
  cost: string
}

export type GlobalLogger = Logger & {
  report: Reporter
}

export type LogFormat = 'auto' | 'human' | 'json' | 'both'
