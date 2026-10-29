import { afterAll, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { verifySttBenchmarkSources } from '~/tools/verify-stt-benchmark-sources'
import { resolveTranscriptVideoSource } from '~/cli/commands/stt/workflows/transcript-video/transcript-video-source'
import { PROJECT_ROOT } from '~/utils/project-root'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { createTempDirTracker } from '../../../test-utils/temp-dirs'

const tempDirs = createTempDirTracker('autoshow-stt-source-catalog-')
afterAll(async () => await tempDirs.cleanup())

const fixture = async () => {
  const root = await tempDirs.make()
  const bytes = Buffer.from('exact stored recording bytes')
  const sourcePath = join(root, 'sources/recording.mp3')
  const run = join(root, 'runs/one')
  await mkdir(join(root, 'sources'), { recursive: true })
  await mkdir(run, { recursive: true })
  await writeFile(sourcePath, bytes)
  const catalog = {
    schemaVersion: 1,
    sources: [{
      id: 'recording', path: 'sources/recording.mp3', bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'), runs: [{ path: 'runs/one' }]
    }]
  }
  const catalogPath = join(root, 'catalog.json')
  await writeFile(catalogPath, JSON.stringify(catalog))
  await writeFile(join(run, 'manifest.json'), JSON.stringify({
    items: [{ metadata: { step1: {
      slug: 'recording', url: 'sources/recording.mp3', audioFileName: '../../sources/recording.mp3', audioFileSize: bytes.length
    } } }]
  }))
  await writeFile(join(run, 'prompt.md'), '---\nurl: "sources/recording.mp3"\n---\n')
  return { root, sourcePath, run, catalog, catalogPath, verify: async () => await verifySttBenchmarkSources(catalogPath, root) }
}

test('source catalog verifies exact bytes and canonical manifest/prompt path bindings', async () => {
  const context = await fixture()
  expect(await context.verify()).toEqual({ sources: 1, runs: 1, bytes: Buffer.byteLength('exact stored recording bytes') })
})

test('standalone source verification emits one JSON payload with one newline', async () => {
  const context = await fixture()
  const proc = Bun.spawn([process.execPath, '--no-env-file', join(PROJECT_ROOT, 'src/tools/verify-stt-benchmark-sources.ts'), context.catalogPath], {
    cwd: context.root, env: { PATH: process.env['PATH'], HOME: process.env['HOME'], AUTOSHOW_PROJECT_ROOT: context.root }, stdout: 'pipe', stderr: 'pipe'
  })
  const [exitCode, stdout, stderr] = await Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()])
  expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' })
  const payload = { sources: 1, runs: 1, bytes: Buffer.byteLength('exact stored recording bytes'), catalog: 'catalog.json', verified: true }
  expect(stdout).toBe(`${JSON.stringify(payload)}\n`)
})

test('actual transcript-video source loader infers canonical audio outside the run directory', async () => {
  const context = await fixture()
  const manifest = JSON.parse(await readFile(join(context.run, 'manifest.json'), 'utf8'))
  await unlink(join(context.run, 'manifest.json'))
  await writeSingleManifestFixture(context.run, 'extract', { step1: manifest.items[0].metadata.step1 }, { extractRoute: 'media' })
  const resultPath = join(context.root, 'result.json')
  await writeFile(resultPath, JSON.stringify({ text: 'Stored transcript.', segments: [{ start: '00:00:00.000', end: '00:00:01.000', speaker: 'speaker-1', text: 'Stored transcript.' }] }))
  const source = await resolveTranscriptVideoSource(context.run, { 'transcript-result': resultPath })
  expect(source.audioPath).toBe(context.sourcePath)
  expect(source.transcription.result.text).toBe('Stored transcript.')
  expect(await context.verify()).toMatchObject({ sources: 1, runs: 1 })
})

test('source integrity verification rejects changed bytes of the same length', async () => {
  const context = await fixture()
  await writeFile(context.sourcePath, 'Exact stored recording bytes')
  await expect(context.verify()).rejects.toThrow('STT source integrity mismatch')
})

test('missing canonical audio fails with an explicit restore path', async () => {
  const context = await fixture()
  await unlink(context.sourcePath)
  await expect(context.verify()).rejects.toThrow('Restore the canonical STT recording at sources/recording.mp3')
  await expect(context.verify()).rejects.toMatchObject({ kind: 'infrastructure', cause: { code: 'ENOENT' } })
})

test('source catalog rejects a stale run-local audio path and a divergent prompt', async () => {
  const context = await fixture()
  const manifestPath = join(context.run, 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.items[0].metadata.step1.audioFileName = 'recording.mp3'
  await writeFile(manifestPath, JSON.stringify(manifest))
  await expect(context.verify()).rejects.toThrow('STT run does not resolve to its canonical recording')
  manifest.items[0].metadata.step1.audioFileName = '../../sources/recording.mp3'
  await writeFile(manifestPath, JSON.stringify(manifest))
  await writeFile(join(context.run, 'prompt.md'), '---\nurl: "old/recording.mp3"\n---\n')
  await expect(context.verify()).rejects.toThrow('STT prompt does not reference its canonical recording')
})

test('source catalog rejects paths outside the repository', async () => {
  const context = await fixture()
  context.catalog.sources[0]!.path = '../outside.mp3'
  await writeFile(context.catalogPath, JSON.stringify(context.catalog))
  await expect(context.verify()).rejects.toThrow('Expected a repository-relative source path')
})
