// A loopback transport fixture, not a public extractor implementation. The CLI
// still owns URL routing, metadata persistence, artifact checks, and real decode.
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const [configuration, ...args] = process.argv.slice(2)
if (!configuration) throw new Error('The streaming transport fixture requires its owned configuration')
const fixture = JSON.parse(await readFile(configuration, 'utf8')) as { origin: string; calls: string }
const origin = new URL(fixture.origin)
if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1') throw new Error('The streaming transport fixture requires a loopback origin')
const calls = fixture.calls
if (!calls) throw new Error('The streaming transport fixture requires an owned call log')
await appendFile(calls, `${JSON.stringify(args)}\n`)

if (args.includes('--version')) {
  process.stdout.write('autoshow-loopback-streaming-fixture-1\n')
} else {
  const source = new URL(args.at(-1) ?? '')
  const kind = source.hostname === 'www.youtube.com' ? 'youtube' : source.hostname === 'www.twitch.tv' ? 'twitch' : undefined
  if (!kind) throw new Error('The streaming transport fixture accepts only its declared source routes')
  const mode = source.searchParams.get('fixture-mode') ?? 'valid'
  if (!['valid', 'missing', 'corrupt'].includes(mode)) throw new Error('Unknown streaming fixture mode')
  const readFixture = async (path: string): Promise<Response> => {
    const url = new URL(path, origin)
    if (url.origin !== origin.origin) throw new Error('The transport fixture cannot contact external origins')
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5_000) })
    if (!response.ok) throw new Error(`Loopback streaming fixture returned ${response.status}`)
    return response
  }
  if (args.includes('--dump-json')) {
    process.stdout.write(`${JSON.stringify(await (await readFixture(`/metadata/${kind}`)).json())}\n`)
  } else {
    const outputIndex = args.indexOf('--output')
    const output = args[outputIndex + 1]
    const trackingIndex = args.indexOf('--print-to-file')
    const tracking = args[trackingIndex + 2]
    if (outputIndex < 0 || !output || trackingIndex < 0 || args[trackingIndex + 1] !== 'after_move:filepath' || !tracking) throw new Error('The transport fixture requires the real downloader output and tracking arguments')
    const outputDir = dirname(output)
    await mkdir(outputDir, { recursive: true })
    if (mode !== 'missing') {
      const path = join(outputDir, `fixture-${kind}.mp3`)
      await writeFile(path, new Uint8Array(await (await readFixture(`/media/${mode}.mp3`)).arrayBuffer()))
      await writeFile(tracking, `${path}\n`)
    }
  }
}
