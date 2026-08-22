import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { HUME_DEFAULT_TTS_VOICE, HUME_LIBRARY_VOICE_PROVIDER, validateHumeTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { HostedTtsChunkScheduler, HumeTtsModel, HumeVoicePayload, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { HUME_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireProviderKey } from '~/utils/validate/env-utils'
import { ValidationError } from '~/utils/error-handler'
import { httpResponseError } from '~/utils/rest-client'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'
import { readRestErrorText } from '~/utils/rest-client'

const UUID_LIKE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const resolveHumeVoice = (
  options: {
    voice?: string | undefined
  }
): { label: string, payload: HumeVoicePayload, provider?: string | undefined } => {
  const rawVoice = options.voice?.trim() || HUME_DEFAULT_TTS_VOICE
  const label = validateHumeTtsVoice(rawVoice)

  if (UUID_LIKE_RE.test(label)) {
    return { label, payload: { id: label } }
  }

  return { label, provider: HUME_LIBRARY_VOICE_PROVIDER, payload: { name: label, provider: HUME_LIBRARY_VOICE_PROVIDER } }
}

export const runHumeTts = async (
  text: string,
  outputDir: string,
  options: {
    model: HumeTtsModel
    voice?: string | undefined
    speed?: number | undefined
    trailingSilence?: number | undefined
    description?: string | undefined
    abortSignal?: AbortSignal | undefined
    chunkConcurrency?: number | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
    requestEvidence?: TtsRequestEvidenceScope | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = requireProviderKey('hume', 'tts:hume', 'Hume TTS')

  const baseURL = trimTrailingSlash(HUME_DEFAULT_BASE_URL)
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.hume)

  if (chunks.length === 0) {
    throw ValidationError('Hume TTS input text is empty', { stage: 'tts:hume' })
  }

  const voice = resolveHumeVoice(options)

  logTtsConfig('Hume', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice.label },
    { label: 'voice provider', value: voice.provider },
    { label: 'speed', value: options.speed },
    { label: 'trailing silence', value: options.trailingSilence },
    { label: 'acting description', value: options.description },
    { label: 'chunk count', value: chunks.length }
  ])

  return await runHostedTtsChunkPipeline({
    provider: 'hume',
    providerLabel: 'Hume',
    model: options.model,
    speaker: voice.label,
    chunks,
    outputDir,
    chunkExtension: 'mp3',
    startTime: Date.now(),
    abortSignal: options.abortSignal,
    chunkConcurrency: options.chunkConcurrency,
    chunkScheduler: options.chunkScheduler,
    requestEvidence: options.requestEvidence,
    fetchChunkAudio: async ({ chunk, chunkIndex, signal, requestAttempt, retryReasonCode }) => {
      const requestBody = {
        version: options.model === 'octave-1' ? '1' : '2',
        format: { type: 'mp3' },
        num_generations: 1,
        utterances: [{
          text: chunk,
          voice: voice.payload,
          ...(typeof options.speed === 'number' ? { speed: options.speed } : {}),
          ...(typeof options.trailingSilence === 'number' ? { trailing_silence: options.trailingSilence } : {}),
          ...(options.model === 'octave-1' && options.description ? { description: options.description } : {})
        }]
      }
      return await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'hume.tts.phase-0-v1',
        serializedRequest: { path: '/v0/tts/file', body: requestBody },
        providerText: chunk,
        voiceField: 'utterances[].voice',
        voices: [{ kind: 'provider-id', value: voice.label }],
        requestControls: {
          version: requestBody.version,
          format: requestBody.format,
          numGenerations: requestBody.num_generations,
          ...(typeof options.speed === 'number' ? { speed: options.speed } : {}),
          ...(typeof options.trailingSilence === 'number' ? { trailingSilence: options.trailingSilence } : {}),
          ...(options.model === 'octave-1' && options.description ? { description: options.description } : {})
        },
        continuation: { kind: 'none' }
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async ({ accepted }) => {
        const response = await fetch(`${baseURL}/v0/tts/file`, {
        method: 'POST',
        headers: {
          'X-Hume-Api-Key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/octet-stream'
        },
        body: JSON.stringify(requestBody),
        ...(signal ? { signal } : {})
      })

      if (!response.ok) {
        const errText = await readRestErrorText(response)
        throw httpResponseError(`Hume TTS failed (${response.status}): ${errText}`, response)
      }
      await accepted({ fields: { httpStatus: response.status } })
      return new Uint8Array(await response.arrayBuffer())
      })
    }
  })
}
