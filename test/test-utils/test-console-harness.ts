import { afterEach, beforeEach, mock } from 'bun:test'
import * as bunTest from 'bun:test'

type ConsoleMethod = 'log' | 'warn' | 'error' | 'info' | 'debug'
type TestBuffer = {
  lines: string[]
  failed: boolean
}

const harnessFlag = Symbol.for('autoshow.testConsoleHarness')
const installed = globalThis as typeof globalThis & { [harnessFlag]?: true }

if (installed[harnessFlag] !== true) {
  installed[harnessFlag] = true

  let current: TestBuffer | undefined
  const originalConsole: Record<ConsoleMethod, (...args: unknown[]) => void> = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
  }

  const formatArgs = (args: unknown[]): string => args.map((arg) => {
    if (typeof arg === 'string') {
      return arg
    }
    return Bun.inspect(arg)
  }).join(' ')

  const write = (method: ConsoleMethod, args: unknown[]): void => {
    if (current) {
      current.lines.push(formatArgs(args))
      return
    }
    originalConsole[method](...args)
  }

  const dump = (store: TestBuffer): void => {
    if (store.lines.length === 0) {
      return
    }
    originalConsole.error(store.lines.join('\n'))
    store.lines.length = 0
  }

  const wrapMatchers = (matchers: object): object => new Proxy(matchers, {
    get(target, property) {
      const value = Reflect.get(target, property, target)
      if (value !== null && typeof value === 'object') {
        return wrapMatchers(value)
      }
      if (typeof value !== 'function') {
        return value
      }
      return (...args: unknown[]) => {
        try {
          const result = value.apply(target, args)
          if (result && typeof (result as Promise<unknown>).then === 'function') {
            return (result as Promise<unknown>).catch((error: unknown) => {
              if (current) {
                current.failed = true
              }
              throw error
            })
          }
          return result
        } catch (error) {
          if (current) {
            current.failed = true
          }
          throw error
        }
      }
    },
  })

  const rawExpect = bunTest.expect
  const wrappedExpect = ((actual?: unknown, message?: string) => {
    return wrapMatchers(rawExpect(actual as never, message))
  }) as typeof rawExpect
  Object.assign(wrappedExpect, rawExpect)

  console.log = (...args: unknown[]) => write('log', args)
  console.warn = (...args: unknown[]) => write('warn', args)
  console.error = (...args: unknown[]) => write('error', args)
  console.info = (...args: unknown[]) => write('info', args)
  console.debug = (...args: unknown[]) => write('debug', args)

  mock.module('bun:test', () => ({
    ...bunTest,
    expect: wrappedExpect,
  }))

  beforeEach(() => {
    current = { lines: [], failed: false }
  })

  afterEach(() => {
    if (current?.failed) {
      dump(current)
    }
    current = undefined
  })
}
