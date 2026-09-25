import type { HostedTtsChunkScheduler, SonioxTtsModel, TtsChunkingOptions, TtsRequestEvidenceScope } from '~/types'
import { SONIOX_TTS_BASE_URL } from '~/utils/base-urls'
import { httpResponseError, httpResponseOptions, parseJsonOrText, readRestDiagnosticText } from '~/utils/rest-client'
import { UsageError } from '~/utils/error-handler'
import { requireTtsCredential } from '../../tts-utils/tts-credentials'
import { runHostedTtsChunkPipeline } from '../../tts-utils/hosted-tts-chunk-pipeline'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'
import { splitSonioxTtsText } from './soniox-tts-chunks'
import { decodeSonioxWavDuration, retainSonioxAudioResponse } from './soniox-tts-audio'
import { serializeSonioxTts, sonioxTtsRequestControls, SONIOX_TTS_SERIALIZER_VERSION } from './soniox-tts-request'

export const runSonioxTts = async (text: string, outputDir: string, options: {
  model: SonioxTtsModel
  voiceId?: string | undefined
  language?: string | undefined
  speed?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  chunking?: TtsChunkingOptions | undefined
  abortSignal?: AbortSignal | undefined
  requestEvidence?: TtsRequestEvidenceScope | undefined
}) => {
  const chunks = splitSonioxTtsText(text, options.chunking)
  if (!chunks.length) throw UsageError('Soniox TTS input text is empty.')
  const requests = chunks.map(chunk => serializeSonioxTts(options.model, options.voiceId ?? 'Adrian', chunk, options.language, options.speed))
  const controls = sonioxTtsRequestControls(options.language, options.speed)
  const scheduler = options.chunkScheduler
  if (!scheduler?.waitForRequestStart) throw UsageError('Soniox TTS requires the shared request scheduler with rate admission.')
  const apiKey = requireTtsCredential('soniox')
  let providerAudioSeconds = 0
  const result = await runHostedTtsChunkPipeline({
    provider: 'soniox', providerLabel: 'Soniox', model: options.model, speaker: requests[0]!.voice,
    chunks, outputDir, chunkExtension: 'wav', startTime: Date.now(),
    abortSignal: options.abortSignal, chunkScheduler: options.chunkScheduler, requestEvidence: options.requestEvidence,
    fetchChunkAudio: async ({ chunk, chunkIndex, signal, requestAttempt, retryReasonCode }) => {
      const body = requests[chunkIndex - 1]!
      return dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex, endpointKind: 'speech-synthesis', serializerVersion: SONIOX_TTS_SERIALIZER_VERSION,
        serializedRequest: { path: '/tts', body }, providerText: chunk,
        voiceField: 'voice', voices: [{ kind: 'provider-id', value: body.voice }],
        requestControls: controls, continuation: { kind: 'none' },
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async lifecycle => {
        await scheduler.waitForRequestStart!('soniox', signal)
        const response = await fetch(`${SONIOX_TTS_BASE_URL}/tts`, {
          method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'audio/wav' },
          body: JSON.stringify(body), ...(signal ? { signal } : {}),
        })
        if (!response.ok) {
          const raw = await readRestDiagnosticText(response)
          const parsed = parseJsonOrText(raw)
          const error = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
          const errorType = typeof error['error_type'] === 'string' ? error['error_type'] : 'unknown'
          const requestId = typeof error['request_id'] === 'string' ? error['request_id'] : response.headers.get('x-request-id')
          throw httpResponseError(`Soniox TTS failed (HTTP ${response.status}, ${errorType}${requestId ? `, request_id=${requestId}` : ''}): ${typeof error['error_message'] === 'string' ? error['error_message'] : 'See provider error type.'}`, httpResponseOptions(response, {
            stage: 'tts:soniox', retryClass: 'runtime_http_create_conservative', retryable: response.status === 429 && errorType === 'limit_exceeded',
            metadata: { errorType, ...(requestId ? { requestId } : {}) },
          }))
        }
        await lifecycle.accepted({ ...(response.headers.get('x-request-id') ? { providerRequestId: response.headers.get('x-request-id')! } : {}) })
        // Persist before validation. A valid HTTP response can still be corrupt or duration-capped.
        const bytes = await retainSonioxAudioResponse(response, `${outputDir}/soniox-response-chunk-${String(chunkIndex).padStart(3, '0')}.wav`)
        providerAudioSeconds += decodeSonioxWavDuration(bytes)
        return bytes
      })
    },
  })
  return { ...result, metadata: { ...result.metadata, sonioxProviderAudioSeconds: providerAudioSeconds, sonioxInputCharacters: chunks.reduce((sum, chunk) => sum + [...chunk].length, 0) } }
}
