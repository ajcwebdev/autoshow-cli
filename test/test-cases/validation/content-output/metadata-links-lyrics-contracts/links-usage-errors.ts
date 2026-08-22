import { expect } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runLinksWithArgv } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import type { FetchFn } from '~/types'
import { expectUsageClassification } from '../../../../test-utils/cli-assertions'
import { unexpectedFetch } from '../../../../test-utils/rest-contract-helpers'

export const expectLinksUsageError = async (argv: string[], message: string): Promise<void> => {
  const guard = unexpectedFetch('links validation')

  try {
    await runLinksWithArgv(argv, {
      fetchImpl: guard.fetchImpl as unknown as FetchFn,
      outputPath: join(tmpdir(), 'autoshow-links-usage-error-must-not-be-written.md')
    })
  } catch (error) {
    expectUsageClassification(error, message)
    expect(guard.attempts()).toBe(0)
    return
  }

  expect.unreachable(`Expected links to reject with ${JSON.stringify(message)}`)
}
