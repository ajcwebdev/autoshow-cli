import { afterAll, expect, test } from 'bun:test'
import { join } from 'node:path'
import { childEnv } from '~/utils/child-env'
import { readLinksInputFile } from '~/cli/commands/setup-and-utilities/links/links-input-parser'
import { collectTextInputFiles, resolveWriteTextProjectDefaults } from '~/cli/commands/text/write/text-input-utils'
import { readSinglePipelineItemRecord } from '~/cli/commands/command-shared/pipeline-manifest'
import { createTempDirTracker } from '../../../test-utils/temp-dirs'

const CHAPTERS = 'input/examples/tts/harborlight-chapters'
const ARTICLE = 'input/examples/document/harborlight-article.html'
const tempDirs = createTempDirTracker('autoshow-documentation-text-')
afterAll(async () => await tempDirs.cleanup())

// Keep this expected inventory independent of the ignore rules it verifies.
const PORTABLE_FIXTURES = [
  'input/examples/harborlight-README.md',
  'input/examples/harborlight-LICENSE.txt',
  'input/examples/batch/provider-docs.md',
  'input/examples/document/harborlight-article.html',
  'input/examples/document/harborlight-field-notes.md',
  'input/examples/document/harborlight-field-notes.pdf',
  'input/examples/comic/harborlight-camp-treatment.md',
  'input/examples/comic/harborlight-camp-treatment.pdf',
  'input/examples/comic/harborlight-camp--style-seed.svg',
  'input/examples/comic/harborlight-camp--style-seed.png',
  'input/examples/tts/harborlight-chapters/01-first-light.md',
  'input/examples/tts/harborlight-chapters/02-night-watch.md',
  'input/examples/image/harborlight-mug.svg',
  'input/examples/image/harborlight-mug.png',
  'input/examples/image/harborlight-mug.jpg',
  'input/examples/image/harborlight-mug-mask.svg',
  'input/examples/image/harborlight-mug-mask.png',
  'input/examples/video/harborlight-start.svg',
  'input/examples/video/harborlight-start.png',
  'input/examples/video/harborlight-end.svg',
  'input/examples/video/harborlight-end.png',
  'input/examples/video/harborlight-jacket.svg',
  'input/examples/video/harborlight-jacket.png',
  'input/examples/video/harborlight-glasses.svg',
  'input/examples/video/harborlight-glasses.png',
  'input/examples/video/01-two-speaker-speech.mp4',
  'input/examples/video/01-two-speaker-speech.transcript.json',
  'input/examples/video/01-two-speaker-speech.vtt',
  'input/examples/video/README.md',
  'input/examples/audio/01-two-speaker-speech-stereo.wav'
] as const

const ignoredPaths = async (paths: readonly string[]): Promise<string[]> => {
  const child = Bun.spawn(['git', 'check-ignore', '--no-index', '--stdin'], {
    env: childEnv(), stdin: new TextEncoder().encode(`${paths.join('\n')}\n`),
    stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(20_000)
  })
  const [code, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()
  ])
  if (code > 1) throw new Error(`Read-only ignore check failed (${code}): ${stderr}`)
  return stdout.split('\n').map(line => line.trim()).filter(Boolean)
}

test('the maintained provider documentation list uses the actual URL-file parser and rejects empty or non-URL inputs', async () => {
  expect(await readLinksInputFile('input/examples/batch/provider-docs.md')).toEqual([
    'https://spider.cloud/pricing/',
    'https://docs.zyte.com/zyte-api/pricing.html'
  ])
  const directory = await tempDirs.make()
  const empty = join(directory, 'empty.md')
  const nonUrl = join(directory, 'non-url.md')
  await Bun.write(empty, ' \n\t\n')
  await Bun.write(nonUrl, '# Documentation notes\nspider.cloud/pricing/\ndocs.zyte.com/zyte-api/pricing.html\n')
  await expect(readLinksInputFile(empty)).rejects.toThrow('Links input file is empty')
  await expect(readLinksInputFile(nonUrl)).rejects.toThrow('No valid remote URLs found')
})

test('the narration directory discovers exactly two ordered prose chapters without lyric project defaults or controls fixtures', async () => {
  const files = await collectTextInputFiles(CHAPTERS)
  expect(files).toEqual([
    `${CHAPTERS}/01-first-light.md`,
    `${CHAPTERS}/02-night-watch.md`
  ])
  expect(await resolveWriteTextProjectDefaults(CHAPTERS, {}, new Set())).toBeUndefined()
  for (const file of files) {
    const text = await Bun.file(file).text()
    expect(text.trim().split(/\s+/).length).toBeGreaterThan(100)
    expect(text).toContain('Mira')
    expect(text).toContain('Papa Bear')
    expect(file).not.toContain('/controls/')
    expect(text).not.toMatch(/^---\s*$|\[(?:pause|emotion|laugh|whisper)[^\]]*\]/im)
    expect(await resolveWriteTextProjectDefaults(file, {}, new Set())).toBeUndefined()
  }
})

test('actual offline HTML extraction retains the Harborlight narrative title, headings and substantive paragraphs', async () => {
  const directory = await tempDirs.make()
  const config = join(directory, 'empty-config.json')
  const preload = join(directory, 'network-forbidden.ts')
  const calls = join(directory, 'network-attempts.txt')
  const output = join(directory, 'article')
  await Bun.write(config, '{}\n')
  await Bun.write(preload, `import { appendFileSync } from 'node:fs'
globalThis.fetch = () => {
  appendFileSync(${JSON.stringify(calls)}, 'attempt\\n')
  throw new Error('Network forbidden during documentation HTML verification')
}
`)
  const child = Bun.spawn([
    process.execPath, '--no-env-file', '--preload', preload,
    'src/cli/create-cli.ts', 'extract', ARTICLE, '--json', '--config-path', config, '--output-dir', output
  ], {
    env: childEnv({ set: { HOME: directory } }),
    stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(20_000)
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()
  ])
  expect({ exitCode, stdout, stderr }).toMatchObject({ exitCode: 0 })
  expect(JSON.parse(stdout)).toMatchObject({ status: 'success' })
  const text = await Bun.file(join(output, 'extraction.txt')).text()
  expect(text).toContain('## Make a record before making a story')
  expect(text).toContain('## Return to the same viewpoint')
  expect(text).toContain('A fishing boat crossed the harbor and broke the reflection into moving pieces.')
  expect(text).toContain('Mira wrote down the sound without inventing a position for it.')
  expect(text.trim().split(/\s+/).length).toBeGreaterThan(250)
  const record = await readSinglePipelineItemRecord(output, { command: 'extract', extractRoute: 'article' })
  expect(record?.['step1']).toMatchObject({ title: 'A day of observations at Harborlight' })
  expect(await Bun.file(calls).exists()).toBe(false)
}, 30_000)

test('all thirty portable documentation inputs exist and survive exact Git ignore rules', async () => {
  expect(PORTABLE_FIXTURES).toHaveLength(30)
  expect(new Set(PORTABLE_FIXTURES).size).toBe(30)
  for (const path of PORTABLE_FIXTURES) {
    expect(await Bun.file(path).exists()).toBe(true)
    expect(Bun.file(path).size).toBeGreaterThan(0)
  }
  expect(await ignoredPaths(PORTABLE_FIXTURES)).toEqual([])
})

test('the allowlist keeps private images, videos, extra chapters and controls ignored without creating probes', async () => {
  const privatePaths = [
    'input/examples/image/private-portrait.png',
    'input/examples/image/private-drawing.svg',
    'input/examples/video/private-recording.mp4',
    'input/examples/video/private-frame.png',
    'input/examples/tts/harborlight-chapters/03-private-notes.md',
    'input/examples/tts/controls/emotion/private-delivery.txt',
    'input/examples/tts/private-controls.txt'
  ]
  expect((await ignoredPaths(privatePaths)).sort()).toEqual([...privatePaths].sort())
})
