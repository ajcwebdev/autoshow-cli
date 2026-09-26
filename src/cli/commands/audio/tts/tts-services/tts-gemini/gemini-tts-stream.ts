import { geminiFetch } from '~/utils/gemini/gemini-rest'
import { ValidationError } from '~/utils/error-handler'
import { decodeGeminiBase64, decodeGeminiAudio, validateGeminiAudioFormat, GEMINI_AUDIO_MAX_BYTES, geminiObject } from './gemini-tts-audio'

export const readGeminiSpeechStream = async (response: Response, mime: string): Promise<{ audio: Buffer, usage?: unknown }> => {
  if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) throw ValidationError('Gemini stream must return SSE audio.', { stage: 'tts:gemini' })
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  const chunks: Buffer[] = []
  let pending = '', received = 0, bytes = 0, completed = false, usage: unknown
  const event = (frame: string) => {
    const text = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
    if (!text) return
    const item = geminiObject(JSON.parse(text))
    if (completed) throw ValidationError('Gemini emitted events after completion.', { stage: 'tts:gemini' })
    if (item['event_type'] === 'error' || item['event_type'] === 'interaction.failed') throw ValidationError('Gemini streaming generation failed.', { stage: 'tts:gemini' })
    if (item['event_type'] === 'step.delta') {
      const delta = geminiObject(item['delta'])
      if (delta['type'] === 'audio' && delta['data'] !== undefined) {
        validateGeminiAudioFormat({ ...delta, mime_type: delta['mime_type'] ?? mime }, mime)
        const chunk = decodeGeminiBase64(delta['data']); bytes += chunk.length
        if (bytes > GEMINI_AUDIO_MAX_BYTES) throw ValidationError('Gemini stream exceeds audio byte limit.', { stage: 'tts:gemini' })
        chunks.push(chunk)
      }
    }
    if (item['event_type'] === 'interaction.completed') {
      const interaction = geminiObject(item['interaction'])
      if (interaction['status'] !== 'completed') throw ValidationError('Gemini stream was truncated.', { stage: 'tts:gemini' })
      usage = interaction['usage']; completed = true
    }
  }
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      received += next.value.length
      if (received > GEMINI_AUDIO_MAX_BYTES * 2) throw ValidationError('Gemini stream exceeds transport byte limit.', { stage: 'tts:gemini' })
      pending += decoder.decode(next.value, { stream: true })
      pending = pending.replace(/\r\n/g, '\n')
      let boundary: number
      while ((boundary = pending.indexOf('\n\n')) >= 0) { event(pending.slice(0, boundary)); pending = pending.slice(boundary + 2) }
      if (pending.length > 8 * 1024 * 1024) throw ValidationError('Gemini SSE frame exceeds limit.', { stage: 'tts:gemini' })
    }
    pending += decoder.decode()
    if (pending.trim() || !completed || !chunks.length) throw ValidationError('Gemini audio stream ended before complete generation.', { stage: 'tts:gemini' })
    return { audio: decodeGeminiAudio({ mime_type: mime, data: Buffer.concat(chunks).toString('base64') }, mime), usage }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}
export const fetchGeminiSpeechStream = async (apiKey: string, body: unknown, mime: string, signal?: AbortSignal) => readGeminiSpeechStream(await geminiFetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
  method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...(signal ? { signal } : {}),
}), mime)
