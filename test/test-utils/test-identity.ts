import type { AsyncLocalStorage } from 'node:async_hooks'
import type { TestBuffer } from '~/types'

export const TEST_BUFFER_STORE = Symbol.for('autoshow.testConsoleHarness.buffers')

/**
 * The name the running test was registered with, as recorded by the preloaded console harness.
 * Helpers attach it to their command metrics so a command is matched to the test that ran it,
 * even when the test was registered through a shared helper.
 */
export const currentRegisteredTestName = (): string | null => {
  const store = (globalThis as typeof globalThis & { [TEST_BUFFER_STORE]?: AsyncLocalStorage<TestBuffer> })[TEST_BUFFER_STORE]?.getStore()
  return typeof store?.testName === 'string' ? store.testName : null
}
