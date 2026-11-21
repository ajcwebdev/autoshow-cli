import { afterAll, beforeAll, expect, test } from 'bun:test'
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary, getFfprobeBinary, RUNTIME_DIR } from '~/utils/runtime-paths'
import { createRuntimeTempDirectory } from '~/utils/runtime-state'
import { assertDownloadRecord } from '../../../../../scenarios/local-cli-contracts'
import { readCanonicalRecord } from '../../../../../test-utils/manifest-helpers'
import { runCommand } from '../../../../../test-utils/test-helpers'
import { PIPELINE_MANIFEST_FILE } from '~/cli/commands/command-shared/pipeline-manifest'
import { defineSingleCaseTest, setupDownloadInputTypeLifecycle } from './download-input-types.shared'

export const STREAMING_DOWNLOAD_PROFILE = 'fixture-loopback' as const

const sourceMedia = 'input/examples/audio/0-audio-short.mp3'
const sources = {
  youtube: 'https://www.youtube.com/watch?v=fixture-ok1',
  twitch: 'https://www.twitch.tv/videos/123456789'
} as const
const title = (kind: string): string => `Fixture transport ${kind} audio`
const channel = 'AutoShow loopback fixture channel'
let root = ''
let binDir = ''
let callLog = ''
let origin = ''
let media: Uint8Array
let server: Bun.Server<undefined> | undefined
const requests: string[] = []
const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`
const options = () => ({ binDir })

beforeAll(async () => {
  root = await createRuntimeTempDirectory('streaming-fixture-')
  binDir = join(root, 'bin')
  callLog = join(root, 'extractor-calls.ndjson')
  await mkdir(binDir)
  await writeFile(callLog, '')
  media = await Bun.file(sourceMedia).bytes()
  const executable = join(binDir, 'yt-dlp')
  const configuration = join(root, 'fixture.json')
  await writeFile(executable, `#!/bin/sh\nexec ${shellQuote(process.execPath)} --no-env-file ${shellQuote(resolve('test/test-utils/fixtures/streaming-extractor.fixture.ts'))} ${shellQuote(configuration)} "$@"\n`)
  await chmod(executable, 0o755)
  expect(executable).toStartWith(`${RUNTIME_DIR}/`)
  server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    const url = new URL(request.url)
    requests.push(url.pathname)
    const kind = url.pathname.match(/^\/metadata\/(youtube|twitch)$/)?.[1]
    if (kind) return Response.json({ id: `fixture-${kind}`, title: title(kind), uploader: channel, duration: 2, description: 'Loopback extractor transport fixture', upload_date: '20261114' })
    if (url.pathname === '/media/valid.mp3') return new Response(media, { headers: { 'content-type': 'audio/mpeg', 'content-length': String(media.byteLength) } })
    if (url.pathname === '/media/corrupt.mp3') return new Response(new Uint8Array(1201).fill(7), { headers: { 'content-type': 'audio/mpeg' } })
    return new Response('Unknown streaming fixture route', { status: 404 })
  } })
  origin = `http://127.0.0.1:${server.port}`
  await writeFile(configuration, JSON.stringify({ origin, calls: callLog }))
})

afterAll(async () => {
  server?.stop(true)
  if (root) await rm(root, { recursive: true, force: true })
})

setupDownloadInputTypeLifecycle([])

for (const kind of ['youtube', 'twitch'] as const) {
  defineSingleCaseTest({
    name: `fixture transport downloads ${kind} routing with intact decoded media and canonical metadata`,
    input: sources[kind],
    checks: async (metadata, outputDir) => {
      await assertDownloadRecord(kind, metadata, outputDir)
      const record = await readCanonicalRecord(outputDir)
      expect(record['step1']).toMatchObject({ title: title(kind), channel, url: sources[kind] })
      const audioPath = join(outputDir, metadata.step1!.audioFileName!)
      const output = await Bun.file(audioPath).bytes()
      expect(new Bun.CryptoHasher('sha256').update(output).digest('hex')).toBe(new Bun.CryptoHasher('sha256').update(media).digest('hex'))
      const probe = await exec(getFfprobeBinary(), ['-v', 'error', '-show_entries', 'stream=codec_name,codec_type:format=duration', '-of', 'json', audioPath])
      expect(probe.exitCode, probe.stderr).toBe(0)
      const decoded = JSON.parse(probe.stdout)
      expect(decoded.streams).toContainEqual({ codec_name: 'mp3', codec_type: 'audio' })
      expect(Number(decoded.format.duration)).toBeGreaterThan(0)
      const integrity = await exec(getFfmpegBinary(), ['-v', 'error', '-xerror', '-i', audioPath, '-f', 'null', '-'])
      expect(integrity.exitCode, integrity.stderr).toBe(0)
      const calls = (await readFile(callLog, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as string[]).filter(args => args.at(-1) === sources[kind])
      expect(calls.some(args => args.includes('--dump-json'))).toBe(true)
      expect(calls.some(args => args.includes('--print-to-file'))).toBe(true)
      expect(requests).toContain(`/metadata/${kind}`)
      expect(requests).toContain('/media/valid.mp3')
    }
  }, options)
}

for (const [mode, diagnostic] of [['missing', 'No downloaded files found'], ['corrupt', 'Failed to probe media file']] as const) {
  test(`fixture transport rejects ${mode} media without publishing a successful download manifest`, async () => {
    const outputDir = join(root, `rejected-${mode}`)
    const input = `${sources.youtube}&fixture-mode=${mode}`
    const result = await runCommand(['src/cli/create-cli.ts', 'download', input, '--output-dir', outputDir], { ...options(), testName: `fixture transport ${mode} media` })
    expect(result.exitCode).toBe(1)
    expect(`${result.stdout}\n${result.stderr}`).toContain(diagnostic)
    expect(await Bun.file(join(outputDir, PIPELINE_MANIFEST_FILE)).exists()).toBe(false)
    expect(await Bun.file(join(outputDir, 'transcription.txt')).exists()).toBe(false)
    expect(await Bun.file(join(outputDir, 'extraction.txt')).exists()).toBe(false)
    const calls = (await readFile(callLog, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as string[]).filter(args => args.at(-1) === input)
    expect(calls.some(args => args.includes('--print-to-file'))).toBe(true)
    if (mode === 'corrupt') expect(requests).toContain('/media/corrupt.mp3')
  })
}
