import type { GlobalLogger, LogCategory, LogFormatChoice, Logger, LogLevel, LogSink, ReconfigureOptions } from '~/types'
import { LOG_LEVEL_PRIORITY } from '~/types'
import { runWithLogContext } from '~/utils/app-logger/context-store'
import { createLogger } from '~/utils/app-logger/core'
import { createReporter } from '~/utils/app-logger/reporter'
import { enableJsonResult, isJsonResultActive } from '~/utils/app-logger/result-emitter'
import { createHumanSink } from '~/utils/app-logger/sinks/human-sink'
import { createJsonSink } from '~/utils/app-logger/sinks/json-sink'

export { isJsonResultActive,runWithLogContext }

export const LOG_FORMAT_CHOICES: readonly LogFormatChoice[] = ['human', 'json', 'both']
export const LOG_LEVEL_CHOICES: readonly LogLevel[] = ['debug', 'info', 'success', 'warn', 'error']

const DEFAULT_LOG_FORMAT: LogFormatChoice = 'human'
const DEFAULT_LOG_LEVEL: LogLevel = 'info'

const createConfiguredSinks = (format: LogFormatChoice = DEFAULT_LOG_FORMAT): LogSink[] => {
  if (format === 'human') {
    return [createHumanSink()]
  }

  if (format === 'json') {
    return [createJsonSink()]
  }

  return [createHumanSink(), createJsonSink()]
}

const baseContext = {
  service: 'autoshow-cli',
  component: 'cli',
  pid: process.pid
}

const attachReport = (logger: Logger): GlobalLogger => {
  return {
    ...logger,
    withContext: (context) => attachReport(logger.withContext(context)),
    report: createReporter(logger)
  }
}

let activeLogger = attachReport(createLogger({
  context: baseContext,
  minLevel: DEFAULT_LOG_LEVEL,
  sinks: createConfiguredSinks()
}))

/**
 * First-class replacement for sink monkey-patching: events in these categories are dropped
 * in `core.ts` before they reach any sink. The array is shared by reference with loggers
 * derived through `withContext`, so one call covers all of them.
 *
 * Returns a restore function so callers can scope the suppression to a run; the CLI
 * dispatcher additionally clears it at the start of every command.
 */
export const suppressLogCategories = (categories: readonly LogCategory[]): (() => void) => {
  const suppressed = activeLogger.config.suppressedCategories
  const added = categories.filter((category) => !suppressed.includes(category))
  suppressed.push(...added)

  return () => {
    for (const category of added) {
      const index = suppressed.indexOf(category)
      if (index !== -1) suppressed.splice(index, 1)
    }
  }
}

/**
 * Whether an event at `level` would reach a sink. The one query helper for behavior that
 * depends on verbosity (the setup command decides whether to stream a child build's raw
 * output this way), so callers no longer reach into `l.config.minLevel` — the only place
 * that coupled runtime behavior to logger internals.
 */
export const isLogLevelEnabled = (level: LogLevel): boolean =>
  LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[activeLogger.config.minLevel]

export const clearSuppressedLogCategories = (): void => {
  activeLogger.config.suppressedCategories.length = 0
}

export const reconfigureLogger = (opts: ReconfigureOptions): void => {
  let minLevel: LogLevel | undefined
  let formatOverride: LogFormatChoice | undefined

  // Level precedence: explicit --log-level wins over the --verbose/--quiet shortcuts.
  if (opts.logLevel !== undefined) {
    minLevel = opts.logLevel
  } else if (opts.verbose) {
    minLevel = 'debug'
  } else if (opts.quiet) {
    minLevel = 'error'
  }

  // Format precedence: explicit --log-format wins over the --json shortcut.
  if (opts.logFormat !== undefined) {
    formatOverride = opts.logFormat
  } else if (opts.json) {
    formatOverride = 'json'
  }

  if (formatOverride === 'json' || formatOverride === 'both') {
    enableJsonResult()
  }

  if (opts.suppressCategories !== undefined) {
    suppressLogCategories(opts.suppressCategories)
  }

  if (minLevel === undefined && formatOverride === undefined) {
    return
  }

  if (formatOverride !== undefined) {
    const newSinks = createConfiguredSinks(formatOverride)
    activeLogger.config.sinks.length = 0
    activeLogger.config.sinks.push(...newSinks)
  }
  if (minLevel !== undefined) {
    activeLogger.config.minLevel = minLevel
  }
}

export const l: GlobalLogger = {
  get config() { return activeLogger.config },
  get report() { return activeLogger.report },
  write: (...args) => activeLogger.write(...args),
  debug: (...args) => activeLogger.debug(...args),
  warn: (...args) => activeLogger.warn(...args),
  error: (...args) => activeLogger.error(...args),
  withContext: (context) => attachReport(activeLogger.withContext(context))
}

export const report = l.report
export const write = l.write
export const debug = l.debug
export const warn = l.warn
export const error = l.error
