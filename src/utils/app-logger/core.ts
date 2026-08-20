import type { CreateLoggerOptions, LogCategory, LogContext, Logger, LogLevel, LogSinkEvent, LogWriteOptions, MutableLoggerConfig } from '~/types'
import { LOG_LEVEL_PRIORITY, LOG_WRITE_OPTION_KEYS } from '~/types'
import { getLogContext } from '~/utils/app-logger/context-store'
import {
sanitizeHumanSections,
sanitizeHumanTable,
sanitizeLogArgs,
sanitizeLogContext,
sanitizeLogMetadata,
sanitizeLogText
} from '~/utils/app-logger/redaction'

const getTimestamp = (): string => {
  return new Date().toISOString()
}

const createRunId = (): string => {
  const timestampPart = Date.now().toString(36)
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `${timestampPart}-${randomPart}`
}

const mergeContext = (...contexts: Array<LogContext | undefined>): LogContext => {
  const merged: Record<string, string | number | boolean | null | undefined> = {}

  for (const context of contexts) {
    if (!context) {
      continue
    }

    Object.assign(merged, context)
  }

  return merged
}

const getContextString = (context: LogContext, key: string): string | undefined => {
  const value = context[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

const shouldEmitLevel = (level: LogLevel, minLevel: LogLevel): boolean => {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel]
}

// `l.warn`/`l.debug` keep their variadic `...args` shape, so a trailing options
// object is only lifted into structured fields when every key belongs to
// LogWriteOptions. Anything else stays an ordinary interpolation argument.
const isLogWriteOptions = (value: unknown): value is LogWriteOptions => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    return false
  }

  const keys = Object.keys(value)
  return keys.length > 0 && keys.every((key) => LOG_WRITE_OPTION_KEYS.includes(key))
}

const toShorthandWriteOptions = (args: readonly unknown[]): LogWriteOptions => {
  if (args.length === 1 && isLogWriteOptions(args[0])) {
    return args[0]
  }

  return { args }
}

const makeSinkEvent = (
  level: LogLevel,
  message: string,
  runId: string,
  baseContext: LogContext,
  options?: LogWriteOptions
): LogSinkEvent => {
  const asyncContext = getLogContext()
  const mergedContext = sanitizeLogContext(mergeContext(baseContext, asyncContext, options?.context))
  const contextKeys = Object.keys(mergedContext)
  const command = getContextString(mergedContext, 'command')
  const step = getContextString(mergedContext, 'step')

  return {
    timestamp: getTimestamp(),
    level,
    message: sanitizeLogText(message),
    category: options?.category ?? 'general',
    runId,
    ...(command ? { command } : {}),
    ...(step ? { step } : {}),
    ...(contextKeys.length > 0 ? { context: mergedContext } : {}),
    ...(options?.metadata ? { metadata: sanitizeLogMetadata(options.metadata) } : {}),
    ...(options?.humanTable ? { humanTable: sanitizeHumanTable(options.humanTable) } : {}),
    ...(options?.humanSections ? { humanSections: sanitizeHumanSections(options.humanSections) } : {}),
    indent: options?.indent ?? true,
    args: sanitizeLogArgs(options?.args ?? [])
  }
}

const writeSinkFailure = (error: unknown): void => {
  const message = sanitizeLogText(error instanceof Error ? error.message : String(error))
  const timestamp = getTimestamp()
  console.error(`[${timestamp}] \u2716   Logger sink failure: ${message}`)
}

export const createLogger = (options: CreateLoggerOptions = {}): Logger => {
  const runId = options.runId ?? createRunId()
  const baseContext = options.context ?? {}
  const config: MutableLoggerConfig = {
    sinks: options.sinks ? [...options.sinks] : [],
    minLevel: options.minLevel ?? 'info',
    suppressedCategories: options.suppressedCategories ?? []
  }
  let sinkFailureReported = false

  const emit = (event: LogSinkEvent): void => {
    for (const sink of config.sinks) {
      try {
        sink(event)
      } catch (error) {
        if (!sinkFailureReported) {
          sinkFailureReported = true
          writeSinkFailure(error)
        }
      }
    }
  }

  const write = (level: LogLevel, message: string, writeOptions?: LogWriteOptions): void => {
    if (!shouldEmitLevel(level, config.minLevel)) {
      return
    }
    const category: LogCategory = writeOptions?.category ?? 'general'
    if (config.suppressedCategories.includes(category)) {
      return
    }
    emit(makeSinkEvent(level, message, runId, baseContext, writeOptions))
  }

  const logger: Logger = {
    config,
    write,
    debug: (message: string, ...args: unknown[]) => {
      write('debug', message, toShorthandWriteOptions(args))
    },
    warn: (message: string, ...args: unknown[]) => {
      write('warn', message, toShorthandWriteOptions(args))
    },
    error: (message, errorObj) => {
      if (errorObj instanceof Error) {
        write('error', `${message}: ${errorObj.message}`, {
          metadata: { error: errorObj }
        })
        if (errorObj.stack) {
          write('error', errorObj.stack, { indent: false })
        }
        return
      }

      if (errorObj === undefined) {
        write('error', message)
        return
      }

      write('error', message, { args: [errorObj] })
    },
    withContext: (context) => {
      return createLogger({
        runId,
        context: { ...baseContext, ...context },
        sinks: config.sinks,
        minLevel: config.minLevel,
        suppressedCategories: config.suppressedCategories
      })
    }
  }

  return logger
}
