import { extname, isAbsolute, resolve } from 'node:path'
import { getFfmpegBinary, getFfprobeBinary } from '~/utils/runtime-paths'

// These checks establish usable artifacts, not prompt adherence or perceptual quality.
export const assertTextContent = (text: string, label = 'generated text'): void => {
  const content = text.replace(/\[\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]/g, '').replace(/\[speaker[- ]?\d+\]|\bSpeaker\s+\d+:/gi, '').trim()
  if (!/[\p{L}\p{N}]/u.test(content)) throw new Error(`${label} contains no words or numbers`)
}

export const assertStructuredContent = (value: unknown): void => {
  if (!value || typeof value !== 'object') throw new Error('Structured output must be an object or array')
  if (!Array.isArray(value) && ('error' in value || 'errors' in value)) throw new Error('Structured output contains an error payload')
  const hasContent = (node: unknown): boolean => {
    if (typeof node === 'string') return /[\p{L}\p{N}]/u.test(node)
    if (Array.isArray(node)) return node.some(hasContent)
    return Boolean(node && typeof node === 'object' && Object.values(node).some(hasContent))
  }
  if (!hasContent(value)) throw new Error('Structured output contains no generated text')
}

export const assertSummaryFields = (value: unknown, profile: string): void => {
  assertStructuredContent(value)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Summary must be an object')
  const fields = profile === 'shortSummary' ? ['episodeDescription'] : profile === 'default' ? ['episodeDescription', 'episodeSummary'] : []
  for (const field of fields) {
    const content = (value as Record<string, unknown>)[field]
    if (typeof content !== 'string') throw new Error(`Summary is missing ${field}`)
    assertTextContent(content, field)
  }
  if (profile === 'default') {
    const chapters = (value as Record<string, unknown>)['chapters']
    if (!Array.isArray(chapters) || chapters.length === 0) throw new Error('Summary is missing chapters')
    for (const chapter of chapters) {
      if (!chapter || typeof chapter !== 'object' || !/^\d{2}:\d{2}:\d{2}$/.test(chapter.timestamp)) throw new Error('Summary chapter has invalid timestamp')
      if (typeof chapter.title !== 'string' || typeof chapter.description !== 'string') throw new Error('Summary chapter lacks title or description')
      assertTextContent(chapter.title, 'chapter title')
      assertTextContent(chapter.description, 'chapter description')
    }
  }
}

export const containedArtifactPath = (outputDir: string, fileName: string): string => {
  const root = resolve(outputDir)
  const path = resolve(root, fileName)
  if (isAbsolute(fileName) || !path.startsWith(`${root}/`)) throw new Error('Generated artifact escapes its output directory')
  return path
}

const runDecoder = async (args: string[]): Promise<string> => {
  const child = Bun.spawn(args, { stdout: 'pipe', stderr: 'pipe' })
  const timeout = setTimeout(() => child.kill('SIGKILL'), 30_000)
  try {
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    if (code !== 0) throw new Error(`Media validation failed (${code}): ${stderr.slice(-2000)}`)
    return args[0] === getFfprobeBinary() ? stdout : stderr
  } finally {
    clearTimeout(timeout)
  }
}

export const assertDecodableMedia = async (path: string, kind: 'image' | 'video' | 'audio', expected: { durationSeconds?: number, aspectRatio?: number, aspectRatioTolerance?: number } = {}): Promise<void> => {
  const probe = JSON.parse(await runDecoder([
    getFfprobeBinary(), '-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-show_format', '-of', 'json', path,
  ])) as { streams?: Array<{ codec_type?: string, codec_name?: string, width?: number, height?: number }>, format?: { duration?: string, format_name?: string } }
  const stream = probe.streams?.find(entry => entry.codec_type === (kind === 'audio' ? 'audio' : 'video'))
  if (!stream) throw new Error(`Generated ${kind} has no ${kind === 'audio' ? 'audio' : 'video'} stream`)
  const imageCodecs: Record<string, string> = { '.png': 'png', '.jpg': 'mjpeg', '.jpeg': 'mjpeg', '.webp': 'webp', '.avif': 'av1' }
  const expectedCodec = kind === 'image' ? imageCodecs[extname(path)] : undefined
  if (expectedCodec && stream.codec_name !== expectedCodec) throw new Error('Decoded image format differs from its file extension')
  const expectedContainer: Record<string, string> = { '.wav': 'wav', '.mp3': 'mp3', '.mp4': 'mp4' }
  const container = kind !== 'image' ? expectedContainer[extname(path)] : undefined
  if (container && !probe.format?.format_name?.split(',').includes(container)) throw new Error('Decoded media container differs from its file extension')
  if (kind !== 'audio' && (!(Number(stream.width) > 0) || !(Number(stream.height) > 0))) throw new Error('Generated visual has invalid dimensions')
  if (kind !== 'image' && !(Number(probe.format?.duration) > 0)) throw new Error('Generated media has no positive duration')
  if (expected.durationSeconds !== undefined && Math.abs(Number(probe.format?.duration) - expected.durationSeconds) > 0.5) throw new Error('Decoded duration differs from the requested duration')
  if (expected.aspectRatio !== undefined && Math.abs(Number(stream.width) / Number(stream.height) / expected.aspectRatio - 1) > (expected.aspectRatioTolerance ?? 0.03)) throw new Error(`Decoded aspect ratio differs from the requested aspect ratio (${stream.width}x${stream.height})`)
  const decoded = await runDecoder([
    getFfmpegBinary(), '-nostdin', '-hide_banner', '-v', kind === 'audio' ? 'info' : 'error', '-xerror',
    '-err_detect', 'explode', '-protocol_whitelist', 'file,pipe', '-i', path,
    '-map', kind === 'audio' ? '0:a:0' : '0:v:0',
    ...(kind === 'audio' ? ['-af', 'astats=metadata=0:reset=0'] : []), '-f', 'null', '-',
  ])
  if (kind === 'audio' && /Peak level dB:\s*-inf/.test(decoded.slice(decoded.lastIndexOf('Overall')))) throw new Error('Generated audio contains only silence')
}
