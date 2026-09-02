import type { CreateLoggerOptions, LogContext, Logger, LogLevel, LogSinkEvent, LogWriteOptions, MutableLoggerConfig } from '~/types'
import { LOG_LEVEL_PRIORITY } from '~/types'
import { serializeDiagnosticError } from '~/utils/error-handler'
import { getLogContext, getSuppressedLogCategories } from '~/utils/app-logger/context-store'
import { sanitizeLogContext, sanitizeLogMetadata, sanitizeLogText } from '~/utils/app-logger/redaction'

const getTimestamp = (): string => new Date().toISOString()

export const createRunId = (): string => {
  const timestampPart = Date.now().toString(36)
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `${timestampPart}-${randomPart}`
}

const mergeContext = (...contexts: Array<LogContext | undefined>): LogContext => {
  const merged: Record<string, string | number | boolean | null | undefined> = {}
  for (const context of contexts) if (context) Object.assign(merged, context)
  return merged
}

const getContextString = (context: LogContext, key: string): string | undefined => {
  const value = context[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

const shouldEmitLevel = (level: LogLevel, minLevel: LogLevel): boolean =>
  LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel]

const makeSinkEvent = (
  level: LogLevel,
  message: string,
  runId: string,
  baseContext: LogContext,
  options: LogWriteOptions
): LogSinkEvent => {
  const mergedContext = sanitizeLogContext(mergeContext(baseContext, getLogContext(), options.context))
  const command = getContextString(mergedContext, 'command')
  const step = getContextString(mergedContext, 'step')
  return {
    schemaVersion: 1,
    type: 'log',
    timestamp: getTimestamp(),
    level,
    message: sanitizeLogText(message),
    category: options.category,
    runId,
    ...(command ? { command } : {}),
    ...(step ? { step } : {}),
    ...(Object.keys(mergedContext).length > 0 ? { context: mergedContext } : {}),
    ...(options.metadata ? { metadata: sanitizeLogMetadata(options.metadata) } : {}),
    ...(options.error !== undefined ? { error: serializeDiagnosticError(options.error) } : {})
  }
}

const writeSinkFailure = (error: unknown): void => {
  const message = sanitizeLogText(error instanceof Error ? error.message : String(error))
  console.error(`[${getTimestamp()}] ✖ Logger sink failure: ${message}`)
}

export const createLogger = (options: CreateLoggerOptions = {}): Logger => {
  const runId = options.runId ?? createRunId()
  const baseContext = options.context ?? {}
  const config: MutableLoggerConfig = {
    sinks: options.sinks ? [...options.sinks] : [],
    minLevel: options.minLevel ?? 'info',
    runId
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

  const write = (level: LogLevel, message: string, writeOptions: LogWriteOptions): void => {
    if (!shouldEmitLevel(level, config.minLevel)) return
    if ((level === 'debug' || level === 'info') && getSuppressedLogCategories().has(writeOptions.category)) return
    emit(makeSinkEvent(level, message, runId, baseContext, writeOptions))
  }

  return {
    config,
    write,
    debug: (message, writeOptions) => write('debug', message, writeOptions),
    warn: (message, writeOptions) => write('warn', message, writeOptions),
    error: (message, writeOptions) => write('error', message, writeOptions)
  }
}
