import { UsageError } from '~/utils/error-handler'

// Known container lengths must match exactly. Provider streams can retain their
// unknown-length headers after a completed response; validate whole sample frames.
const wavFrames = (bytes: Buffer, requirePcm: boolean, normalizeStreaming = false): number | undefined => {
  const invalid = (): never => { throw UsageError('TTS delivery received malformed, truncated or empty WAV audio.') }
  if (bytes.toString('ascii', 0, 4) !== 'RIFF') {
    if (requirePcm) invalid()
    return undefined
  }
  if (bytes.length < 12 || bytes.toString('ascii', 8, 12) !== 'WAVE') invalid()
  const riffSize = bytes.readUInt32LE(4)
  const unknownRiffSize = !requirePcm && riffSize === 0xffffffff
  // Some providers use signed INT_MAX for data and include the 36-byte header.
  const signedStreamingSize = !requirePcm && riffSize === 0x80000023
  if (!unknownRiffSize && !signedStreamingSize && riffSize + 8 !== bytes.length) invalid()
  let blockAlign = 0
  let dataBytes = 0
  let pcm = false
  let encoding = 0
  let streamingData = false
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) invalid()
    const kind = bytes.toString('ascii', offset, offset + 4)
    const declaredSize = bytes.readUInt32LE(offset + 4)
    const content = offset + 8
    const unknownDataSize = kind === 'data' && (
      (unknownRiffSize && declaredSize === 0xffffffff)
      || (signedStreamingSize && content === 44 && declaredSize === 0x7fffffff)
    )
    const size = unknownDataSize ? bytes.length - content : declaredSize
    const padding = unknownDataSize ? 0 : size % 2
    if (content + size + padding > bytes.length) invalid()
    if (kind === 'fmt ') {
      if (size < 16) invalid()
      encoding = bytes.readUInt16LE(content)
      const channels = bytes.readUInt16LE(content + 2)
      const sampleRate = bytes.readUInt32LE(content + 4)
      blockAlign = bytes.readUInt16LE(content + 12)
      const bits = bytes.readUInt16LE(content + 14)
      pcm = encoding === 1 && bits === 16
      if (!channels || !sampleRate || !blockAlign) invalid()
      if (encoding === 1 && (blockAlign !== channels * bits / 8 || bytes.readUInt32LE(content + 8) !== sampleRate * blockAlign)) invalid()
    } else if (kind === 'data') {
      if (unknownDataSize && (!blockAlign || dataBytes || ![1, 3].includes(encoding))) invalid()
      streamingData ||= unknownDataSize
      dataBytes += size
      if (unknownDataSize && normalizeStreaming) bytes.writeUInt32LE(size, offset + 4)
    }
    offset = content + size + padding
  }
  if (signedStreamingSize && !streamingData) invalid()
  if (!blockAlign || !dataBytes || dataBytes % blockAlign !== 0 || (requirePcm && !pcm)) invalid()
  if (normalizeStreaming && (unknownRiffSize || signedStreamingSize)) bytes.writeUInt32LE(bytes.length - 8, 4)
  return dataBytes / blockAlign
}

export const validateDeliveryWav = async (path: string): Promise<void> => {
  wavFrames(Buffer.from(await Bun.file(path).arrayBuffer()), false)
}

// ffmpeg's strict decoder treats unknown-length headers as corrupt packets at EOF.
// Finalize only a working copy after validation; preserve the purchased source hash.
export const prepareDeliveryWav = async (path: string, finitePath: string): Promise<string> => {
  const bytes = Buffer.from(await Bun.file(path).arrayBuffer())
  const originalSize = bytes.length >= 8 ? bytes.readUInt32LE(4) : undefined
  wavFrames(bytes, false, true)
  if (originalSize === undefined || originalSize === bytes.readUInt32LE(4)) return path
  await Bun.write(finitePath, bytes)
  return finitePath
}

export const deliveryPcmFrames = async (path: string): Promise<number> =>
  wavFrames(Buffer.from(await Bun.file(path).arrayBuffer()), true) as number
