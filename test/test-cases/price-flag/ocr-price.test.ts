import { expect, test } from 'bun:test'
import { runCommand } from '../../test-utils/test-helpers'

const articleUrl = 'https://ajcwebdev.com'

test('bun autoshow extract https://ajcwebdev.com --url-provider firecrawl --price', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', articleUrl, '--url-provider', 'firecrawl', '--price'],
    { testName: 'bun autoshow extract https://ajcwebdev.com --url-provider firecrawl --price' }
  )

  expect(result.exitCode).toBe(0)
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('firecrawl')
  expect(output).not.toContain('Firecrawl credits apply; exact cost is not estimated locally.')
})

test('bun autoshow extract https://ajcwebdev.com --url-provider glm-reader --price', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', articleUrl, '--url-provider', 'glm-reader', '--price'],
    { testName: 'bun autoshow extract https://ajcwebdev.com --url-provider glm-reader --price' }
  )

  expect(result.exitCode).toBe(0)
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Total estimated cost: 1.00¢ (1.000¢)')
  expect(output).toContain('glm-reader')
  expect(output).toContain('extraction.txt')
  expect(output).toContain('manifest.json')
})
