import { afterAll, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { childEnv } from '~/utils/child-env'
import { getFfmpegBinary, getFfprobeBinary } from '~/utils/runtime-paths'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { createTempDirTracker } from '../../../test-utils/temp-dirs'

// Independent wire expectations: official Images generation/edit references, retrieved 2026-10-15.
// https://developers.openai.com/api/reference/resources/images/methods/generate
// https://developers.openai.com/api/reference/resources/images/methods/edit
// Mocked replies establish transport and application filenames, never provider visual quality.
const SOURCE = 'input/examples/image/harborlight-mug.png'
const tempDirs = createTempDirTracker('autoshow-documentation-image-dependency-')
afterAll(async () => await tempDirs.cleanup())

type Captured = { exitCode: number; stdout: string; stderr: string }
const capture = async (args: string[], environment = childEnv()): Promise<Captured> => {
  const child = Bun.spawn(args, { env: environment, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(20_000) })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { exitCode, stdout, stderr }
}
const decode = async (path: string) => await capture([
  process.execPath, '--no-env-file', 'src/tools/verify-image-artifact.ts', path, '--size', '1024x1024'
])
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

const workspace = async (reply: 'valid' | 'corrupt' | 'empty' = 'valid') => {
  const directory = await tempDirs.make()
  const config = join(directory, 'config.json'), preload = join(directory, 'mock-provider.ts'), calls = join(directory, 'transport.jsonl')
  const webp = join(directory, 'reply.webp')
  // A locally authored 1024-square black WebP; no WebP encoder or asset download is needed by tests.
  await Bun.write(webp, Buffer.from("UklGRn4HAABXRUJQVlA4IHIHAACQ3wCdASoABAAEPpFIoU0lpCMiIAgAsBIJaW7hd2EbQAnsA99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32rAA/v/eCKgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", 'base64'))
  await Bun.write(config, '{}\n')
  await Bun.write(preload, `import { appendFileSync } from 'node:fs'
const source = new Uint8Array(await Bun.file(${JSON.stringify(SOURCE)}).arrayBuffer())
const edited = new Uint8Array(await Bun.file(${JSON.stringify(webp)}).arrayBuffer())
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
  if (method !== 'POST') throw new Error('Unexpected transport method: ' + method)
  let record
  let bytes = source
  if (url === 'https://api.openai.com/v1/images/generations') {
    const body = JSON.parse(String(init?.body))
    if (body.model !== 'gpt-image-2.5-flare' || body.n !== 1 || body.size !== '1024x1024' || body.quality !== 'medium' || body.output_format !== 'png') throw new Error('Generation controls differ from the documented command')
    record = { url, model: body.model }
  } else if (url === 'https://api.openai.com/v1/images/edits') {
    const form = init?.body
    if (!(form instanceof FormData)) throw new Error('Edit must use multipart data')
    if (form.get('model') !== 'gpt-image-2.5-sunburst' || form.get('size') !== '1024x1024' || form.get('quality') !== 'xhigh' || form.get('output_format') !== 'webp' || form.get('output_compression') !== '80') throw new Error('Edit controls differ from the documented command')
    const image = form.get('image')
    if (!(image instanceof File) || image.name !== 'generated-image.png') throw new Error('Edit did not consume the produced base filename')
    const supplied = new Uint8Array(await image.arrayBuffer())
    if (Buffer.compare(source, supplied) !== 0) throw new Error('Edit reference differs from the actual base output bytes')
    record = { url, model: form.get('model'), input: image.name, inputBytes: supplied.byteLength }
    bytes = edited
  } else throw new Error('Network forbidden: ' + url)
  appendFileSync(${JSON.stringify(calls)}, JSON.stringify(record) + '\\n')
  const reply = ${JSON.stringify(reply)}
  return Response.json({ data: reply === 'empty' ? [] : [{ b64_json: Buffer.from(reply === 'corrupt' ? new Uint8Array([137,80,78,71,13,10,26,10]) : bytes).toString('base64') }] })
}
`)
  return {
    directory,
    webp,
    calls: async () => (await Bun.file(calls).exists()) ? (await Bun.file(calls).text()).trim().split('\n').map(line => JSON.parse(line)) : [],
    cli: async (args: string[]) => await capture([
      process.execPath, '--no-env-file', '--preload', preload, 'src/cli/create-cli.ts', 'image', ...args, '--config-path', config, '--json'
    ], childEnv({ set: { HOME: directory, OPENAI_API_KEY: 'synthetic-documentation-contract-key' } })),
    guardedEdit: async (input: string, output: string) => await capture([
      'sh', '-c', `set -e
"$1" --no-env-file src/tools/verify-image-artifact.ts "$2" --size 1024x1024
"$1" --no-env-file --preload "$3" src/cli/create-cli.ts image "Make only the mug paint matte black" --provider openai=gpt-image-2.5-sunburst --input "$2" --size 1024x1024 --quality xhigh --format webp --compression 80 --output-dir "$4" --config-path "$5" --json`,
      'documentation-image-guard', process.execPath, input, preload, output, config
    ], childEnv({ set: { HOME: directory, OPENAI_API_KEY: 'synthetic-documentation-contract-key' } }))
  }
}
const baseArgs = ['A teal camping mug with a cream badge', '--provider', 'openai=gpt-image-2.5-flare', '--count', '1', '--size', '1024x1024', '--quality', 'medium', '--format', 'png']
const editArgs = ['Make only the mug paint matte black', '--provider', 'openai=gpt-image-2.5-sunburst', '--size', '1024x1024', '--quality', 'xhigh', '--format', 'webp', '--compression', '80']

test('mocked image CLI transport writes the documented base filename and consumes its decoded bytes for the dependent edit', async () => {
  const work = await workspace()
  const base = join(work.directory, 'base'), edit = join(work.directory, 'edit'), input = join(base, 'generated-image.png')
  const first = await work.cli([...baseArgs, '--output-dir', base])
  expect(first).toMatchObject({ exitCode: 0 })
  expect(JSON.parse(first.stdout)).toMatchObject({ status: 'success' })
  expect((await readManifest(base))?.items[0]).toMatchObject({ status: 'full', metadata: { image: [{ imageService: 'openai', imageModel: 'gpt-image-2.5-flare', imageFileNames: ['generated-image.png'], requestMode: 'generation' }] } })
  expect(hash(await Bun.file(input).bytes())).toBe(hash(await Bun.file(SOURCE).bytes()))
  expect(await decode(input)).toMatchObject({ exitCode: 0 })
  const second = await work.guardedEdit(input, edit)
  expect(second).toMatchObject({ exitCode: 0 })
  expect((await readManifest(edit))?.items[0]).toMatchObject({ status: 'full', metadata: { image: [{ imageModel: 'gpt-image-2.5-sunburst', imageFileNames: ['generated-image.webp'], imageFormat: 'webp', requestMode: 'edit' }] } })
  const edited = join(edit, 'generated-image.webp')
  expect(hash(await Bun.file(edited).bytes())).toBe(hash(await Bun.file(work.webp).bytes()))
  expect(await decode(edited)).toMatchObject({ exitCode: 0 })
  expect((await work.calls()).map(call => call.url)).toEqual(['https://api.openai.com/v1/images/generations', 'https://api.openai.com/v1/images/edits'])
}, 30_000)

test('price-only image plans and a missing dependent base make no transport request or generation artifact', async () => {
  const work = await workspace(), output = join(work.directory, 'quoted')
  for (const args of [baseArgs, [...editArgs, '--input', SOURCE]]) {
    const quoted = await work.cli([...args, '--price', '--output-dir', output])
    expect(quoted).toMatchObject({ exitCode: 0 })
    expect(await Bun.file(join(output, 'manifest.json')).exists()).toBe(false)
  }
  const missing = await work.cli([...editArgs, '--input', join(work.directory, 'missing.png'), '--output-dir', output])
  expect(missing.exitCode).not.toBe(0)
  expect(missing.stdout).toContain('does not exist')
  expect(await work.calls()).toEqual([])
  expect(await Bun.file(join(output, 'generated-image.webp')).exists()).toBe(false)
}, 30_000)

test('empty HTTP-success image data fails artifact completion and corrupt saved bytes stop the shell guard before editing', async () => {
  const empty = await workspace('empty'), emptyOutput = join(empty.directory, 'base')
  const absent = await empty.cli([...baseArgs, '--output-dir', emptyOutput])
  expect(absent.exitCode).not.toBe(0)
  expect(await Bun.file(join(emptyOutput, 'generated-image.png')).exists()).toBe(false)
  const corrupt = await workspace('corrupt'), corruptOutput = join(corrupt.directory, 'base')
  const received = await corrupt.cli([...baseArgs, '--output-dir', corruptOutput])
  // The current transport stores provider bytes; the documented decoder gate supplies artifact validation.
  expect(received).toMatchObject({ exitCode: 0 })
  const input = join(corruptOutput, 'generated-image.png')
  const decoded = await decode(input)
  expect(decoded.exitCode).not.toBe(0)
  expect(decoded.stderr.length).toBeGreaterThan(0)
  expect((await corrupt.guardedEdit(input, join(corrupt.directory, 'edit'))).exitCode).not.toBe(0)
  expect((await corrupt.calls()).map(call => call.url)).toEqual(['https://api.openai.com/v1/images/generations'])
  expect(await Bun.file(join(corrupt.directory, 'edit', 'manifest.json')).exists()).toBe(false)
}, 30_000)

test('local image verifier distinguishes valid images from wrong format, size, concealed corruption, and disguised video', async () => {
  const directory = await tempDirs.make(), wrongFormat = join(directory, 'mislabeled.webp')
  await copyFile(SOURCE, wrongFormat)
  const format = await decode(wrongFormat)
  expect(format.exitCode).not.toBe(0)
  expect(format.stdout).toBe('')
  expect(format.stderr.trimEnd().split('\n')).toHaveLength(1)
  expect(JSON.parse(format.stderr)).toEqual({ status: 'failure', error: 'Image codec does not match the .webp filename; expected webp.' })
  const size = await capture([process.execPath, '--no-env-file', 'src/tools/verify-image-artifact.ts', SOURCE, '--size', '768x768'])
  expect(size.exitCode).not.toBe(0)
  expect(size.stderr).toContain('1024x1024 do not match expected 768x768')
  const valid = await decode(SOURCE)
  expect(valid.exitCode).toBe(0)
  expect(valid.stderr).toBe('')
  expect(valid.stdout.trimEnd().split('\n')).toHaveLength(1)
  expect(JSON.parse(valid.stdout)).toMatchObject({ status: 'success', codec: 'png', width: 1024, height: 1024, decoded: true, sha256: hash(await Bun.file(SOURCE).bytes()) })
  const jpeg = await decode('input/examples/image/harborlight-mug.jpg')
  expect(jpeg.exitCode).toBe(0)
  expect(JSON.parse(jpeg.stdout)).toMatchObject({ codec: 'mjpeg', width: 1024, height: 1024, decoded: true })
  const defaultSize = await capture([process.execPath, '--no-env-file', 'src/tools/verify-image-artifact.ts', 'input/examples/video/harborlight-jacket.png'])
  expect(defaultSize.exitCode).toBe(0)
  expect(JSON.parse(defaultSize.stdout)).toMatchObject({ width: 768, height: 768, decoded: true })
  const jpegBytes = await Bun.file('input/examples/image/harborlight-mug.jpg').bytes(), damaged = join(directory, 'damaged-payload.jpg')
  await Bun.write(damaged, jpegBytes.slice(0, Math.floor(jpegBytes.length * .8)))
  const header = await capture([getFfprobeBinary(), '-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json', damaged])
  expect(header.exitCode).toBe(0)
  expect(JSON.parse(header.stdout).streams[0]).toMatchObject({ width: 1024, height: 1024 })
  const integrity = await decode(damaged)
  expect(integrity.exitCode).not.toBe(0)
  expect(integrity.stderr).toContain('Image artifact check failed')
  const disguised = join(directory, 'video-disguised-as-image.jpg')
  const encoded = await capture([getFfmpegBinary(), '-v', 'error', '-nostdin', '-i', SOURCE, '-frames:v', '1', '-c:v', 'mjpeg', '-f', 'avi', disguised])
  expect(encoded.exitCode).toBe(0)
  const rejected = await decode(disguised)
  expect(rejected.exitCode).not.toBe(0)
  expect(rejected.stderr).toContain('not a video containing image frames')
  let requests = 0
  const local = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => { requests++; return new Response('Unexpected image network read', { status: 404 }) } })
  try {
    const playlist = join(directory, 'playlist-disguised-as-image.jpg')
    await Bun.write(playlist, `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:1.0,\nhttp://127.0.0.1:${local.port}/private.mp4\n#EXT-X-ENDLIST\n`)
    expect((await decode(playlist)).exitCode).not.toBe(0)
    expect(requests).toBe(0)
  } finally { await local.stop(true) }
})
