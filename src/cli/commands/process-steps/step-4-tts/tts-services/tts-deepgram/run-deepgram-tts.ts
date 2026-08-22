import type { DeepgramTtsModel, HostedTtsChunkScheduler, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { DEEPGRAM_DEFAULT_VOICE, validateDeepgramTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { requireProviderKey } from '~/utils/validate/env-utils'
import { DEEPGRAM_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { InfraError } from '~/utils/error-handler'
import { readDeepgramError } from './deepgram-utils'
import { httpResponseError } from '~/utils/rest-client'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const DEEPGRAM_TTS_ENCODING = 'linear16'
const DEEPGRAM_TTS_CONTAINER = 'wav'

export const runDeepgramTts = async (
  text: string,
  outputDir: string,
  options: {
    model: DeepgramTtsModel
    voiceId?: string | undefined
    speed?: number | undefined
    abortSignal?: AbortSignal | undefined
    chunkConcurrency?: number | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
    requestEvidence?: TtsRequestEvidenceScope | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = requireProviderKey('deepgram', 'tts:deepgram', 'Deepgram TTS')

  const baseURL = trimTrailingSlash(DEEPGRAM_DEFAULT_BASE_URL)
  const rawVoice = options.voiceId?.trim() || options.model || DEEPGRAM_DEFAULT_VOICE
  const voice = validateDeepgramTtsVoice(rawVoice)
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.deepgram)

  if (chunks.length === 0) {
    throw InfraError('Deepgram TTS input text is empty', { stage: 'tts:deepgram' })
  }

  logTtsConfig('Deepgram', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'encoding', value: DEEPGRAM_TTS_ENCODING },
    { label: 'container', value: DEEPGRAM_TTS_CONTAINER },
    { label: 'speed', value: options.speed },
    { label: 'chunk count', value: chunks.length }
  ])

  return await runHostedTtsChunkPipeline({
    provider: 'deepgram',
    providerLabel: 'Deepgram',
    model: options.model,
    speaker: voice,
    chunks,
    outputDir,
    chunkExtension: DEEPGRAM_TTS_CONTAINER,
    startTime: Date.now(),
    abortSignal: options.abortSignal,
    chunkConcurrency: options.chunkConcurrency,
    chunkScheduler: options.chunkScheduler,
    requestEvidence: options.requestEvidence,
    fetchChunkAudio: async ({ chunk, chunkIndex, signal, requestAttempt, retryReasonCode }) => {
      const params = new URLSearchParams({
        model: voice,
        encoding: DEEPGRAM_TTS_ENCODING,
        container: DEEPGRAM_TTS_CONTAINER
      })
      if (typeof options.speed === 'number') params.set('speed', String(options.speed))

      const requestBody = { text: chunk }
      return await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'deepgram.tts.phase-0-v1',
        serializedRequest: { path: '/v1/speak', query: Object.fromEntries(params), body: requestBody },
        providerText: chunk,
        voiceField: 'query.model',
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls: {
          encoding: DEEPGRAM_TTS_ENCODING,
          container: DEEPGRAM_TTS_CONTAINER,
          ...(typeof options.speed === 'number' ? { speed: options.speed } : {})
        },
        continuation: { kind: 'none' }
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async ({ accepted }) => {
        const response = await fetch(`${baseURL}/v1/speak?${params.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'audio/wav'
        },
        body: JSON.stringify(requestBody),
        ...(signal ? { signal } : {})
      })

      if (!response.ok) {
        const errText = await readDeepgramError(response)
        throw httpResponseError(`Deepgram TTS failed (${response.status}): ${errText}`, response)
      }
      await accepted({ fields: { httpStatus: response.status } })
      return new Uint8Array(await response.arrayBuffer())
      })
    }
  })
}
