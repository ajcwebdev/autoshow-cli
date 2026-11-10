import { ValidationError } from '~/utils/error-handler'
import { readHttpPayloadBytes } from '~/utils/http-payload'

export const retainSonioxAudioResponse = async (response: Response, path: string): Promise<Uint8Array> => {
  const writer = Bun.file(path).writer()
  try {
    // The raw response is deliberately outside the recoverable speech-*-chunk namespace.
    // Flush even an interrupted body so diagnostic bytes survive cancellation.
    const stream = response.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) { writer.write(chunk); controller.enqueue(chunk) },
    }))
    return await readHttpPayloadBytes(new Response(stream ?? null, { headers: response.headers }), 'Soniox TTS WAV', { stage: 'tts:soniox' })
  } finally {
    await writer.end()
  }
}

const invalid = (reason: string): never => {
  throw ValidationError(`Invalid Soniox TTS WAV: ${reason}. Returned bytes were retained; reconcile the request before purchasing audio again.`, { stage: 'tts:soniox', retryable: false })
}

type SonioxWavFormat = { encoding: number, bits: number, blockAlign: number, byteRate: number }
type SonioxWavChunks = { format: SonioxWavFormat, dataSize: number, dataStart: number, end: number }

const readSonioxWavStreaming = (wav: Buffer): boolean => {
  if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') return invalid('invalid RIFF container')
  const streaming = wav.readUInt32LE(4) === 0xffffffff
  if (!streaming && wav.readUInt32LE(4) + 8 !== wav.length) return invalid('invalid or truncated RIFF container')
  return streaming
}

const readSonioxExtensibleEncoding = (wav: Buffer, start: number, size: number): number => {
  if (size < 40 || wav.readUInt16LE(start + 16) < 22 || wav.toString('hex', start + 28, start + 40) !== '00001000800000aa00389b71') return invalid('invalid extensible PCM format')
  const encoding = wav.readUInt32LE(start + 24)
  const validBits = wav.readUInt16LE(start + 18)
  if (!validBits || validBits > wav.readUInt16LE(start + 14)) return invalid('invalid PCM precision')
  return encoding
}

const readSonioxWavFormat = (wav: Buffer, start: number, size: number): SonioxWavFormat => {
  let encoding = wav.readUInt16LE(start)
  if (encoding === 0xfffe) encoding = readSonioxExtensibleEncoding(wav, start, size)
  const channels = wav.readUInt16LE(start + 2), rate = wav.readUInt32LE(start + 4)
  const bits = wav.readUInt16LE(start + 14)
  const blockAlign = wav.readUInt16LE(start + 12)
  const byteRate = wav.readUInt32LE(start + 8)
  if (!(encoding === 1 && [8, 16, 24, 32].includes(bits)) && !(encoding === 3 && [32, 64].includes(bits))) return invalid('expected integer or floating-point PCM')
  if (!channels || rate !== 24000 || blockAlign !== channels * bits / 8 || byteRate !== rate * blockAlign) return invalid('inconsistent PCM format or unexpected sample rate')
  return { encoding, bits, blockAlign, byteRate }
}

const assertFiniteSonioxSamples = (wav: Buffer, dataStart: number, dataSize: number, bits: number): void => {
  for (let sample = dataStart; sample < dataStart + dataSize; sample += bits / 8) {
    if (!Number.isFinite(bits === 32 ? wav.readFloatLE(sample) : wav.readDoubleLE(sample))) return invalid('non-finite PCM sample')
  }
}

const scanSonioxWavChunks = (wav: Buffer, streaming: boolean): SonioxWavChunks => {
  let offset = 12, dataSize = 0, dataStart = 0, formatCount = 0, dataCount = 0
  let format: SonioxWavFormat = { encoding: 0, bits: 0, blockAlign: 0, byteRate: 0 }
  while (offset + 8 <= wav.length) {
    const kind = wav.toString('ascii', offset, offset + 4), declaredSize = wav.readUInt32LE(offset + 4), start = offset + 8
    const unknownDataSize = streaming && kind === 'data' && declaredSize === 0xffffffff
    const size = unknownDataSize ? wav.length - start : declaredSize
    if (start + size > wav.length) return invalid('truncated chunk')
    if (kind === 'fmt ') {
      if (++formatCount !== 1 || size < 16) return invalid('missing or duplicate PCM format')
      format = readSonioxWavFormat(wav, start, size)
    }
    if (kind === 'data') {
      if (++dataCount !== 1 || !size || !formatCount) return invalid('empty, duplicate or unordered audio data')
      dataSize = size
      dataStart = start
    }
    offset = start + size + (unknownDataSize ? 0 : size % 2)
  }
  return { format, dataSize, dataStart, end: offset }
}

// Decode PCM containers, including streaming WAV's unknown-length sentinel.
// Known lengths must match exactly; a clean body end is required by the reader above.
// Integrity and duration do not establish spoken-text completeness or perceived quality.
export const decodeSonioxWavDuration = (bytes: Uint8Array): number => {
  const wav = Buffer.from(bytes)
  const streaming = readSonioxWavStreaming(wav)
  const { format, dataSize, dataStart, end } = scanSonioxWavChunks(wav, streaming)
  if (end !== wav.length || !format.byteRate || !dataSize || dataSize % format.blockAlign) return invalid('missing format/data or incomplete sample frames')
  if (format.encoding === 3) assertFiniteSonioxSamples(wav, dataStart, dataSize, format.bits)
  const duration = dataSize / format.byteRate
  if (duration >= 119) return invalid(`duration ${duration.toFixed(3)} seconds approaches Soniox's two-minute truncation cap; split the text further and review native pause tags`)
  return duration
}
