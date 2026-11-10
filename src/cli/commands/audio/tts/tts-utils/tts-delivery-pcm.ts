import { UsageError } from '~/utils/error-handler'

const invalid = (): never => { throw UsageError('TTS delivery received malformed, truncated or empty WAV audio.') }

type WavSizing = { unknownRiffSize: boolean, signedStreamingSize: boolean }
type WavFormat = { encoding: number, blockAlign: number, pcm: boolean }
type WavChunkScan = { format: WavFormat, dataBytes: number, streamingData: boolean }

const readDeliveryWavSizing = (bytes: Buffer, requirePcm: boolean): WavSizing => {
  if (bytes.length < 12 || bytes.toString('ascii', 8, 12) !== 'WAVE') invalid()
  const riffSize = bytes.readUInt32LE(4)
  const unknownRiffSize = !requirePcm && riffSize === 0xffffffff
  // Some providers use signed INT_MAX for data and include the 36-byte header.
  const signedStreamingSize = !requirePcm && riffSize === 0x80000023
  if (!unknownRiffSize && !signedStreamingSize && riffSize + 8 !== bytes.length) invalid()
  return { unknownRiffSize, signedStreamingSize }
}

const readDeliveryWavFormat = (bytes: Buffer, content: number, size: number): WavFormat => {
  if (size < 16) invalid()
  const encoding = bytes.readUInt16LE(content)
  const channels = bytes.readUInt16LE(content + 2)
  const sampleRate = bytes.readUInt32LE(content + 4)
  const blockAlign = bytes.readUInt16LE(content + 12)
  const bits = bytes.readUInt16LE(content + 14)
  if (!channels || !sampleRate || !blockAlign) invalid()
  if (encoding === 1 && (blockAlign !== channels * bits / 8 || bytes.readUInt32LE(content + 8) !== sampleRate * blockAlign)) invalid()
  return { encoding, blockAlign, pcm: encoding === 1 && bits === 16 }
}

const hasUnknownDataSize = (sizing: WavSizing, content: number, declaredSize: number): boolean =>
  (sizing.unknownRiffSize && declaredSize === 0xffffffff)
  || (sizing.signedStreamingSize && content === 44 && declaredSize === 0x7fffffff)

const addWavData = (scan: WavChunkScan, unknownDataSize: boolean, size: number): void => {
  if (unknownDataSize && (!scan.format.blockAlign || scan.dataBytes || ![1, 3].includes(scan.format.encoding))) invalid()
  scan.streamingData ||= unknownDataSize
  scan.dataBytes += size
}

const scanDeliveryWavChunks = (bytes: Buffer, sizing: WavSizing, normalizeStreaming: boolean): WavChunkScan => {
  const scan: WavChunkScan = { format: { encoding: 0, blockAlign: 0, pcm: false }, dataBytes: 0, streamingData: false }
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) invalid()
    const kind = bytes.toString('ascii', offset, offset + 4)
    const declaredSize = bytes.readUInt32LE(offset + 4)
    const content = offset + 8
    const unknownDataSize = kind === 'data' && hasUnknownDataSize(sizing, content, declaredSize)
    const size = unknownDataSize ? bytes.length - content : declaredSize
    const padding = unknownDataSize ? 0 : size % 2
    if (content + size + padding > bytes.length) invalid()
    if (kind === 'fmt ') {
      scan.format = readDeliveryWavFormat(bytes, content, size)
    } else if (kind === 'data') {
      addWavData(scan, unknownDataSize, size)
      if (unknownDataSize && normalizeStreaming) bytes.writeUInt32LE(size, offset + 4)
    }
    offset = content + size + padding
  }
  return scan
}

// Known container lengths must match exactly. Provider streams can retain their
// unknown-length headers after a completed response; validate whole sample frames.
const wavFrames = (bytes: Buffer, requirePcm: boolean, normalizeStreaming = false): number | undefined => {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF') {
    if (requirePcm) invalid()
    return undefined
  }
  const sizing = readDeliveryWavSizing(bytes, requirePcm)
  const { format, dataBytes, streamingData } = scanDeliveryWavChunks(bytes, sizing, normalizeStreaming)
  if (sizing.signedStreamingSize && !streamingData) invalid()
  if (!format.blockAlign || !dataBytes || dataBytes % format.blockAlign !== 0 || (requirePcm && !format.pcm)) invalid()
  if (normalizeStreaming && (sizing.unknownRiffSize || sizing.signedStreamingSize)) bytes.writeUInt32LE(bytes.length - 8, 4)
  return dataBytes / format.blockAlign
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
