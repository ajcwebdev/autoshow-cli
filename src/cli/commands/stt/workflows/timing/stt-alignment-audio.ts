import { ValidationError } from '~/utils/error-handler'

export const decodeAlignmentWave = (bytes: Uint8Array, normalize: boolean): Float32Array => {
  const audio = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE' || audio.readUInt32LE(4) + 8 !== audio.length) throw ValidationError('Expected a complete PCM WAV file.')
  let format = false, samples: Float32Array | undefined
  for (let offset = 12; offset < audio.length;) {
    if (offset + 8 > audio.length) throw ValidationError('Truncated WAV chunk.')
    const name = audio.toString('ascii', offset, offset + 4), size = audio.readUInt32LE(offset + 4)
    const start = offset + 8
    if (start + size > audio.length) throw ValidationError('Truncated WAV chunk.')
    if (name === 'fmt ') {
      if (format || size < 16 || audio.readUInt16LE(start) !== 1 || audio.readUInt16LE(start + 2) !== 1 || audio.readUInt32LE(start + 4) !== 16000 || audio.readUInt16LE(start + 12) !== 2 || audio.readUInt16LE(start + 14) !== 16) throw ValidationError('Expected local mono 16 kHz PCM16 WAV.')
      format = true
    } else if (name === 'data') {
      if (samples || size % 2 || !size || size > 16000 * 30 * 2) throw ValidationError('Align nonempty clips of at most 30 seconds.')
      samples = Float32Array.from({ length: size / 2 }, (_, index) => audio.readInt16LE(start + index * 2) / 32768)
    }
    offset = start + size + size % 2
  }
  if (!format || !samples) throw ValidationError('WAV format or audio data is missing.')
  if (normalize) {
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
    const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length
    const scale = Math.sqrt(variance + 1e-7)
    samples = samples.map(value => (value - mean) / scale)
  }
  return samples
}

export const ctcLogProbabilities = (data: ArrayLike<number>, frameCount: number, vocabularySize: number): number[][] => {
  if (data.length !== frameCount * vocabularySize || frameCount < 1 || !Number.isInteger(frameCount)) throw ValidationError('Invalid ONNX logits dimensions.')
  const frames = []
  for (let frame = 0; frame < frameCount; frame++) {
    const row = Array.from({ length: vocabularySize }, (_, index) => data[frame * vocabularySize + index]!)
    if (row.some(value => !Number.isFinite(value))) throw ValidationError('ONNX model returned non-finite logits.')
    const maximum = Math.max(...row)
    const denominator = Math.log(row.reduce((sum, value) => sum + Math.exp(value - maximum), 0))
    frames.push(row.map(value => value - maximum - denominator))
  }
  return frames
}
