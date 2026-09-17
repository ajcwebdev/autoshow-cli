import { runMusicGeneration } from '~/cli/commands/command-shared/media-generation/music-generation-scaffold'
import { formatElevenLabsErrorText } from '~/cli/commands/audio/tts/tts-services/tts-elevenlabs/elevenlabs-utils'
import type {
  ElevenLabsCompositionPlan,
  ElevenLabsMusicResponseAudio,
  ElevenlabsMusicModel,
  Step7MusicMetadata
} from '~/types'
import { ELEVENLABS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import * as l from '~/utils/app-logger/app-logger'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { createProviderRestClient } from '~/utils/rest-client'
import { InfraError, ProviderError, ValidationError } from '~/utils/error-handler'
import { DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS } from '~/cli/commands/audio/music/music-utils/music-pricing'
import { buildElevenLabsCompositionPlan } from './elevenlabs-composition-plan'

export const ELEVENLABS_MIN_DURATION_SECONDS = 3
export const ELEVENLABS_MAX_DURATION_SECONDS = 600
const ELEVENLABS_MIN_DURATION_MS = ELEVENLABS_MIN_DURATION_SECONDS * 1000
const ELEVENLABS_MAX_DURATION_MS = ELEVENLABS_MAX_DURATION_SECONDS * 1000
const REQUEST_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS
const ELEVENLABS_MUSIC_OUTPUTS = {
  music_v2: {
    format: 'mp3_48000_192',
    sampleRate: 48000,
    bitrate: 192000
  },
  music_v2_5: {
    format: 'mp3_48000_192',
    sampleRate: 48000,
    bitrate: 192000
  }
} as const satisfies Record<ElevenlabsMusicModel, {
  format: string
  sampleRate: number
  bitrate: number
}>

const normalizeMusicDurationMs = (durationSeconds: number | undefined): number | undefined => {
  if (durationSeconds === undefined) {
    return undefined
  }

  if (!Number.isFinite(durationSeconds)) {
    throw ValidationError(`Invalid music duration: ${durationSeconds}`, { stage: 'music:elevenlabs' })
  }

  const durationMs = Math.round(durationSeconds * 1000)
  if (durationMs < ELEVENLABS_MIN_DURATION_MS || durationMs > ELEVENLABS_MAX_DURATION_MS) {
    throw ValidationError(`ElevenLabs music duration must be between ${ELEVENLABS_MIN_DURATION_SECONDS} and ${ELEVENLABS_MAX_DURATION_SECONDS} seconds. Received: ${durationSeconds}s`, { stage: 'music:elevenlabs' })
  }

  return durationMs
}

const readElevenLabsRequestId = (headers: Headers): string | undefined =>
  headers.get('request-id')
  ?? headers.get('x-request-id')
  ?? headers.get('xi-request-id')
  ?? undefined

const readProvidedLyrics = async (lyricsFile: string): Promise<string> => {
  const file = Bun.file(lyricsFile)
  if (!await file.exists()) {
    throw InfraError(`Music lyrics file not found: ${lyricsFile}`, { stage: 'music:elevenlabs' })
  }

  const text = (await file.text()).trim()
  if (text.length === 0) {
    throw ValidationError(`Music lyrics file is empty: ${lyricsFile}`, { stage: 'music:elevenlabs' })
  }

  return text
}

const buildElevenLabsMusicRequest = async (
  prompt: string,
  options: {
    model: ElevenlabsMusicModel
    durationSeconds?: number | undefined
    lyricsFile?: string | undefined
    forceInstrumental?: boolean | undefined
  }
): Promise<{
  body: Record<string, unknown>
  lyricsSource: Step7MusicMetadata['lyricsSource']
  musicDurationMs: number | undefined
  compositionPlan: ElevenLabsCompositionPlan | undefined
}> => {
  const musicDurationMs = normalizeMusicDurationMs(options.durationSeconds)
  const forceInstrumental = options.forceInstrumental === true

  if (forceInstrumental) {
    if (options.lyricsFile) {
      l.warn('Ignoring --lyrics-file because --instrumental was provided for ElevenLabs music generation', { category: 'pipeline' })
    }

    return {
      body: {
        model_id: options.model,
        prompt,
        ...(musicDurationMs !== undefined ? { music_length_ms: musicDurationMs } : {}),
        force_instrumental: true
      },
      lyricsSource: 'none',
      musicDurationMs,
      compositionPlan: undefined
    }
  }

  if (options.lyricsFile) {
    const lyrics = await readProvidedLyrics(options.lyricsFile)
    const compositionPlan = buildElevenLabsCompositionPlan(lyrics, {
      stylePrompt: prompt,
      durationSeconds: options.durationSeconds ?? DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS
    })
    const planDurationMs = compositionPlan.chunks.reduce((sum, chunk) => sum + chunk.duration_ms, 0)

    return {
      body: {
        model_id: options.model,
        composition_plan: compositionPlan
      },
      lyricsSource: 'provided',
      musicDurationMs: planDurationMs,
      compositionPlan
    }
  }

  return {
    body: {
      model_id: options.model,
      prompt,
      ...(musicDurationMs !== undefined ? { music_length_ms: musicDurationMs } : {})
    },
    lyricsSource: 'generated',
    musicDurationMs,
    compositionPlan: undefined
  }
}


/** ElevenLabs returns the track as raw audio, so the shared REST client owns the error capture and this reads the bytes. */
const elevenLabsMusicRequest = createProviderRestClient<{
  apiKey: string
  outputFormat: string
  body: Record<string, unknown>
  signal: AbortSignal
}, Error>({
  buildRequest: (options) => ({
    url: `${ELEVENLABS_DEFAULT_BASE_URL}/music?output_format=${options.outputFormat}`,
    init: {
      method: 'POST',
      headers: {
        'xi-api-key': options.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      },
      body: JSON.stringify(options.body),
      signal: options.signal
    }
  }),
  errorMessagePrefix: () => 'ElevenLabs music generation failed',
  formatErrorMessage: ({ response, rawText, errorMessagePrefix }) =>
    `${errorMessagePrefix} (${response.status}): ${formatElevenLabsErrorText(rawText, response.status)}`,
  createError: ({ message, response }) => ProviderError(message, {
    stage: 'music:elevenlabs',
    status: response.status,
    headers: response.headers
  }),
  diagnostics: 'factory'
})

export const runElevenLabsMusicGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: ElevenlabsMusicModel
    durationSeconds?: number | undefined
    lyricsFile?: string | undefined
    forceInstrumental?: boolean | undefined
  }
): Promise<{ musicPath: string, metadata: Step7MusicMetadata }> => {
  const output = ELEVENLABS_MUSIC_OUTPUTS[options.model]

  return await runMusicGeneration({
    service: 'elevenlabs',
    model: options.model,
    outputDir,
    prepare: async () => await buildElevenLabsMusicRequest(prompt, options),
    execute: async (context, request) => {
      const audioResponse = await withRetry(
        { retryClass: 'runtime_http_create_conservative', operationName: 'elevenlabs-music' },
        async (signal) => {
          const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
          const response = await elevenLabsMusicRequest({
            apiKey: context.apiKey,
            outputFormat: output.format,
            body: request.body,
            signal: AbortSignal.any([...(signal ? [signal] : []), timeoutSignal])
          })

          return {
            bytes: new Uint8Array(await response.arrayBuffer()),
            mimeType: response.headers.get('content-type')?.split(';')[0]?.trim() || undefined,
            requestId: readElevenLabsRequestId(response.headers)
          } satisfies ElevenLabsMusicResponseAudio
        },
        (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
      )
      const audioBytes = audioResponse.bytes
      if (audioBytes.byteLength === 0) {
        throw InfraError('ElevenLabs music generation returned empty audio', { stage: 'music:elevenlabs' })
      }

      const musicPath = context.artifactPath()
      await Bun.write(musicPath, audioBytes)

      return {
        artifactPaths: [musicPath],
        metadata: {
          musicDurationMs: request.musicDurationMs,
          lyricsSource: request.lyricsSource,
          providerRequestId: audioResponse.requestId,
          audioMimeType: audioResponse.mimeType ?? 'audio/mpeg',
          audioSampleRate: output.sampleRate,
          audioBitrate: output.bitrate,
          providerAudioByteSize: audioBytes.byteLength,
          outputFormat: output.format,
          ...(request.compositionPlan ? { compositionPlanChunkCount: request.compositionPlan.chunks.length } : {})
        }
      }
    }
  })
}
