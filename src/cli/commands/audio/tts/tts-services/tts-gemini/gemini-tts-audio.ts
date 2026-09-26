import { ValidationError } from '~/utils/error-handler'

const invalid = (reason: string): never => { throw ValidationError(`Invalid Gemini TTS audio: ${reason}`, { stage: 'tts:gemini', retryable: false }) }
export const GEMINI_AUDIO_MAX_BYTES = 64 * 1024 * 1024
export const geminiObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid('expected an object')
  return value as Record<string, unknown>
}
export const decodeGeminiBase64 = (data: unknown): Buffer => {
  if (typeof data !== 'string' || !data.length || data.length % 4 !== 0 || data.length > GEMINI_AUDIO_MAX_BYTES * 4 / 3 + 4 || /[^A-Za-z0-9+/=]/.test(data) || data.slice(0, -2).includes('=') || data.endsWith('=') === false && data.includes('=')) return invalid('malformed or oversized base64')
  const bytes = Buffer.from(data, 'base64')
  if (bytes.length > GEMINI_AUDIO_MAX_BYTES || bytes.toString('base64') !== data) return invalid('noncanonical base64')
  return bytes
}
export const geminiPcmWav = (pcm: Uint8Array, sampleRate = 24000): Buffer => {
  if (!pcm.byteLength || pcm.byteLength % 2 || pcm.byteLength > GEMINI_AUDIO_MAX_BYTES) return invalid('empty, truncated, or oversized PCM')
  const wav = Buffer.alloc(44 + pcm.byteLength)
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28)
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36)
  wav.writeUInt32LE(pcm.byteLength, 40); wav.set(pcm, 44)
  return wav
}
export const validateGeminiWav = (wav: Buffer): Buffer => {
  if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE' || wav.readUInt32LE(4) + 8 !== wav.length) return invalid('truncated or invalid WAV container')
  let offset = 12, format = false, audio = false
  while (offset + 8 <= wav.length) {
    const kind = wav.toString('ascii', offset, offset + 4), size = wav.readUInt32LE(offset + 4)
    const start = offset + 8
    if (start + size > wav.length) return invalid('truncated WAV chunk')
    if (kind === 'fmt ') {
      if (size < 16 || wav.readUInt16LE(start) !== 1 || wav.readUInt16LE(start + 2) !== 1 || wav.readUInt32LE(start + 4) !== 24000 || wav.readUInt16LE(start + 14) !== 16 || wav.readUInt16LE(start + 12) !== 2 || wav.readUInt32LE(start + 8) !== 48000) return invalid('expected mono 24 kHz PCM16 WAV')
      format = true
    }
    if (kind === 'data') { if (!size || size % 2) return invalid('empty or truncated WAV samples'); audio = true }
    offset = start + size + (size % 2)
  }
  if (!format || !audio || offset !== wav.length) return invalid('missing format/audio or trailing WAV bytes')
  return wav
}
export const validateGeminiAudioFormat = (item: Record<string, unknown>, expectedMime: string): void => {
  const mime = item['mime_type'] ?? item['mimeType']
  if (typeof mime !== 'string' || mime.split(';')[0]!.toLowerCase() !== expectedMime) return invalid('MIME does not match requested encoding')
  if (item['sample_rate'] !== undefined && item['sample_rate'] !== 24000 || item['channels'] !== undefined && item['channels'] !== 1) return invalid('unexpected sample rate or channels')
  if (/rate=/.test(mime) && !/rate=24000(?:;|$)/.test(mime)) return invalid('unexpected PCM sample rate')
}
export const decodeGeminiAudio = (block: unknown, expectedMime: string): Buffer => {
  const item = geminiObject(block)
  validateGeminiAudioFormat(item, expectedMime)
  const bytes = decodeGeminiBase64(item['data'])
  if (expectedMime === 'audio/wav') return validateGeminiWav(bytes)
  if (bytes.subarray(0, 4).toString() === 'RIFF' || /^\s*\{[\s\S]*\}\s*$/.test(bytes.toString('utf8'))) return invalid('container or JSON returned as raw audio')
  if (expectedMime === 'audio/l16') return geminiPcmWav(bytes)
  if (!['audio/mulaw', 'audio/alaw'].includes(expectedMime)) return invalid('unsupported encoding')
  const pcm = Buffer.alloc(bytes.length * 2)
  bytes.forEach((byte, index) => {
    let sample: number
    if (expectedMime === 'audio/mulaw') {
      const value = (~byte) & 255
      const magnitude = (((value & 15) << 3) + 132) << ((value >> 4) & 7)
      sample = value & 128 ? 132 - magnitude : magnitude - 132
    } else {
      const value = byte ^ 85, exponent = (value >> 4) & 7
      let magnitude = (value & 15) << 4
      magnitude += exponent === 0 ? 8 : 264
      if (exponent > 1) magnitude <<= exponent - 1
      sample = value & 128 ? magnitude : -magnitude
    }
    pcm.writeInt16LE(sample, index * 2)
  })
  return geminiPcmWav(pcm)
}
export const decodeGeminiInteraction = (payload: unknown, mime: string): Buffer => {
  const response = geminiObject(payload)
  if (response['error'] || response['status'] !== 'completed') return invalid('generation did not complete')
  const audio = (Array.isArray(response['steps']) ? response['steps'] : []).flatMap(step => {
    const item = geminiObject(step)
    return item['type'] === 'model_output' && Array.isArray(item['content']) ? item['content'].filter(block => geminiObject(block)['type'] === 'audio') : []
  })
  if (audio.length !== 1) return invalid('expected exactly one REST audio block')
  return decodeGeminiAudio(audio[0], mime)
}
export const decodeGeminiGenerateContent = (payload: unknown): Buffer => {
  const response = geminiObject(payload)
  const candidates = response['candidates']
  if (response['error'] || !Array.isArray(candidates) || candidates.length !== 1) return invalid('missing batch candidate')
  const candidate = geminiObject(candidates[0])
  if (candidate['finishReason'] !== 'STOP') return invalid('batch generation incomplete or truncated')
  const parts = geminiObject(candidate['content'])['parts']
  const audio = Array.isArray(parts) ? parts.map(geminiObject).filter(part => part['inlineData']) : []
  if (audio.length !== 1) return invalid('missing batch audio')
  return decodeGeminiAudio(audio[0]!['inlineData'], 'audio/wav')
}
