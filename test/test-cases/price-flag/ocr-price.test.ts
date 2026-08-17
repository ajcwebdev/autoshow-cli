import { expect, test } from 'bun:test'
import { runCommand } from '../../test-utils/test-helpers'

test('extract URL --price estimates firecrawl without fetching a live article', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', 'https://example.com/articles/story.html', '--url-provider', 'firecrawl', '--price'],
  )

  expect(result.exitCode).toBe(0)
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('firecrawl')
  expect(output).not.toContain('Firecrawl credits apply; exact cost is not estimated locally.')
})
