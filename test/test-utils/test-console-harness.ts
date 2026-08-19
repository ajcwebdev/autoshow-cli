import { mock } from 'bun:test'
import * as bunTest from 'bun:test'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { ConsoleMethod, TestBuffer } from '~/types'

const harnessFlag = Symbol.for('autoshow.testConsoleHarness')
const installed = globalThis as typeof globalThis & { [harnessFlag]?: true }

if (installed[harnessFlag] !== true) {
  installed[harnessFlag] = true

  const buffers = new AsyncLocalStorage<TestBuffer>()
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
    const store = buffers.getStore()
    if (store) {
      store.lines.push(formatArgs(args))
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
              const store = buffers.getStore()
              if (store) {
                store.failed = true
              }
              throw error
            })
          }
          return result
        } catch (error) {
          const store = buffers.getStore()
          if (store) {
            store.failed = true
          }
          throw error
        }
      }
    },
  })

  const runWithBuffer = (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) => {
      const incoming = buffers.getStore()
      const store = incoming ?? { lines: [], failed: false }
      const run = (): unknown => {
        const finish = (threw: boolean): void => {
          if (store.failed || threw) {
            dump(store)
          }
        }
        try {
          const result = fn(...args)
          if (result && typeof (result as Promise<unknown>).then === 'function') {
            return (result as Promise<unknown>).then(
              (value) => {
                finish(false)
                return value
              },
              (error: unknown) => {
                finish(true)
                throw error
              }
            )
          }
          finish(false)
          return result
        } catch (error) {
          finish(true)
          throw error
        }
      }
      return incoming ? run() : buffers.run(store, run)
    }

  const wrapRegistrar = (original: unknown): unknown => {
    if (typeof original !== 'function') {
      return original
    }
    const wrapped = (...args: unknown[]) => {
      const next = args.map((arg) => typeof arg === 'function' ? runWithBuffer(arg as (...inner: unknown[]) => unknown) : arg)
      return original(...next)
    }
    return new Proxy(wrapped, {
      get(_target, property) {
        return wrapRegistrar(Reflect.get(original, property, original))
      },
    })
  }

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
    test: wrapRegistrar(bunTest.test),
    it: wrapRegistrar(bunTest.it),
  }))
}
