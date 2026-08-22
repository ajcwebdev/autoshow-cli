import { statPath as stat } from '~/utils/bun-file-io'
import { basename, extname } from 'node:path'
import * as v from 'valibot'
import * as l from '~/utils/app-logger/app-logger'
import { validateData } from '~/utils/validate/validation'
import { getAudioDuration } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { readElevenLabsError } from './elevenlabs-utils'
import { materializeMediaInput } from '~/utils/media-url'
import { InfraError, serializeDiagnosticError, ValidationError } from '~/utils/error-handler'
import type { ElevenLabsTtsIvcContext, ElevenLabsTtsIvcOptions, ElevenLabsTtsIvcResult, TtsCustomVoiceSampleAudio } from '~/types'
import { httpResponseError } from '~/utils/rest-client'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

const ELEVENLABS_IVC_BEST_PRACTICE_MIN_SECONDS = 10
const ELEVENLABS_IVC_BEST_PRACTICE_MAX_SECONDS = 2 * 60

const ELEVENLABS_IVC_AUDIO_TYPES = new Map<string, string>([
  ['.mp3', 'audio/mpeg'],
  ['.mpeg', 'audio/mpeg'],
  ['.mpga', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.wave', 'audio/wav'],
  ['.m4a', 'audio/mp4'],
  ['.mp4', 'audio/mp4'],
  ['.ogg', 'audio/ogg'],
  ['.oga', 'audio/ogg'],
  ['.flac', 'audio/flac'],
  ['.aac', 'audio/aac'],
  ['.webm', 'audio/webm']
])

const ElevenLabsIvcResponseSchema = v.object({
  voice_id: v.string(),
  requires_verification: v.boolean()
})

export const createElevenLabsTtsIvcContext = (): ElevenLabsTtsIvcContext => ({})

const defaultElevenLabsTtsIvcVoiceName = (): string => `AutoShow_${Date.now()}`

export const validateElevenLabsTtsIvcAudio = async (
  audioPath: string
): Promise<TtsCustomVoiceSampleAudio> => {
  const normalizedPath = audioPath.trim()
  if (normalizedPath.length === 0) {
    throw ValidationError('ElevenLabs TTS IVC reference audio path is empty.', { stage: 'tts:elevenlabs' })
  }

  const ext = extname(normalizedPath).toLowerCase()
  const mimeType = ELEVENLABS_IVC_AUDIO_TYPES.get(ext)
  if (!mimeType) {
    throw ValidationError('ElevenLabs TTS IVC reference audio must be an mp3/mpeg, wav, m4a/mp4, ogg, flac, aac, or webm file.', { stage: 'tts:elevenlabs' })
  }

  let fileStats: Awaited<ReturnType<typeof stat>>
  try {
    fileStats = await stat(normalizedPath)
  } catch {
    throw InfraError(`ElevenLabs TTS IVC reference audio not found: ${normalizedPath}`, { stage: 'tts:elevenlabs' })
  }

  if (!fileStats.isFile()) {
    throw ValidationError(`ElevenLabs TTS IVC reference audio is not a file: ${normalizedPath}`, { stage: 'tts:elevenlabs' })
  }
  if (fileStats.size <= 0) {
    throw ValidationError(`ElevenLabs TTS IVC reference audio is empty: ${normalizedPath}`, { stage: 'tts:elevenlabs' })
  }

  let durationSeconds: number | undefined
  try {
    durationSeconds = await getAudioDuration(normalizedPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    l.warn(`Could not determine ElevenLabs TTS IVC reference audio duration; continuing anyway: ${message}`, {
      category: 'tts',
      metadata: { provider: 'elevenlabs', error: serializeDiagnosticError(error) }
    })
  }

  if (durationSeconds !== undefined && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    if (durationSeconds < ELEVENLABS_IVC_BEST_PRACTICE_MIN_SECONDS) {
      l.warn(`ElevenLabs IVC reference audio is short (${durationSeconds.toFixed(2)}s); longer, varied speech samples usually improve clone consistency.`, {
      category: 'tts',
      metadata: { provider: 'elevenlabs', durationSeconds }
    })
    } else if (durationSeconds > ELEVENLABS_IVC_BEST_PRACTICE_MAX_SECONDS) {
      l.warn(`ElevenLabs IVC reference audio is longer than the usual short-sample guidance (${durationSeconds.toFixed(2)}s); continuing without trimming.`, {
      category: 'tts',
      metadata: { provider: 'elevenlabs', durationSeconds }
    })
    }
  }

  return {
    path: normalizedPath,
    basename: basename(normalizedPath),
    mimeType,
    sizeBytes: fileStats.size,
    ...(durationSeconds !== undefined && Number.isFinite(durationSeconds) && durationSeconds > 0 ? { durationSeconds } : {})
  }
}

const createElevenLabsTtsIvcVoice = async (
  baseURL: string,
  apiKey: string,
  options: ElevenLabsTtsIvcOptions
): Promise<ElevenLabsTtsIvcResult> => {
  const materializedRefAudio = await materializeMediaInput(options.refAudioPath, {
    accept: 'audio/*,application/octet-stream;q=0.9,*/*;q=0.8',
    label: 'ElevenLabs TTS IVC reference audio'
  })

  try {
  const sourceAudio = await validateElevenLabsTtsIvcAudio(materializedRefAudio.path)
  const voiceName = options.voiceName?.trim() || defaultElevenLabsTtsIvcVoiceName()

  const data = await withRetry(
    {
      retryClass: 'runtime_http_create_conservative',
      operationName: 'elevenlabs-ivc-create',
      timeoutMs: MEDIA_GENERATION_TIMEOUT_MS
    },
    // The operation took no signal parameter at all, so nothing could cancel an attempt.
    async (signal) => {
      const form = new FormData()
      form.append('name', voiceName)
      form.append('files', Bun.file(sourceAudio.path, { type: sourceAudio.mimeType }), sourceAudio.basename)
      form.append('remove_background_noise', options.removeBackgroundNoise === true ? 'true' : 'false')

      const response = await fetch(`${baseURL}/voices/add`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey
        },
        body: form,
        ...(signal ? { signal } : {})
      })

      if (!response.ok) {
        const errText = await readElevenLabsError(response)
        throw httpResponseError(`ElevenLabs IVC voice creation failed (${response.status}): ${errText}`, response)
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw ValidationError(`ElevenLabs IVC voice creation returned invalid JSON: ${message}`, {
      stage: 'tts:elevenlabs',
      ...(error instanceof Error ? { cause: error } : {})
    })
      }

      return validateData(ElevenLabsIvcResponseSchema, payload, 'ElevenLabs IVC voice creation response')
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )

  const result = {
    voiceId: data.voice_id,
    voiceName,
    sourceAudio,
    requiresVerification: data.requires_verification
  }

  if (result.requiresVerification) {
    throw InfraError(
      `ElevenLabs IVC voice ${result.voiceId} was created but requires verification. Verify it in ElevenLabs, then rerun with --elevenlabs-voice ${result.voiceId} and omit --elevenlabs-tts-ref-audio.`,
      { stage: 'tts:elevenlabs' }
    )
  }

  return result
  } finally {
    await materializedRefAudio.cleanup()
  }
}

export const ensureElevenLabsTtsIvcVoice = async (
  baseURL: string,
  apiKey: string,
  options: ElevenLabsTtsIvcOptions
): Promise<ElevenLabsTtsIvcResult> => {
  const context = options.context
  if (context?.voicePromise) {
    return await context.voicePromise
  }

  let voicePromise: Promise<ElevenLabsTtsIvcResult>
  voicePromise = createElevenLabsTtsIvcVoice(baseURL, apiKey, options).catch((error) => {
    if (context?.voicePromise === voicePromise) {
      context.voicePromise = undefined
    }
    throw error
  })

  if (context) {
    context.voicePromise = voicePromise
  }

  return await voicePromise
}
