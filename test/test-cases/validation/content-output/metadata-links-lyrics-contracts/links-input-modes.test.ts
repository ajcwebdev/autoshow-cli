import { expect, test } from 'bun:test'
import { expectLinksUsageError } from './links-usage-errors'
import {
  getDefaultLinksDirectUrlOutputFileName,
  getDefaultLinksInputOutputFileName,
  parseLinksArgv,
  readLinksInputFile,
  runLinksWithArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import { linksTestOutputPath } from './shared'

const linksTestInputPath = (name: string, extension = 'md'): string =>
  `/tmp/autoshow-links-input-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`

test('links parses a local markdown input file as standalone file mode', () => {
  const selection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'urls.md'
  ])

  expect(selection.inputFilePath).toBe('urls.md')
  expect(selection.serviceSelections.size).toBe(0)
  expect(selection.globalSections).toEqual([])
  expect(getDefaultLinksInputOutputFileName('urls.md')).toBe('urls-links.md')
  expect(getDefaultLinksInputOutputFileName('/tmp/my docs!.txt')).toBe('my-docs-links.md')
})

test('links parses refresh as a command flag', () => {
  const selection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--refresh',
    '--openai',
    'models'
  ])

  expect(selection.refresh).toBe(true)
  expect(selection.serviceSelections.get('openai')).toEqual(['models'])
  expect(selection.globalSections).toEqual([])

  const disabledSelection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--refresh=false',
    'models'
  ])

  expect(disabledSelection.refresh).toBe(false)
  expect(disabledSelection.globalSections).toEqual(['models'])
})

test('links parses one direct URL as standalone direct URL mode', () => {
  const directUrl = 'https://blog.railway.com/p/railway-for-agents'
  const selection = parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    directUrl
  ])

  expect(selection.directUrl).toBe(directUrl)
  expect(selection.inputFilePath).toBeUndefined()
  expect(selection.serviceSelections.size).toBe(0)
  expect(selection.globalSections).toEqual([])
})

test('links derives default output filenames for direct URLs from host and path', () => {
  expect(getDefaultLinksDirectUrlOutputFileName(
    'https://blog.railway.com/p/railway-for-agents'
  )).toBe('blog-railway-com-p-railway-for-agents-links.md')
  expect(getDefaultLinksDirectUrlOutputFileName(
    'blob:https://docs.scrapecreators.com/de495975-7e82-4fd9-953a-2fe2c257845e'
  )).toBe('docs-scrapecreators-com-de495975-7e82-4fd9-953a-2fe2c257845e-links.md')
})

test('links fetches exactly one direct URL through the existing combined markdown writer', async () => {
  const directUrl = 'blob:https://example.com/docs'
  const outputPath = linksTestOutputPath('direct-url-run')
  const fetchedUrls: string[] = []

  const result = await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    directUrl
  ], {
    outputPath,
    fetchImpl: async (input: string | URL | Request): Promise<Response> => {
      const url = String(input)
      fetchedUrls.push(url)

      return new Response(`# docs for ${url}\n`, {
        headers: { 'content-type': 'text/markdown' }
      })
    }
  })

  const output = await Bun.file(outputPath).text()
  expect(result.urlCount).toBe(1)
  expect(fetchedUrls).toEqual(['https://example.com/docs'])
  expect(output).toContain('<!-- Source: blob:https://example.com/docs -->')
  expect(output).toContain('# docs for https://example.com/docs')
})

test('links direct URL mode rejects selectors input files and multiple direct URLs', () => {
  const directUrl = 'https://example.com/docs'
  const expectedError = 'links direct URL mode cannot be combined with provider selectors, section selectors, input file mode, or another direct URL'

  for (const args of [
    [directUrl, 'stt'],
    ['stt', directUrl],
    ['--openai', directUrl],
    [directUrl, '--openai'],
    ['urls.md', directUrl],
    [directUrl, 'urls.md'],
    [directUrl, 'https://example.com/api']
  ]) {
    expect(() => parseLinksArgv([
      'bun',
      'src/cli/create-cli.ts',
      'links',
      ...args
    ])).toThrow(expectedError)
  }
})

test('links reads remote URLs from input files and dedupes in first-seen order', async () => {
  const inputPath = linksTestInputPath('extract')
  await Bun.write(inputPath, [
    '# Documentation links',
    '<!-- https://ignored.example.com/comment -->',
    '',
    '- https://example.com/docs',
    '- [API docs](https://example.com/api)',
    '- [duplicate docs](https://example.com/docs)',
    '- blob:https://docs.scrapecreators.com/de495975-7e82-4fd9-953a-2fe2c257845e',
    'plain prose without a URL',
    '// https://ignored.example.com/line-comment'
  ].join('\n'))

  await expect(readLinksInputFile(inputPath)).resolves.toEqual([
    'https://example.com/docs',
    'https://example.com/api',
    'blob:https://docs.scrapecreators.com/de495975-7e82-4fd9-953a-2fe2c257845e'
  ])
})

test('links fetches URL input files through the existing combined markdown writer', async () => {
  const inputPath = linksTestInputPath('run')
  const outputPath = linksTestOutputPath('input-file-run')
  const fetchedUrls: string[] = []

  await Bun.write(inputPath, [
    'https://example.com/a.md',
    '[Page](https://example.com/page)',
    'https://example.com/a.md'
  ].join('\n'))

  const result = await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    inputPath
  ], {
    outputPath,
    fetchImpl: async (input: string | URL | Request): Promise<Response> => {
      const url = String(input)
      fetchedUrls.push(url)

      return new Response(`# docs for ${url}\n`, {
        headers: { 'content-type': 'text/markdown' }
      })
    }
  })

  const output = await Bun.file(outputPath).text()
  expect(result.urlCount).toBe(2)
  expect(fetchedUrls).toEqual([
    'https://example.com/a.md',
    'https://example.com/page'
  ])
  expect(output).toContain('<!-- Source: https://example.com/a.md -->')
  expect(output).toContain('<!-- Source: https://example.com/page -->')
  expect(output).toContain('# docs for https://example.com/a.md')
})

test('links input file mode reports missing empty and no-url files as usage errors', async () => {
  const missingPath = linksTestInputPath('missing')
  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    missingPath
  ], 'Links input file not found')

  const emptyPath = linksTestInputPath('empty')
  await Bun.write(emptyPath, ' \n\t\n')
  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    emptyPath
  ], 'Links input file is empty')

  const noUrlPath = linksTestInputPath('no-url')
  await Bun.write(noUrlPath, '# Heading\n- local-file.md\nplain prose\n')
  await expectLinksUsageError([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    noUrlPath
  ], 'No valid remote URLs found in links input file')
})

test('links input file mode cannot be combined with provider or section selectors', () => {
  expect(() => parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'urls.md',
    'stt'
  ])).toThrow('links input file mode cannot be combined with provider or section selectors')

  expect(() => parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    'urls.md',
    '--openai'
  ])).toThrow('links input file mode cannot be combined with provider or section selectors')

  expect(() => parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--openai',
    'urls.md'
  ])).toThrow('links input file mode cannot be combined with provider or section selectors')
})
