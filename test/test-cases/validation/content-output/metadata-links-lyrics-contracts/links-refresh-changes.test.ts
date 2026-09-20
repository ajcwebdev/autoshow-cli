import { expect, test } from 'bun:test'
import type { FetchFn, LinksRefreshMetadata } from '~/types'
import {
  getLinksRefreshChangesPath,
  getLinksRefreshMetadataPath,
  runLinksWithArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import {
  describeLinkChange,
  diffLines,
  splitLinksBundle
} from '~/cli/commands/setup-and-utilities/links/links-refresh-changes'
import { linksTestOutputPath } from './shared'

const markdownResponse = (content: string): Response =>
  new Response(content, { headers: { 'content-type': 'text/markdown' } })

const applyOps = (ops: NonNullable<ReturnType<typeof diffLines>>): { before: string[], after: string[] } => ({
  before: ops.filter(op => op.kind !== 'add').map(op => op.line),
  after: ops.filter(op => op.kind !== 'remove').map(op => op.line)
})

test('bundle splitter returns each source section and does not attach a failed or empty link to its neighbour', () => {
  const bundle = [
    '<!-- Source: https://a.test/one.md -->', '', '# One', 'body', '',
    '<!-- Failed to fetch https://b.test/gone.md -->', '',
    '<!-- Empty response from https://c.test/empty.md -->', '',
    '<!-- Source: blob:https://d.test/two -->', '', '# Two', ''
  ].join('\n')

  expect([...splitLinksBundle(bundle)]).toEqual([
    ['https://a.test/one.md', '# One\nbody'],
    ['blob:https://d.test/two', '# Two']
  ])
})

test('line diff reconstructs both sides and is minimal', () => {
  const before = ['a', 'b', 'c', 'd', 'e', 'f']
  const after = ['a', 'x', 'c', 'e', 'f', 'g']
  const ops = diffLines(before, after)

  expect(ops).toBeDefined()
  expect(applyOps(ops!)).toEqual({ before, after })
  // Longest common subsequence is a, c, e, f, so two lines leave and two arrive.
  expect(ops!.filter(op => op.kind === 'remove').map(op => op.line)).toEqual(['b', 'd'])
  expect(ops!.filter(op => op.kind === 'add').map(op => op.line)).toEqual(['x', 'g'])
})

test('line diff handles empty sides and identical input', () => {
  expect(diffLines([], ['a'])).toEqual([{ kind: 'add', line: 'a' }])
  expect(diffLines(['a'], [])).toEqual([{ kind: 'remove', line: 'a' }])
  expect(diffLines(['a', 'b'], ['a', 'b'])).toEqual([{ kind: 'equal', line: 'a' }, { kind: 'equal', line: 'b' }])
})

test('a change is rendered as hunks with line numbers and two lines of context', () => {
  const before = Array.from({ length: 12 }, (_, index) => `line ${index + 1}`)
  const after = before.map(line => line === 'line 7' ? 'line seven' : line)
  const change = describeLinkChange(before.join('\n'), after.join('\n'))

  expect(change.linesAdded).toBe(1)
  expect(change.linesRemoved).toBe(1)
  expect(change.rendered.split('\n')).toEqual([
    '````diff', '@@ -5 +5 @@', ' line 5', ' line 6', '-line 7', '+line seven', ' line 8', ' line 9', '````'
  ])
})

test('a diff that contains a code fence is wrapped in a longer fence', () => {
  const change = describeLinkChange('intro\n`````js\nold()\n`````', 'intro\n`````js\nnew()\n`````')

  expect(change.rendered.startsWith('``````diff\n')).toBe(true)
  expect(change.rendered.endsWith('\n``````')).toBe(true)
})

test('a changed minified line is clipped to the window around its first difference', () => {
  const filler = '"k":"v",'.repeat(2000)
  const change = describeLinkChange(`{${filler}"at":"2026-01-01"}`, `{${filler}"at":"2027-05-05"}`)
  const [removed, added] = change.rendered.split('\n').filter(line => /^[-+]/.test(line))

  expect(removed).toMatch(/^-….*"at":"2026-01-01"\}$/)
  expect(added).toMatch(/^\+….*"at":"2027-05-05"\}$/)
  expect(removed!.length).toBeLessThan(320)
})

test('texts too different for a line diff are summarised with counts instead', () => {
  const before = Array.from({ length: 2000 }, (_, index) => `before ${index}`)
  const after = Array.from({ length: 2000 }, (_, index) => `after ${index}`)
  const change = describeLinkChange(before.join('\n'), after.join('\n'))

  expect(change).toEqual({
    linesAdded: 2000,
    linesRemoved: 2000,
    rendered: 'Too different for a line diff: 2000 lines before, 2000 lines after.'
  })
})

test('links --refresh writes a diff of each changed link from the bundle it is about to overwrite', async () => {
  const outputPath = linksTestOutputPath('refresh-changes')
  const sidecarPath = getLinksRefreshMetadataPath(outputPath)
  const changesPath = getLinksRefreshChangesPath(outputPath)
  const inputPath = linksTestOutputPath('refresh-changes-input')
  const pages: Record<string, string> = {
    'https://docs.acme.test/speech.md': '# Speech\n\n##### voice_id\n\nstring\n\n##### response_format\n\n"pcm"|"wav"',
    'https://docs.acme.test/stable.md': '# Stable\n\nnothing moves here'
  }
  const fetchImpl: FetchFn = async (input) => markdownResponse(pages[String(input)] ?? '# unexpected')
  const writeInput = async (urls: string[]): Promise<void> => { await Bun.write(inputPath, urls.join('\n')) }
  const argv = ['bun', 'src/cli/create-cli.ts', 'links', '--refresh', inputPath]

  await writeInput(Object.keys(pages))
  await runLinksWithArgv(argv, { outputPath, fetchImpl })
  const first = JSON.parse(await Bun.file(sidecarPath).text()) as LinksRefreshMetadata

  // A first refresh has nothing to compare against, so it writes no changes file.
  expect(await Bun.file(changesPath).exists()).toBe(false)
  expect(first.changesPath).toBeUndefined()

  pages['https://docs.acme.test/speech.md'] = '# Speech\n\n##### voice_id\n\nstring'
  pages['https://docs.acme.test/added.md'] = '# Added'
  await writeInput(['https://docs.acme.test/speech.md', 'https://docs.acme.test/added.md'])
  await runLinksWithArgv(argv, { outputPath, fetchImpl })
  const second = JSON.parse(await Bun.file(sidecarPath).text()) as LinksRefreshMetadata
  const changes = await Bun.file(changesPath).text()
  const speech = second.links.find(link => link.sourceUrl === 'https://docs.acme.test/speech.md')

  expect(second.changesPath).toBe(changesPath)
  expect(speech).toMatchObject({ changeStatus: 'changed', linesAdded: 0, linesRemoved: 4 })
  expect(second.links.find(link => link.sourceUrl === 'https://docs.acme.test/added.md')?.linesRemoved).toBeUndefined()
  expect(changes).toContain('1 changed, 1 new, 1 no longer selected.')
  expect(changes).toContain('## https://docs.acme.test/speech.md')
  expect(changes).toContain('-##### response_format')
  expect(changes).toContain('-"pcm"|"wav"')
  expect(changes).toContain('## New links\n\n- https://docs.acme.test/added.md')
  expect(changes).toContain('## No longer selected\n\n- https://docs.acme.test/stable.md')

  // An unchanged run rewrites the file so it never describes an older run.
  await runLinksWithArgv(argv, { outputPath, fetchImpl })
  const third = await Bun.file(changesPath).text()
  expect(third).toContain('0 changed, 0 new, 0 no longer selected.')
  expect(third).not.toContain('response_format')
})
