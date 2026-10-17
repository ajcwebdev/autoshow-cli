import type { ObservedAudioFormat } from '~/types'

export type WaveMetadata = {
  sampleRate: number
  channels: number
  byteRate: number
  /** 0 when no complete `fmt ` chunk was found. */
  bitsPerSample: number
  /** Audio bytes present in the file, clamped to what a truncated `data` chunk actually holds. */
  dataBytes: number
}

/**
 * Walks the RIFF chunks of a WAVE file, honoring odd-size padding, and reports its format and
 * audio byte count. Returns undefined when the bytes are not RIFF/WAVE. It applies no acceptance
 * policy: each caller decides which missing or zero fields make the audio unusable.
 */
export const parseWaveMetadata = (bytes: Buffer): WaveMetadata | undefined => {
  if (bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    return undefined
  }
  const metadata: WaveMetadata = { sampleRate: 0, channels: 0, byteRate: 0, bitsPerSample: 0, dataBytes: 0 }
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4)
    const size = bytes.readUInt32LE(offset + 4)
    const content = offset + 8
    if (kind === 'fmt ' && content + 16 <= bytes.length) {
      metadata.channels = bytes.readUInt16LE(content + 2)
      metadata.sampleRate = bytes.readUInt32LE(content + 4)
      metadata.byteRate = bytes.readUInt32LE(content + 8)
      metadata.bitsPerSample = bytes.readUInt16LE(content + 14)
    } else if (kind === 'data') {
      metadata.dataBytes += Math.min(size, Math.max(0, bytes.length - content))
    }
    offset = content + size + (size % 2)
  }
  return metadata
}

export const wavePcmFormat = (metadata: WaveMetadata): ObservedAudioFormat => ({
  codec: metadata.bitsPerSample === 24 ? 'pcm_s24le' : 'pcm_s16le',
  container: 'wav',
  sampleRate: metadata.sampleRate,
  channels: metadata.channels
})
