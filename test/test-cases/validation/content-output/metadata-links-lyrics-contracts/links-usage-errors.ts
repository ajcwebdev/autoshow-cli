import { expect } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runLinksWithArgv } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import type { FetchFn } from '~/types'
import { expectUsageClassification } from '../../../../test-utils/cli-assertions'
import { unexpectedFetch } from '../../../../test-utils/rest-contract-helpers'

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
  const guard = unexpectedFetch('links validation')

  try {
    await runLinksWithArgv(argv, {
      fetchImpl: guard.fetchImpl as unknown as FetchFn,
      outputPath: join(tmpdir(), 'autoshow-links-usage-error-must-not-be-written.md')
    })
  } catch (error) {
    // Pins the classification, not only the wording: a links rejection must stay an
    // AppUsageError that exits 2, not degrade into a generic failure with the same text.
    expectUsageClassification(error, message)
    expect(guard.attempts()).toBe(0)
    return
  }

  expect.unreachable(`Expected links to reject with ${JSON.stringify(message)}`)
}
