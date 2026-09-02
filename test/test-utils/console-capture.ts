import type { CaptureConsoleOptions, ConsoleCapture, ConsoleMethod, LogSink, LogSinkEvent } from '~/types'
import { l } from '~/utils/app-logger/app-logger'
import { createTextSink } from '~/utils/app-logger/sinks/text-sink'
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
  if (originalSinks) {
    l.config.sinks.length = 0
    l.config.sinks.push(createTextSink({ interactive: true }))
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

export const captureProcessOutput = async <T>(
  fn: () => T | Promise<T>
): Promise<{ result: T, stdout: string, stderr: string }> => {
  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []
  const originalStdoutWrite = process.stdout.write
  const originalStderrWrite = process.stderr.write
  const capture = (chunks: string[]) => ((chunk: string | Uint8Array): boolean => {
    chunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk))
    return true
  })

  process.stdout.write = capture(stdoutChunks) as typeof process.stdout.write
  process.stderr.write = capture(stderrChunks) as typeof process.stderr.write
  try {
    return { result: await fn(), stdout: stdoutChunks.join(''), stderr: stderrChunks.join('') }
  } finally {
    process.stdout.write = originalStdoutWrite
    process.stderr.write = originalStderrWrite
  }
}

export const captureLogEvents = async <T>(
  run: () => Promise<T> | T
): Promise<{ result: T, events: LogSinkEvent[] }> => {
  const originalSinks = [...l.config.sinks]
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
  }
}

export const withLogSinks = async <T>(sinks: readonly LogSink[], run: () => Promise<T> | T): Promise<T> => {
  const originalSinks = [...l.config.sinks]
  l.config.sinks.length = 0
  l.config.sinks.push(...sinks)
  try {
    return await run()
  } finally {
    l.config.sinks.length = 0
    l.config.sinks.push(...originalSinks)
  }
}
