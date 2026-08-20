import type { RunFalTtsOptions, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { validateFalTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runFalQueue } from '~/utils/fal-client/fal-queue'
import { ProviderError, ValidationError } from '~/utils/error-handler'
import { extractRestErrorMessage, parseJsonOrText, readRestResponseText } from '~/utils/rest-client'
import { classifyFetchRetry, isRetryableStatus, withRetry } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'
import {
  buildFalTtsRequestBody,
  extractFalTtsAudioUrl,
  FAL_TTS_SERIALIZER_VERSION,
  resolveFalTtsDefaultVoice,
  resolveFalTtsVoiceField,
} from './fal-tts-request'

export const runFalTts = async (
  text: string,
  outputDir: string,
  options: RunFalTtsOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  if (!options.apiKey.trim()) {
    throw ValidationError('fal.ai API key is required', { stage: 'tts:fal' })
  }
  const voice = validateFalTtsVoice(options.voiceId?.trim() || resolveFalTtsDefaultVoice(options.model))
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.fal ?? 2000)
  if (chunks.length === 0) {
    throw ValidationError('fal.ai TTS input text is empty', { stage: 'tts:fal' })
  }

  logTtsConfig('fal.ai', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'chunk count', value: chunks.length },
    ...(options.voiceInstruction ? [{ label: 'instruction', value: options.voiceInstruction }] : []),
  ])

  const queue = options.runQueue ?? runFalQueue
  return await runHostedTtsChunkPipeline({
    provider: 'fal',
    providerLabel: 'fal.ai',
    model: options.model,
    speaker: voice,
    chunks,
    outputDir,
    chunkExtension: 'wav',
    startTime: Date.now(),
    abortSignal: options.abortSignal,
    chunkConcurrency: options.chunkConcurrency,
    chunkScheduler: options.chunkScheduler,
    requestEvidence: options.requestEvidence,
    fetchChunkAudio: async ({ chunk, chunkIndex, requestAttempt, retryReasonCode }) => {
      const body = buildFalTtsRequestBody({
        model: options.model,
        text: chunk,
        voice,
        voiceInstruction: options.voiceInstruction,
      })
      return await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'queue',
        serializerVersion: FAL_TTS_SERIALIZER_VERSION,
        serializedRequest: { path: `/${options.model}`, body },
        providerText: chunk,
        voiceField: resolveFalTtsVoiceField(options.model),
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls: {
          format: 'wav',
          ...(options.voiceInstruction ? { voiceInstruction: options.voiceInstruction } : {}),
        },
        continuation: { kind: 'none' },
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async ({ accepted }) => {
        const queued = await queue({
          apiKey: options.apiKey,
          endpointId: options.model,
          input: body,
          operationName: `fal-tts-chunk-${chunkIndex + 1}`,
        })
        await accepted({
          providerRequestId: queued.requestId,
          fields: { httpStatus: 200 },
        })
        const audioUrl = extractFalTtsAudioUrl(queued.output)
        return await withRetry({
          retryClass: 'runtime_http_read',
          operationName: `fal-tts-audio-download-${chunkIndex + 1}`,
          timeoutMs: MEDIA_GENERATION_TIMEOUT_MS,
        }, async (downloadSignal) => {
          const audioRes = await fetch(audioUrl, downloadSignal ? { signal: downloadSignal } : undefined)
          if (!audioRes.ok) {
            const captured = await readRestResponseText(audioRes)
            const payload = captured.truncated ? captured.sanitizedPreview : parseJsonOrText(captured.text)
            throw ProviderError(`fal.ai TTS audio download failed (${audioRes.status}): ${extractRestErrorMessage(payload, captured.text, audioRes.status)}`, {
              status: audioRes.status,
              headers: audioRes.headers,
              stage: 'tts:fal:download',
              retryable: isRetryableStatus(audioRes.status),
            })
          }
          const audio = new Uint8Array(await audioRes.arrayBuffer())
          if (audio.byteLength === 0) {
            throw ValidationError('fal.ai TTS returned empty audio', { stage: 'tts:fal:response' })
          }
          return audio
        }, (error) => classifyFetchRetry(error, 'runtime_http_read'))
      })
    },
  })
}
