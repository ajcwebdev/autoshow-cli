import { stripAnsi } from '~/utils/terminal-colors'

import type { Logger, LogWriteOptions } from '~/types'

export const captureConsole = (fn: () => void): { stdout: string[]; stderr: string[] } => {
  const stdout: string[] = []
  const stderr: string[] = []
  const originalLog = console.log
  const originalWarn = console.warn
  const originalError = console.error

  console.log = (...args: unknown[]) => {
    stdout.push(String(args[0] ?? ''))
  }
  console.warn = (...args: unknown[]) => {
    stderr.push(String(args[0] ?? ''))
  }
  console.error = (...args: unknown[]) => {
    stderr.push(String(args[0] ?? ''))
  }

  try {
    fn()
  } finally {
    console.log = originalLog
    console.warn = originalWarn
    console.error = originalError
  }

  return { stdout, stderr }
}

export const withColorEnv = <T>(
  env: { forceColor?: string | undefined; noColor?: string | undefined },
  fn: () => T
): T => {
  const originalForceColor = process.env['FORCE_COLOR']
  const originalNoColor = process.env['NO_COLOR']

  if (env.forceColor === undefined) {
    delete process.env['FORCE_COLOR']
  } else {
    process.env['FORCE_COLOR'] = env.forceColor
  }

  if (env.noColor === undefined) {
    delete process.env['NO_COLOR']
  } else {
    process.env['NO_COLOR'] = env.noColor
  }

  try {
    return fn()
  } finally {
    if (originalForceColor === undefined) {
      delete process.env['FORCE_COLOR']
    } else {
      process.env['FORCE_COLOR'] = originalForceColor
    }

    if (originalNoColor === undefined) {
      delete process.env['NO_COLOR']
    } else {
      process.env['NO_COLOR'] = originalNoColor
    }
  }
}

export const hasAnsi = (text: string): boolean => stripAnsi(text) !== text

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
    config: { sinks: [], minLevel: 'info' }
  }
  return { logger, writes }
}
