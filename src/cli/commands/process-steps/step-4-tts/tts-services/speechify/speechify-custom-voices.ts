import { statPath as stat } from '~/utils/bun-file-io'
import { basename, extname } from 'node:path'
import * as v from 'valibot'
import { getAudioDuration } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { validateData } from '~/utils/validate/validation'
import { materializeMediaInput } from '~/utils/media-url'
import { CLIUsageError, ValidationError } from '~/utils/error-handler'
import type { SpeechifyTtsCustomVoiceGender, SpeechifyTtsCustomVoiceOptions, SpeechifyTtsCustomVoiceResult, TtsCustomVoiceSampleAudio } from '~/types'
import { httpResponseError } from '~/utils/rest-client'

const SPEECHIFY_TTS_DEFAULT_CUSTOM_VOICE_LOCALE = 'en-US'
const SPEECHIFY_TTS_DEFAULT_CUSTOM_VOICE_GENDER = 'notSpecified'
const SPEECHIFY_TTS_CUSTOM_VOICE_MIN_SECONDS = 10
const SPEECHIFY_TTS_CUSTOM_VOICE_MAX_SECONDS = 30
const SPEECHIFY_TTS_CUSTOM_VOICE_MAX_BYTES = 5 * 1024 * 1024

const SPEECHIFY_CUSTOM_VOICE_AUDIO_TYPES = new Map<string, string>([
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

const SpeechifyVoiceResponseSchema = v.object({
  id: v.string()
})

export const SPEECHIFY_CUSTOM_VOICE_GENDERS = ['male', 'female', 'notSpecified'] as const

const defaultSpeechifyTtsCustomVoiceName = (): string => `AutoShow_${Date.now()}`

const isSpeechifyCustomVoiceGender = (value: string): value is SpeechifyTtsCustomVoiceGender =>
  (SPEECHIFY_CUSTOM_VOICE_GENDERS as readonly string[]).includes(value)

const validateSpeechifyTtsCustomVoiceGender = (
  value: string | undefined
): SpeechifyTtsCustomVoiceGender => {
  const normalized = value?.trim() || SPEECHIFY_TTS_DEFAULT_CUSTOM_VOICE_GENDER
  if (isSpeechifyCustomVoiceGender(normalized)) {
    return normalized
  }

  throw CLIUsageError('Invalid Speechify custom voice gender. Expected male, female, or notSpecified.')
}

const resolveSpeechifyTtsCustomVoiceLocale = (value: string | undefined): string => {
  const normalized = value?.trim() || SPEECHIFY_TTS_DEFAULT_CUSTOM_VOICE_LOCALE
  if (normalized.length === 0) {
    throw CLIUsageError('Speechify TTS custom voice locale is empty.')
  }
  return normalized
}

const resolveSpeechifyTtsCustomVoiceConsent = (
  consentName: string | undefined,
  consentEmail: string | undefined
): { fullName: string, email: string } => {
  const fullName = consentName?.trim()
  const email = consentEmail?.trim()

  if (!fullName) {
    throw CLIUsageError('Speechify TTS custom voice creation requires consent full name.')
  }
  if (!email) {
    throw CLIUsageError('Speechify TTS custom voice creation requires consent email.')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw CLIUsageError('Invalid Speechify TTS custom voice consent email value. Expected an email address.')
  }

  return { fullName, email }
}

const validateSpeechifyTtsCustomVoiceAudio = async (
  audioPath: string
): Promise<TtsCustomVoiceSampleAudio> => {
  const normalizedPath = audioPath.trim()
  if (normalizedPath.length === 0) {
    throw CLIUsageError('Speechify TTS custom voice reference audio path is empty.')
  }

  const ext = extname(normalizedPath).toLowerCase()
  const mimeType = SPEECHIFY_CUSTOM_VOICE_AUDIO_TYPES.get(ext)
  if (!mimeType) {
    throw CLIUsageError('Speechify TTS custom voice reference audio must be an mp3/mpeg, wav, m4a/mp4, ogg, flac, aac, or webm file.')
  }

  let fileStats: Awaited<ReturnType<typeof stat>>
  try {
    fileStats = await stat(normalizedPath)
  } catch {
    throw CLIUsageError(`Speechify TTS custom voice reference audio not found: ${normalizedPath}`)
  }

  if (!fileStats.isFile()) {
    throw CLIUsageError(`Speechify TTS custom voice reference audio is not a file: ${normalizedPath}`)
  }
  if (fileStats.size <= 0) {
    throw CLIUsageError(`Speechify TTS custom voice reference audio is empty: ${normalizedPath}`)
  }
  if (fileStats.size > SPEECHIFY_TTS_CUSTOM_VOICE_MAX_BYTES) {
    throw CLIUsageError(`Speechify TTS custom voice reference audio exceeds 5 MiB: ${normalizedPath}`)
  }

  let durationSeconds: number | undefined
  try {
    const detectedDuration = await getAudioDuration(normalizedPath)
    if (Number.isFinite(detectedDuration) && detectedDuration > 0) {
      durationSeconds = detectedDuration
    }
  } catch {
    throw CLIUsageError('Speechify TTS custom voice reference audio duration could not be verified before upload.')
  }

  if (durationSeconds === undefined) {
    throw CLIUsageError('Speechify TTS custom voice reference audio duration could not be verified before upload.')
  }
  if (durationSeconds < SPEECHIFY_TTS_CUSTOM_VOICE_MIN_SECONDS || durationSeconds > SPEECHIFY_TTS_CUSTOM_VOICE_MAX_SECONDS) {
    throw CLIUsageError(`Speechify TTS custom voice reference audio must be 10-30 seconds; got ${durationSeconds.toFixed(2)}s.`)
  }

  return {
    path: normalizedPath,
    basename: basename(normalizedPath),
    mimeType,
    sizeBytes: fileStats.size,
    ...(durationSeconds !== undefined ? { durationSeconds } : {})
  }
}

const readSpeechifyErrorBody = async (response: Response): Promise<string> => {
  try {
    const text = await response.text()
    return text.trim()
  } catch {
    return ''
  }
}

const readSpeechifyJsonResponse = async (response: Response, operationName: string): Promise<unknown> => {
  try {
    return await response.json()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw ValidationError(`${operationName} returned invalid JSON: ${message}`, { stage: 'tts:speechify', ...(error instanceof Error ? { cause: error } : {}) })
  }
}

const appendAudioFile = (form: FormData, fieldName: string, audio: TtsCustomVoiceSampleAudio): void => {
  form.append(
    fieldName,
    new File([Bun.file(audio.path, { type: audio.mimeType })], audio.basename, { type: audio.mimeType }),
    audio.basename
  )
}

const createSpeechifyTtsCustomVoice = async (
  baseURL: string,
  apiKey: string,
  options: SpeechifyTtsCustomVoiceOptions
): Promise<SpeechifyTtsCustomVoiceResult> => {
  const materializedRefAudio = await materializeMediaInput(options.refAudioPath, {
    accept: 'audio/*,application/octet-stream;q=0.9,*/*;q=0.8',
    label: 'Speechify TTS custom voice reference audio'
  })

  try {
  const sourceAudio = await validateSpeechifyTtsCustomVoiceAudio(materializedRefAudio.path)
  const voiceName = options.voiceName?.trim() || defaultSpeechifyTtsCustomVoiceName()
  const locale = resolveSpeechifyTtsCustomVoiceLocale(options.locale)
  const gender = validateSpeechifyTtsCustomVoiceGender(options.gender)
  const consent = resolveSpeechifyTtsCustomVoiceConsent(options.consentName, options.consentEmail)

  const data = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName: 'speechify-tts-custom-voice-create' },
    async (signal) => {
      const form = new FormData()
      form.append('name', voiceName)
      form.append('locale', locale)
      form.append('gender', gender === 'notSpecified' ? 'not_specified' : gender)
      form.append('consent', JSON.stringify(consent))
      appendAudioFile(form, 'sample', sourceAudio)

      const response = await fetch(`${baseURL}/v1/voices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: form,
        ...(signal ? { signal } : {})
      })

      if (!response.ok) {
        const body = await readSpeechifyErrorBody(response)
        throw httpResponseError(`Speechify TTS custom voice creation failed (${response.status}): ${body || 'No response body'}`, response)
      }

      return validateData(
        SpeechifyVoiceResponseSchema,
        await readSpeechifyJsonResponse(response, 'Speechify TTS custom voice creation response'),
        'Speechify TTS custom voice creation response'
      )
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )

  return {
    voiceId: data.id,
    voiceName,
    locale,
    gender,
    sourceAudio
  }
  } finally {
    await materializedRefAudio.cleanup()
  }
}

export const ensureSpeechifyTtsCustomVoice = async (
  baseURL: string,
  apiKey: string,
  options: SpeechifyTtsCustomVoiceOptions
): Promise<SpeechifyTtsCustomVoiceResult> => {
  const context = options.context
  if (context?.voicePromise) {
    return await context.voicePromise
  }

  let voicePromise: Promise<SpeechifyTtsCustomVoiceResult>
  voicePromise = createSpeechifyTtsCustomVoice(baseURL, apiKey, options).catch((error) => {
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
