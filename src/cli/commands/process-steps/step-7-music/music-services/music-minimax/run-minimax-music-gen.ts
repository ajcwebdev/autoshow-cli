import * as v from 'valibot'
import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { isMinimaxInstrumentalMusicModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { MinimaxLyricsGenerationResult, MinimaxMusicGenerationPayload, MinimaxMusicModel, MinimaxMusicResponse, Step7MusicMetadata } from '~/types'
import { MINIMAX_DEFAULT_BASE_URL } from '~/utils/base-urls'
import * as l from '~/utils/app-logger/app-logger'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { resolveCredential } from '~/utils/validate/env-utils'
import { InfraError, InternalError, ProviderError, ValidationError } from '~/utils/error-handler'
import { MinimaxBaseRespSchema, minimaxFetchJson, minimaxJsonRequestInit } from '~/utils/minimax-client/minimax-client'
import { classifyPaidCreateRetry, withRetry } from '~/utils/retries'

const REQUEST_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS
const MINIMAX_MUSIC_PROMPT_MAX_CHARS = 2000
const MINIMAX_MUSIC_LYRICS_MAX_CHARS = 3500
const MINIMAX_MUSIC_OUTPUT_FORMAT = 'hex'
const MINIMAX_MUSIC_AUDIO_SETTING = {
  sample_rate: 44100,
  bitrate: 256000,
  format: 'mp3'
} as const
const MINIMAX_MUSIC_AUDIO_MIME_TYPE = 'audio/mpeg'

const MinimaxLyricsResponseSchema = v.object({
  song_title: v.optional(v.string(), undefined),
  style_tags: v.optional(v.string(), undefined),
  lyrics: v.optional(v.string(), undefined),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const MinimaxMusicDataSchema = v.object({
  status: v.optional(v.union([v.number(), v.string()]), undefined),
  audio: v.optional(v.string(), undefined)
})

const MinimaxMusicExtraInfoSchema = v.object({
  music_duration: v.optional(v.number(), undefined),
  music_sample_rate: v.optional(v.number(), undefined),
  music_channel: v.optional(v.number(), undefined),
  bitrate: v.optional(v.number(), undefined),
  music_size: v.optional(v.number(), undefined)
})

export const MinimaxMusicResponseSchema = v.object({
  data: v.optional(v.nullable(MinimaxMusicDataSchema), undefined),
  extra_info: v.optional(v.nullable(MinimaxMusicExtraInfoSchema), undefined),
  trace_id: v.optional(v.string(), undefined),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const normalizeMinimaxMusicPrompt = (
  prompt: string
): string => {
  const trimmed = prompt.trim()
  if (trimmed.length === 0) {
    throw ValidationError('MiniMax music prompt must not be empty', { stage: 'music:minimax' })
  }
  if (trimmed.length > MINIMAX_MUSIC_PROMPT_MAX_CHARS) {
    l.warn(`MiniMax music prompt is ${trimmed.length} characters; truncating to ${MINIMAX_MUSIC_PROMPT_MAX_CHARS} characters`, {
      category: 'pipeline',
      metadata: { provider: 'minimax', promptLength: trimmed.length, maxPromptLength: MINIMAX_MUSIC_PROMPT_MAX_CHARS }
    })
    return trimmed.slice(0, MINIMAX_MUSIC_PROMPT_MAX_CHARS).trimEnd()
  }
  return trimmed
}

const validateMinimaxMusicLyrics = (
  lyrics: string,
  source: string
): string => {
  const trimmed = lyrics.trim()
  if (trimmed.length === 0) {
    throw ValidationError(`${source} must not be empty`, { stage: 'music:minimax' })
  }
  if (trimmed.length > MINIMAX_MUSIC_LYRICS_MAX_CHARS) {
    throw ValidationError(`${source} must be ${MINIMAX_MUSIC_LYRICS_MAX_CHARS} characters or fewer. Received ${trimmed.length} characters.`, { stage: 'music:minimax' })
  }
  return trimmed
}

const readProvidedLyrics = async (lyricsFile: string): Promise<string> => {
  const file = Bun.file(lyricsFile)
  if (!await file.exists()) {
    throw InfraError(`Music lyrics file not found: ${lyricsFile}`, { stage: 'music:minimax' })
  }

  return validateMinimaxMusicLyrics(await file.text(), `MiniMax music lyrics file ${lyricsFile}`)
}

const generateLyrics = async (
  baseURL: string,
  apiKey: string,
  prompt: string
): Promise<MinimaxLyricsGenerationResult> => {
  const parsed = await minimaxFetchJson(
    `${baseURL}/v1/lyrics_generation`,
    {
      init: minimaxJsonRequestInit(apiKey, 'POST', {
        mode: 'write_full_song',
        prompt
      }),
      schema: MinimaxLyricsResponseSchema,
      responseContext: 'MiniMax lyrics generation response',
      baseRespContext: 'MiniMax lyrics generation',
      stage: 'music:minimax',
      httpErrorMessage: 'MiniMax lyrics generation failed'
    }
  )

  return {
    lyrics: validateMinimaxMusicLyrics(parsed.lyrics ?? '', 'MiniMax generated lyrics'),
    ...(parsed.song_title?.trim() ? { songTitle: parsed.song_title.trim() } : {}),
    ...(parsed.style_tags?.trim() ? { styleTags: parsed.style_tags.trim() } : {})
  }
}

const requestMusicGeneration = async (
  baseURL: string,
  apiKey: string,
  payload: MinimaxMusicGenerationPayload
): Promise<MinimaxMusicResponse> => {
  const body = {
    model: payload.model,
    prompt: payload.prompt,
    ...(payload.isInstrumental ? { is_instrumental: true } : { lyrics: payload.lyrics }),
    output_format: MINIMAX_MUSIC_OUTPUT_FORMAT,
    audio_setting: MINIMAX_MUSIC_AUDIO_SETTING
  }

  let parsed: MinimaxMusicResponse
  try {
    parsed = await minimaxFetchJson(
      `${baseURL}/v1/music_generation`,
      {
        init: minimaxJsonRequestInit(apiKey, 'POST', body, AbortSignal.timeout(REQUEST_TIMEOUT_MS)),
        schema: MinimaxMusicResponseSchema,
        responseContext: 'MiniMax music generation response',
        baseRespContext: 'MiniMax music generation',
        stage: 'music:minimax',
        httpErrorMessage: 'MiniMax music generation failed'
      }
    )
  } catch (error) {
    if ((error instanceof DOMException && error.name === 'AbortError')
      || (error instanceof Error && error.name === 'AbortError')) {
      throw InfraError(`MiniMax music generation timed out after ${REQUEST_TIMEOUT_MS}ms`, {
        stage: 'music:minimax',
        ...(error instanceof Error ? { cause: error } : {})
      })
    }
    throw error
  }
  return parsed
}

const isIncompleteSuccessEnvelope = (payload: MinimaxMusicResponse): boolean =>
  payload.base_resp?.status_code === 0 && payload.data == null && payload.extra_info == null

const formatMusicResponseDetails = (payload: MinimaxMusicResponse): string => {
  const details: string[] = []
  if (payload.base_resp?.status_code !== undefined) {
    details.push(`status_code=${payload.base_resp.status_code}`)
  }
  if (payload.base_resp?.status_msg) {
    details.push(`status_msg=${payload.base_resp.status_msg}`)
  }
  if (payload.data?.status !== undefined) {
    details.push(`music_status=${payload.data.status}`)
  }
  details.push(`has_audio=${payload.data?.audio?.trim().length ? 'true' : 'false'}`)
  return details.join(', ')
}

const requestMusicGenerationWithIncompleteRetry = async (
  baseURL: string,
  apiKey: string,
  payload: MinimaxMusicGenerationPayload
): Promise<MinimaxMusicResponse> =>
  await withRetry(
    {
      retryClass: 'runtime_http_create_conservative',
      operationName: 'minimax-music-create'
    },
    async () => {
      const result = await requestMusicGeneration(baseURL, apiKey, payload)
      if (isIncompleteSuccessEnvelope(result)) {
        throw ProviderError(
          `MiniMax music generation returned an incomplete success response (${formatMusicResponseDetails(result)})`,
          {
            stage: 'music:minimax',
            retryable: false,
            hints: ['The provider accepted the music request but returned no retained result. Do not redispatch automatically because another generation may be billed.'],
            metadata: { acceptedButIncomplete: true, billingOutcome: 'ambiguous' }
          }
        )
      }
      return result
    },
    classifyPaidCreateRetry
  )

export const runMinimaxMusicGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: MinimaxMusicModel
    durationSeconds?: number | undefined
    lyricsFile?: string | undefined
    forceInstrumental?: boolean | undefined
  }
): Promise<{ musicPath: string, metadata: Step7MusicMetadata }> => {
  const apiKey = resolveCredential('minimax', 'require', { stage: 'music:minimax', description: 'MiniMax music generation' })

  const baseURL = MINIMAX_DEFAULT_BASE_URL
  const musicPath = `${outputDir}/generated-music.mp3`

  if (options.durationSeconds !== undefined) {
    l.warn('MiniMax music generation currently ignores --duration', { category: 'pipeline' })
  }
  const supportsInstrumental = isMinimaxInstrumentalMusicModel(options.model)
  const useInstrumental = options.forceInstrumental === true && supportsInstrumental
  if (options.forceInstrumental && !supportsInstrumental) {
    l.warn(`MiniMax music model ${options.model} does not support --instrumental; generating with lyrics`, {
      category: 'pipeline',
      metadata: { provider: 'minimax', model: options.model, ignoredFlag: '--instrumental' }
    })
  }
  if (useInstrumental && options.lyricsFile) {
    l.warn('Ignoring --lyrics-file because --instrumental was provided for MiniMax music generation', { category: 'pipeline' })
  }

  const startTime = Date.now()
  const promptForMusic = normalizeMinimaxMusicPrompt(prompt)
  const generatedLyrics = useInstrumental || options.lyricsFile
    ? undefined
    : await generateLyrics(baseURL, apiKey, promptForMusic)
  const lyrics = useInstrumental
    ? undefined
    : options.lyricsFile
      ? await readProvidedLyrics(options.lyricsFile)
      : generatedLyrics?.lyrics
  const lyricsSource: Step7MusicMetadata['lyricsSource'] = useInstrumental
    ? 'none'
    : options.lyricsFile ? 'provided' : 'generated'

  logGenStatus('music', 'minimax', options.model, 'started')

  let payload: MinimaxMusicGenerationPayload
  if (useInstrumental) {
    payload = {
      model: options.model,
      prompt: promptForMusic,
      isInstrumental: true
    }
  } else {
    if (lyrics === undefined) {
      throw InternalError('MiniMax music lyrics were not resolved', { stage: 'music:minimax' })
    }
    payload = {
      model: options.model,
      prompt: promptForMusic,
      lyrics
    }
  }
  const generated = await requestMusicGenerationWithIncompleteRetry(baseURL, apiKey, payload)
  const hexAudio = generated.data?.audio

  if (!hexAudio || hexAudio.trim().length === 0) {
    throw InfraError(`MiniMax music generation completed without audio payload (${formatMusicResponseDetails(generated)})`, { stage: 'music:minimax' })
  }

  const audioBytes = new Uint8Array(Buffer.from(hexAudio, 'hex'))
  if (audioBytes.byteLength === 0) {
    throw InfraError('MiniMax music generation returned empty audio', { stage: 'music:minimax' })
  }

  await Bun.write(musicPath, audioBytes)

  const processingTime = Date.now() - startTime
  const musicFile = Bun.file(musicPath)
  const musicDurationMs = generated.extra_info?.music_duration

  logGenCompleted('music', 'minimax', options.model, processingTime, [musicPath])

  const metadata: Step7MusicMetadata = {
    musicService: 'minimax',
    musicModel: options.model,
    processingTime,
    musicFileName: 'generated-music.mp3',
    musicFileSize: musicFile.size,
    musicDurationMs,
    lyricsSource,
    audioMimeType: MINIMAX_MUSIC_AUDIO_MIME_TYPE,
    audioSampleRate: generated.extra_info?.music_sample_rate ?? MINIMAX_MUSIC_AUDIO_SETTING.sample_rate,
    audioChannelCount: generated.extra_info?.music_channel,
    audioBitrate: generated.extra_info?.bitrate ?? MINIMAX_MUSIC_AUDIO_SETTING.bitrate,
    providerAudioByteSize: generated.extra_info?.music_size,
    outputFormat: MINIMAX_MUSIC_AUDIO_SETTING.format,
    providerTraceId: generated.trace_id,
    ...(generatedLyrics?.lyrics ? { generatedLyrics: generatedLyrics.lyrics } : {}),
    ...(generatedLyrics?.songTitle ? { generatedSongTitle: generatedLyrics.songTitle } : {}),
    ...(generatedLyrics?.styleTags ? { generatedStyleTags: generatedLyrics.styleTags } : {})
  }

  return { musicPath, metadata }
}
