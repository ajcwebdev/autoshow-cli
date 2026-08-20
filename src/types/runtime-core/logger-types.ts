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
  category?: LogCategory
  metadata?: LogMetadata
  context?: LogContext
  indent?: boolean
  args?: readonly unknown[]
  humanTable?: HumanLogTable
  humanSections?: readonly HumanLogSection[]
}

// Runtime key set used by `l.warn`/`l.debug` to tell a trailing options object
// apart from an ordinary interpolation argument. Keep in sync with LogWriteOptions.
export const LOG_WRITE_OPTION_KEYS: readonly string[] = [
  'category',
  'metadata',
  'context',
  'indent',
  'args',
  'humanTable',
  'humanSections'
]

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
  // Shared by reference with loggers derived through `withContext`, so a single
  // `suppressLogCategories` call reaches every live logger.
  suppressedCategories: LogCategory[]
}


// A single trailing LogWriteOptions object is lifted into structured fields;
// anything else is forwarded as interpolation args, as before.
export interface StructuredLogFn {
  (message: string, options: LogWriteOptions): void
  (message: string, ...args: unknown[]): void
}

export interface Logger {
  write: (level: LogLevel, message: string, options?: LogWriteOptions) => void
  debug: StructuredLogFn
  warn: StructuredLogFn
  error: (message: string, errorObj?: unknown) => void
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

export type ReportResultOptions = {
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
  // Sanctioned structured-result channel for commands whose result is neither a
  // price estimate nor a file-producing completion.
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
