import { UsageError } from '~/utils/error-handler'

// Validate container lengths before decoding: ffmpeg can otherwise accept truncated WAVs.
const wavFrames = (bytes: Buffer, requirePcm: boolean): number | undefined => {
  const invalid = (): never => { throw UsageError('TTS delivery received malformed, truncated or empty WAV audio.') }
  if (bytes.toString('ascii', 0, 4) !== 'RIFF') {
    if (requirePcm) invalid()
    return undefined
  }
  if (bytes.length < 12 || bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(4) + 8 !== bytes.length) invalid()
  let blockAlign = 0
  let dataBytes = 0
  let pcm = false
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) invalid()
    const kind = bytes.toString('ascii', offset, offset + 4)
    const size = bytes.readUInt32LE(offset + 4)
    const content = offset + 8
    if (content + size + (size % 2) > bytes.length) invalid()
    if (kind === 'fmt ') {
      if (size < 16) invalid()
      const encoding = bytes.readUInt16LE(content)
      const channels = bytes.readUInt16LE(content + 2)
      const sampleRate = bytes.readUInt32LE(content + 4)
      blockAlign = bytes.readUInt16LE(content + 12)
      const bits = bytes.readUInt16LE(content + 14)
      pcm = encoding === 1 && bits === 16
      if (!channels || !sampleRate || !blockAlign) invalid()
      if (encoding === 1 && (blockAlign !== channels * bits / 8 || bytes.readUInt32LE(content + 8) !== sampleRate * blockAlign)) invalid()
    } else if (kind === 'data') dataBytes += size
    offset = content + size + (size % 2)
  }
  if (!blockAlign || !dataBytes || dataBytes % blockAlign !== 0 || (requirePcm && !pcm)) invalid()
  return dataBytes / blockAlign
}

export const validateDeliveryWav = async (path: string): Promise<void> => {
  wavFrames(Buffer.from(await Bun.file(path).arrayBuffer()), false)
}

export const deliveryPcmFrames = async (path: string): Promise<number> =>
  wavFrames(Buffer.from(await Bun.file(path).arrayBuffer()), true) as number
