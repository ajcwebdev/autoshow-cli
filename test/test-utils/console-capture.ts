import type { ConsoleMethod, Logger, LogSink, LogSinkEvent, LogWriteOptions } from '~/types'
import { l } from '~/utils/app-logger/app-logger'
import { createHumanSink } from '~/utils/app-logger/sinks/human-sink'
import { stripAnsi } from '~/utils/terminal-colors'

export type ConsoleCapture = {
  stdout: string[]
  stderr: string[]
}

type CaptureConsoleOptions = {
  // Strip ANSI before recording, so assertions do not depend on the color regime.
  strip?: boolean
  // Swap in an interactive human sink for the duration. Under the non-TTY test
  // runner the default sink routes info-level events to stderr, which leaves
  // `stdout` empty for tests that mean to assert on the stdout channel.
  interactiveHumanSink?: boolean
}

const CAPTURED_METHODS: readonly ConsoleMethod[] = ['log', 'warn', 'error', 'info', 'debug']

const CHANNEL: Readonly<Record<ConsoleMethod, keyof ConsoleCapture>> = {
  log: 'stdout',
  info: 'stdout',
  debug: 'stdout',
  warn: 'stderr',
  error: 'stderr'
}

/**
 * Single console-capture helper for the whole suite.
 *
 * Captured lines are replayed into the preloaded test harness once the capture
 * window closes, so a capture no longer swallows output that a failing test
 * needs: the harness still buffers it and dumps it only when the test fails
 * (ADR-019). Restoration happens in `finally`, including when `fn` throws.
 */
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
    // Replay through the restored (harness-owned) console so failures stay debuggable.
    for (const line of captured.stdout) original.log(line)
    for (const line of captured.stderr) original.error(line)
  }

  return captured
}

/** `captureConsole` for suites that assert against one joined string per channel. */
export const captureConsoleText = async (
  fn: () => void | Promise<void>,
  options: CaptureConsoleOptions = {}
): Promise<{ stdout: string, stderr: string }> => {
  const captured = await captureConsole(fn, options)
  return { stdout: captured.stdout.join('\n'), stderr: captured.stderr.join('\n') }
}

/**
 * Structured counterpart to `captureConsole`: swaps the global logger's sinks for a
 * collector, so assertions read `LogSinkEvent` fields (category, metadata, humanTable)
 * instead of re-parsing rendered text.
 */
export const captureLogEvents = async <T>(
  run: () => Promise<T> | T
): Promise<{ result: T, events: LogSinkEvent[] }> => {
  const originalSinks = [...l.config.sinks]
  // Category suppression is process-wide state a command under test may set; snapshot it so
  // one suite cannot silently mute another's events.
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

/**
 * In-memory `Logger` for the many modules that accept an injected `TableLogger`.
 * Records the `write` arguments verbatim so table-builder contracts can assert on
 * the structured options rather than rendered output.
 */
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

/** Swap the global logger's sinks for the duration of `run`, restoring in `finally`. */
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
