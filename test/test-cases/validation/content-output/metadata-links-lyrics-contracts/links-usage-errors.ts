import { expect } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runLinksWithArgv } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import type { FetchFn } from '~/types'

/**
 * Asserts `links <argv>` is rejected during validation, before it reaches the network.
 *
 * Every rejection case in these suites relies on `assertKnownSections` throwing ahead of
 * the fetch loop, but nothing used to enforce that ordering. When a section that a test
 * asserted was invalid later became valid — as happened when `--grok stt` shipped — the
 * assertion did not merely fail: `runLinksWithArgv` fell through to real `fetch` and
 * wrote a real output file, turning a unit test into a live network call.
 *
 * Injecting a fetch that throws and counting its calls closes that off. If validation
 * ever stops rejecting, the test fails on the unmet rejection or the non-zero attempt
 * count, and no request leaves the machine either way. `outputPath` is redirected to a
 * temp path so a regression cannot write into the project tree; nothing should reach it.
 */
export const expectLinksUsageError = async (argv: string[], message: string): Promise<void> => {
  let fetchAttempts = 0
  const forbiddenFetch: FetchFn = (input) => {
    fetchAttempts += 1
    return Promise.reject(new Error(`links validation test attempted a network fetch: ${String(input)}`))
  }

  await expect(runLinksWithArgv(argv, {
    fetchImpl: forbiddenFetch,
    outputPath: join(tmpdir(), 'autoshow-links-usage-error-must-not-be-written.md')
  })).rejects.toThrow(message)

  expect(fetchAttempts).toBe(0)
}
