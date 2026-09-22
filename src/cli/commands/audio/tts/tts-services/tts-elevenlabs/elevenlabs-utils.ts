import * as v from 'valibot'
import { UsageError } from '~/utils/error-handler'
import type { ElevenLabsTtsVoiceSettings } from '~/types'

export const validateElevenLabsVoiceSettings = (model: string, settings?: ElevenLabsTtsVoiceSettings): void => {
  validateElevenLabsTtsSpeed(model, settings?.speed)
  if (model !== 'eleven_v3' || !settings) return
  for (const key of ['similarity_boost', 'use_speaker_boost', 'style'] as const) {
    if (settings[key] !== undefined) throw UsageError(`Eleven v3 does not expose a supported ${key} control; use stability or documented inline delivery tags.`)
  }
}

export const parseElevenLabsDictionaryLocator = (value: string): { pronunciation_dictionary_id: string, version_id?: string } => {
  const [rawId, rawVersion] = value.split(':', 2)
  const id = rawId?.trim()
  const version = rawVersion?.trim()
  if (!id) throw UsageError('Invalid ElevenLabs pronunciation dictionary locator; expected dictionary_id or dictionary_id:version_id.')
  return { pronunciation_dictionary_id: id, ...(version ? { version_id: version } : {}) }
}

export const validateElevenLabsTtsSpeed = (model: string, speed?: number): void => {
  if (model === 'eleven_v3' && speed !== undefined) throw UsageError('Eleven v3 does not support numeric speed; use pacing audio tags in the input instead. Numeric speed is supported by other ElevenLabs models only.')
}
import { validateDataSafe } from '~/utils/validate/validation'
import { readRestDiagnosticText } from '~/utils/rest-client'

export const ELEVENLABS_TTS_OUTPUT_FORMAT = 'mp3_44100_128'
// Higher bitrates and WAV are plan-tier gated by ElevenLabs; a rejected format is surfaced, never retried in another.
export const ELEVENLABS_TTS_RESPONSE_FORMATS = ['mp3_44100_128', 'mp3_44100_192', 'wav_44100', 'wav_48000'] as const
export const elevenLabsChunkExtension = (outputFormat: string): string => outputFormat.startsWith('wav_') ? 'wav' : 'mp3'

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

/** Extracts the human-readable message from an ElevenLabs error body that has already been read. */
export const formatElevenLabsErrorText = (raw: string, status: number): string => {
  if (!raw.trim()) {
    return `HTTP ${status}`
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

export const readElevenLabsError = async (response: Response): Promise<string> =>
  formatElevenLabsErrorText(await readRestDiagnosticText(response), response.status)
