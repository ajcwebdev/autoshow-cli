import type { CaptureConsoleOptions, ConsoleCapture, ConsoleMethod, Logger, LogSink, LogSinkEvent, LogWriteOptions } from '~/types'
import { l } from '~/utils/app-logger/app-logger'
import { createHumanSink } from '~/utils/app-logger/sinks/human-sink'
import { stripAnsi } from '~/utils/terminal-colors'

const CAPTURED_METHODS: readonly ConsoleMethod[] = ['log', 'warn', 'error', 'info', 'debug']

const CHANNEL: Readonly<Record<ConsoleMethod, keyof ConsoleCapture>> = {
  log: 'stdout',
  info: 'stdout',
  debug: 'stdout',
  warn: 'stderr',
  error: 'stderr'
}

export const captureConsole = async (
  fn: () => void | Promise<void>,
  options: CaptureConsoleOptions = {}
): Promise<ConsoleCapture> => {
  const captured: ConsoleCapture = { stdout: [], stderr: [] }
  const original = Object.fromEntries(
    CAPTURED_METHODS.map((method) => [method, console[method]])
  ) as Record<ConsoleMethod, (...args: unknown[]) => void>

  const record = (method: ConsoleMethod, args: unknown[]): void => {
    const line = args.map((arg) => typeof arg === 'string' ? arg : Bun.inspect(arg)).join(' ')
    captured[CHANNEL[method]].push(options.strip === true ? stripAnsi(line) : line)
  }

  for (const method of CAPTURED_METHODS) {
    console[method] = (...args: unknown[]) => record(method, args)
  }

  const originalSinks = options.interactiveHumanSink === true ? [...l.config.sinks] : undefined
  const originalSuppressed = [...l.config.suppressedCategories]
  if (originalSinks) {
    l.config.sinks.length = 0
    l.config.sinks.push(createHumanSink({ interactive: true }))
  }

  try {
    await fn()
  } finally {
    for (const method of CAPTURED_METHODS) {
      console[method] = original[method]
    }
    if (originalSinks) {
      l.config.sinks.length = 0
      l.config.sinks.push(...originalSinks)
    }
    l.config.suppressedCategories.length = 0
    l.config.suppressedCategories.push(...originalSuppressed)
    for (const line of captured.stdout) original.log(line)
    for (const line of captured.stderr) original.error(line)
  }

  return captured
}

export const captureConsoleText = async (
  fn: () => void | Promise<void>,
  options: CaptureConsoleOptions = {}
): Promise<{ stdout: string, stderr: string }> => {
  const captured = await captureConsole(fn, options)
  return { stdout: captured.stdout.join('\n'), stderr: captured.stderr.join('\n') }
}

export const captureLogEvents = async <T>(
  run: () => Promise<T> | T
): Promise<{ result: T, events: LogSinkEvent[] }> => {
  const originalSinks = [...l.config.sinks]
  const originalSuppressed = [...l.config.suppressedCategories]
  const events: LogSinkEvent[] = []
  l.config.sinks.length = 0
  l.config.sinks.push((event) => {
    events.push(event)
  })

  try {
    return { result: await run(), events }
  } finally {
    l.config.sinks.length = 0
    l.config.sinks.push(...originalSinks)
    l.config.suppressedCategories.length = 0
    l.config.suppressedCategories.push(...originalSuppressed)
  }
}

export const createCapturingLogger = (): {
  logger: Logger
  writes: Array<{ message: string; options?: LogWriteOptions }>
} => {
  const writes: Array<{ message: string; options?: LogWriteOptions }> = []
  const logger: Logger = {
    write: (_level, message, options) => {
      writes.push(options === undefined ? { message } : { message, options })
    },
    debug: () => {},
    warn: () => {},
    error: () => {},
    withContext: () => logger,
    config: { sinks: [], minLevel: 'info', suppressedCategories: [] }
  }
  return { logger, writes }
}

export const withLogSinks = async <T>(sinks: readonly LogSink[], run: () => Promise<T> | T): Promise<T> => {
  const originalSinks = [...l.config.sinks]
  const originalSuppressed = [...l.config.suppressedCategories]
  l.config.sinks.length = 0
  l.config.sinks.push(...sinks)
  try {
    return await run()
  } finally {
    l.config.sinks.length = 0
    l.config.sinks.push(...originalSinks)
    l.config.suppressedCategories.length = 0
    l.config.suppressedCategories.push(...originalSuppressed)
  }
}
