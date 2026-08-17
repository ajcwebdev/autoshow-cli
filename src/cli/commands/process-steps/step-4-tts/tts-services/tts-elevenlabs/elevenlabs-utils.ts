import * as v from 'valibot'
import { validateDataSafe } from '~/utils/validate/validation'

// Baked intermediate for every ElevenLabs synthesis request. The segment is remastered
// into a fixed-format `speech.wav` afterwards, so this only picks what crosses the wire.
// It stays MP3 at the model's native 44.1 kHz rather than a lossless container: pcm_44100
// is gated behind ElevenLabs Pro, and the untiered pcm_* formats return headerless raw
// streams that the shared chunk pipeline would have to wrap before concatenating.
export const ELEVENLABS_TTS_OUTPUT_FORMAT = 'mp3_44100_128'

const ElevenLabsErrorSchema = v.object({
  detail: v.optional(v.union([
    v.string(),
    v.object({
      message: v.optional(v.string(), undefined)
    })
  ]), undefined),
  message: v.optional(v.string(), undefined),
  error: v.optional(v.string(), undefined)
})

export const readElevenLabsError = async (response: Response): Promise<string> => {
  const raw = await response.text()
  if (!raw.trim()) {
    return `HTTP ${response.status}`
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    const validated = validateDataSafe(ElevenLabsErrorSchema, parsed)
    if (!validated) {
      return raw
    }

    if (typeof validated.detail === 'string' && validated.detail.trim().length > 0) {
      return validated.detail
    }
    if (validated.detail && typeof validated.detail === 'object' && typeof validated.detail.message === 'string') {
      return validated.detail.message
    }
    if (typeof validated.message === 'string' && validated.message.trim().length > 0) {
      return validated.message
    }
    if (typeof validated.error === 'string' && validated.error.trim().length > 0) {
      return validated.error
    }

    return raw
  } catch {
    return raw
  }
}
