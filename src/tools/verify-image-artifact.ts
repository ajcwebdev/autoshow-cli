/** Check a local image before using it as a paid edit input. Never downloads or calls providers. */
import { extname } from 'node:path'
import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { childEnv } from '~/utils/child-env'
import { getFfmpegBinary, getFfprobeBinary, hasRuntimeTool } from '~/utils/runtime-paths'
import { stripProjectRoot, toProjectRelativePath } from '~/utils/project-root'

const EXPECTED_CODEC: Readonly<Record<string, string>> = { '.png': 'png', '.jpg': 'mjpeg', '.jpeg': 'mjpeg', '.webp': 'webp' }
const EXPECTED_FORMATS: Readonly<Record<string, readonly string[]>> = { png: ['png_pipe', 'image2'], mjpeg: ['jpeg_pipe', 'image2'], webp: ['webp_pipe', 'image2'] }
const run = async (args: string[]): Promise<string> => {
  const child = Bun.spawn(args, { env: childEnv(), stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(20_000) })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  // Some codecs conceal a damaged payload and still exit zero. At -v error, stderr is a failed check too.
  if (code !== 0 || stderr.trim()) throw new Error(`Image artifact check failed: ${stripProjectRoot(stderr.trim()).slice(0, 2000) || `decoder exited ${code}`}`)
  return stdout
}

export const verifyImageArtifact = async (path: string, expectedSize?: string) => {
  const expectedCodec = EXPECTED_CODEC[extname(path).toLowerCase()]
  if (!expectedCodec) throw new Error('Expected a local PNG, JPEG, or WebP file.')
  const file = Bun.file(path)
  if (!(await file.exists()) || file.size === 0) throw new Error(`Image artifact is missing or empty: ${toProjectRelativePath(path)}`)
  const size = expectedSize === undefined ? undefined : /^(\d+)x(\d+)$/.exec(expectedSize)
  if (expectedSize !== undefined && (!size || Number(size[1]) < 1 || Number(size[2]) < 1)) throw new Error('Expected --size WIDTHxHEIGHT with positive integer dimensions.')
  for (const tool of ['ffmpeg', 'ffprobe'] as const) if (!hasRuntimeTool(tool)) throw new Error(`Install ${tool} with setup before checking images; this verifier does not install tools.`)
  const probe = JSON.parse(await run([
    getFfprobeBinary(), '-v', 'error', '-protocol_whitelist', 'file,pipe', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height:format=format_name', '-of', 'json', path
  ])) as { streams?: Array<{ codec_name?: string; width?: number; height?: number }>; format?: { format_name?: string } }
  const image = probe.streams?.[0]
  if (image?.codec_name !== expectedCodec) throw new Error(`Image codec does not match the ${extname(path)} filename; expected ${expectedCodec}.`)
  if (!EXPECTED_FORMATS[expectedCodec]?.includes(probe.format?.format_name ?? '')) throw new Error('Expected a PNG, JPEG, or WebP image container, not a video containing image frames.')
  const width = image.width, height = image.height
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width! < 1 || height! < 1) throw new Error('Image has invalid dimensions.')
  if (size && (width !== Number(size[1]) || height !== Number(size[2]))) throw new Error(`Image dimensions ${width}x${height} do not match expected ${expectedSize}.`)
  // Probing headers does not decode compressed image data. Reject actual decoder errors as well.
  await run([getFfmpegBinary(), '-v', 'error', '-xerror', '-err_detect', 'explode', '-protocol_whitelist', 'file,pipe', '-nostdin', '-i', path, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-'])
  const digest = createHash('sha256')
  for await (const bytes of createReadStream(path)) digest.update(bytes)
  return { path: toProjectRelativePath(path), codec: image.codec_name, width, height, bytes: file.size, sha256: digest.digest('hex'), decoded: true }
}

if (import.meta.main) {
  try {
    const [path, flag, size, ...extra] = process.argv.slice(2)
    if (!path || (flag !== undefined && (flag !== '--size' || size === undefined)) || extra.length > 0) throw new Error('Usage: bun src/tools/verify-image-artifact.ts <local-image> [--size WIDTHxHEIGHT]')
    console.log(JSON.stringify({ status: 'success', ...(await verifyImageArtifact(path, size)) }))
  } catch (error) {
    console.error(JSON.stringify({ status: 'failure', error: stripProjectRoot(error instanceof Error ? error.message : String(error)) }))
    process.exitCode = 1
  }
}
