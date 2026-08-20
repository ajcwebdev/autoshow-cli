import type { RunDeepinfraTtsOptions, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { resolveTtsChunkCharacterLimit } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { validateDeepinfraTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ProviderError, ValidationError } from '~/utils/error-handler'
import { extractRestErrorMessage, parseJsonOrText, readRestResponseText } from '~/utils/rest-client'
import { isRetryableStatus } from '~/utils/retries'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'
import {
  buildDeepinfraTtsRequestBody,
  decodeDeepinfraTtsAudio,
  DEEPINFRA_TTS_SERIALIZER_VERSION,
  prepareDeepinfraTtsText,
  resolveDeepinfraTtsDefaultVoice,
  resolveDeepinfraTtsRequestControls,
  resolveDeepinfraTtsVoiceField,
} from './deepinfra-tts-request'

export const runDeepinfraTts = async (
  text: string,
  outputDir: string,
  options: RunDeepinfraTtsOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  if (!options.apiKey.trim()) {
    throw ValidationError('DeepInfra API key is required', { stage: 'tts:deepinfra' })
  }
  const voice = validateDeepinfraTtsVoice(options.voiceId?.trim() || resolveDeepinfraTtsDefaultVoice(options.model))
  const providerText = prepareDeepinfraTtsText(options.model, text)
  const chunks = splitTextIntoChunks(providerText, resolveTtsChunkCharacterLimit('deepinfra', options.model) ?? 2000)
  const voiceField = resolveDeepinfraTtsVoiceField(options.model)
  const requestControls = resolveDeepinfraTtsRequestControls(options.model, options.promptInstructions)

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
      const body = buildDeepinfraTtsRequestBody({
        model: options.model,
        text: chunk,
        voice,
        promptInstructions: options.promptInstructions
      })
      return await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'inference',
        serializerVersion: DEEPINFRA_TTS_SERIALIZER_VERSION,
        serializedRequest: {
          path: `/v1/inference/${options.model}`,
          body
        },
        providerText: chunk,
        voiceField,
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls,
        continuation: { kind: 'none' }
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async ({ accepted }) => {
        const res = await fetch(`https://api.deepinfra.com/v1/inference/${options.model}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.apiKey}`
          },
          body: JSON.stringify(body),
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
        return await decodeDeepinfraTtsAudio(res)
      })
    }
  })
}
