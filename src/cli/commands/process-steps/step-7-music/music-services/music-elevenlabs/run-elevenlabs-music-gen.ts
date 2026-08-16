import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { readElevenLabsError } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-elevenlabs/elevenlabs-utils'
import type { ElevenLabsMusicResponseAudio, ElevenlabsMusicModel, Step7MusicMetadata } from '~/types'
import { ELEVENLABS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { requireApiKey } from '~/utils/validate/env-utils'
import { InfraError, ValidationError } from '~/utils/error-handler'

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

export const runElevenLabsMusicGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: ElevenlabsMusicModel
    durationSeconds?: number | undefined
    forceInstrumental?: boolean | undefined
  }
): Promise<{ musicPath: string, metadata: Step7MusicMetadata }> => {
  const apiKey = requireApiKey('ELEVENLABS_API_KEY', 'music:elevenlabs', 'ElevenLabs music generation')

  const baseURL = ELEVENLABS_DEFAULT_BASE_URL
  const musicPath = `${outputDir}/generated-music.mp3`
  const musicDurationMs = normalizeMusicDurationMs(options.durationSeconds)
  const forceInstrumental = options.forceInstrumental === true
  const output = ELEVENLABS_MUSIC_OUTPUTS[options.model]

  logGenStatus('music', 'elevenlabs', options.model, 'started')

  const startTime = Date.now()

  const audioResponse = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName: 'elevenlabs-music' },
    async (signal) => {
      const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      const combined = AbortSignal.any([...(signal ? [signal] : []), timeoutSignal])

      const response = await fetch(`${baseURL}/music?output_format=${output.format}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg'
        },
        body: JSON.stringify({
          model_id: options.model,
          prompt,
          ...(musicDurationMs !== undefined ? { music_length_ms: musicDurationMs } : {}),
          ...(forceInstrumental ? { force_instrumental: true } : {})
        }),
        signal: combined
      })

      if (!response.ok) {
        const errText = await readElevenLabsError(response)
        throw InfraError(`ElevenLabs music generation failed (${response.status}): ${errText}`, { stage: 'music:elevenlabs', status: response.status })
      }

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

  await Bun.write(musicPath, audioBytes)

  const processingTime = Date.now() - startTime
  const musicFile = Bun.file(musicPath)

  logGenCompleted('music', 'elevenlabs', options.model, processingTime, [musicPath])

  const metadata: Step7MusicMetadata = {
    musicService: 'elevenlabs',
    musicModel: options.model,
    processingTime,
    musicFileName: 'generated-music.mp3',
    musicFileSize: musicFile.size,
    musicDurationMs,
    lyricsSource: forceInstrumental ? 'none' : 'generated',
    providerRequestId: audioResponse.requestId,
    audioMimeType: audioResponse.mimeType ?? 'audio/mpeg',
    audioSampleRate: output.sampleRate,
    audioBitrate: output.bitrate,
    providerAudioByteSize: audioBytes.byteLength,
    outputFormat: output.format
  }

  return { musicPath, metadata }
}
