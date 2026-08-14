import type { DeepinfraTtsModel, HostedTtsChunkScheduler, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { DEEPINFRA_DEFAULT_TTS_VOICE, validateDeepinfraTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ProviderError, ValidationError } from '~/utils/error-handler'
import { extractRestErrorMessage, isRecord, parseJsonOrText, readJsonResponse, readRestResponseText } from '~/utils/rest-client'
import { isRetryableStatus } from '~/utils/retries'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'

export type RunDeepinfraTtsOptions = Readonly<{
  model: DeepinfraTtsModel
  apiKey: string
  voiceId?: string | undefined
  promptInstructions?: string | undefined
  abortSignal?: AbortSignal | undefined
  chunkConcurrency?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  requestEvidence?: TtsRequestEvidenceScope | undefined
}>

export const runDeepinfraTts = async (
  text: string,
  outputDir: string,
  options: RunDeepinfraTtsOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  if (!options.apiKey.trim()) {
    throw ValidationError('DeepInfra API key is required', { stage: 'tts:deepinfra' })
  }
  const voice = validateDeepinfraTtsVoice(options.voiceId?.trim() || DEEPINFRA_DEFAULT_TTS_VOICE)
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.deepinfra ?? 2000)

  if (chunks.length === 0) {
    throw ValidationError('DeepInfra TTS input text is empty', { stage: 'tts:deepinfra' })
  }

  logTtsConfig('DeepInfra', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'chunk count', value: chunks.length },
    ...(options.promptInstructions ? [{ label: 'instructions', value: options.promptInstructions }] : [])
  ])

  return await runHostedTtsChunkPipeline({
    provider: 'deepinfra',
    providerLabel: 'DeepInfra',
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
    fetchChunkAudio: async ({ chunk, chunkIndex, requestAttempt, retryReasonCode, signal }) => {
      return await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'inference',
        serializerVersion: 'deepinfra.tts.phase-4-v1',
        serializedRequest: {
          path: `/v1/inference/${options.model}`,
          body: {
            text: chunk,
            preset_voice: voice,
            ...(options.promptInstructions ? { prompt: options.promptInstructions } : {})
          }
        },
        providerText: chunk,
        voiceField: 'preset_voice',
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls: {
          format: 'wav',
          ...(options.promptInstructions ? { promptInstructions: options.promptInstructions } : {})
        },
        continuation: { kind: 'none' }
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async ({ accepted }) => {
        const res = await fetch(`https://api.deepinfra.com/v1/inference/${options.model}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.apiKey}`
          },
          body: JSON.stringify({
            text: chunk,
            preset_voice: voice,
            ...(options.promptInstructions ? { prompt: options.promptInstructions } : {})
          }),
          ...(signal ? { signal } : {})
        })
        if (!res.ok) {
          const captured = await readRestResponseText(res)
          const payload = captured.truncated ? captured.sanitizedPreview : parseJsonOrText(captured.text)
          throw ProviderError(`DeepInfra TTS failed (${res.status}): ${extractRestErrorMessage(payload, captured.text, res.status)}`, {
            status: res.status,
            headers: res.headers,
            stage: 'tts:deepinfra:create',
            retryable: isRetryableStatus(res.status)
          })
        }
        await accepted({
          providerRequestId: res.headers.get('x-request-id') ?? undefined,
          fields: { httpStatus: res.status }
        })
        const contentType = res.headers.get('content-type')?.toLowerCase() ?? ''
        if (contentType.startsWith('audio/') || contentType.includes('application/octet-stream')) {
          const audio = new Uint8Array(await res.arrayBuffer())
          if (audio.byteLength === 0) {
            throw ValidationError('DeepInfra TTS returned an empty audio response', { stage: 'tts:deepinfra:response' })
          }
          return audio
        }
        const json = await readJsonResponse(res, 'DeepInfra TTS response')
        const b64 = isRecord(json)
          ? (typeof json['audio'] === 'string' ? json['audio'] : json['audio_b64'])
          : undefined
        if (typeof b64 === 'string' && b64.trim().length > 0) {
          const cleanB64 = b64.includes('base64,') ? (b64.split('base64,')[1] ?? b64) : b64
          const audio = new Uint8Array(Buffer.from(cleanB64, 'base64'))
          if (audio.byteLength === 0) {
            throw ValidationError('DeepInfra TTS returned empty base64 audio', { stage: 'tts:deepinfra:response' })
          }
          return audio
        }
        throw ValidationError('DeepInfra TTS response did not contain audio', { stage: 'tts:deepinfra:response' })
      })
    }
  })
}
