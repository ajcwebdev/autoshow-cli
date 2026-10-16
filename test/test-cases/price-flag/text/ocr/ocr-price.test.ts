import { expect, test } from 'bun:test'
import { runCommand } from '../../../../test-utils/test-helpers'

test('extract URL --price estimates spider without fetching a live article', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', 'https://example.com/articles/story.html', '--provider', 'spider', '--price', '--json'],
  )

  expect(result.exitCode).toBe(0)
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Estimate:')
  expect(output).toContain('spider')
  expect(output).not.toContain('Spider credits apply; exact cost is not estimated locally.')
})
