import type { GlobalLogger, Logger, LogLevel, LogSink, ReconfigureOptions, Reporter } from '~/types'
import { LOG_LEVEL_PRIORITY } from '~/types'
import { runWithLogContext, runWithSuppressedLogCategories } from '~/utils/app-logger/context-store'
import { createLogger, createRunId } from '~/utils/app-logger/core'
import { createReporter } from '~/utils/app-logger/reporter'
import { isJsonResultActive } from '~/utils/app-logger/result-emitter'
import { createJsonSink } from '~/utils/app-logger/sinks/json-sink'
import { createTextSink } from '~/utils/app-logger/sinks/text-sink'

export { isJsonResultActive, runWithLogContext, runWithSuppressedLogCategories }

export const LOG_LEVEL_CHOICES: readonly LogLevel[] = ['debug', 'info', 'success', 'warn', 'error']
const DEFAULT_LOG_LEVEL: LogLevel = 'info'

const createConfiguredSinks = (json: boolean): LogSink[] => json ? [createJsonSink()] : [createTextSink()]
const baseContext = { service: 'autoshow-cli', component: 'cli', pid: process.pid }
const attachReport = (logger: Logger): GlobalLogger => ({ ...logger, report: createReporter(logger) })

let activeLogger = attachReport(createLogger({
  runId: createRunId(),
  context: baseContext,
  minLevel: DEFAULT_LOG_LEVEL,
  sinks: createConfiguredSinks(false)
}))

export const resetLoggerForInvocation = (json: boolean, runId = createRunId()): string => {
  activeLogger = attachReport(createLogger({
    runId,
    context: baseContext,
    minLevel: DEFAULT_LOG_LEVEL,
    sinks: createConfiguredSinks(json)
  }))
  return runId
}

export const isLogLevelEnabled = (level: LogLevel): boolean =>
  LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[activeLogger.config.minLevel]

export const reconfigureLogger = (opts: ReconfigureOptions): void => {
  const minLevel = opts.logLevel ?? (opts.verbose ? 'debug' : opts.quiet ? 'error' : undefined)
  if (opts.json !== undefined) {
    activeLogger.config.sinks.splice(0, activeLogger.config.sinks.length, ...createConfiguredSinks(opts.json))
  }
  if (minLevel !== undefined) activeLogger.config.minLevel = minLevel
}

export const l: GlobalLogger = {
  get config() { return activeLogger.config },
  get report() { return activeLogger.report },
  write: (...args) => activeLogger.write(...args),
  debug: (...args) => activeLogger.debug(...args),
  warn: (...args) => activeLogger.warn(...args),
  error: (...args) => activeLogger.error(...args)
}

export const report: Reporter = {
  expectedOutput: (...args) => activeLogger.report.expectedOutput(...args),
  estimate: (...args) => activeLogger.report.estimate(...args),
  price: (...args) => activeLogger.report.price(...args),
  complete: (...args) => activeLogger.report.complete(...args),
  result: (...args) => activeLogger.report.result(...args)
}
export const write = l.write
export const debug = l.debug
export const warn = l.warn
export const error = l.error
