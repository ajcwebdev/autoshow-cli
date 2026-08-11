import type { HostedTtsChunkScheduler, OpenAITtsModel, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { OPENAI_DEFAULT_TTS_VOICE, resolveOpenAITtsVoiceForModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import { createOpenAISpeech } from '~/utils/openai/openai-client'
import { ValidationError } from '~/utils/error-handler'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'

export const runOpenAITts = async (
  text: string,
  outputDir: string,
  options: {
    model: OpenAITtsModel
    voiceId?: string | undefined
    instructions?: string | undefined
    speed?: number | undefined
    abortSignal?: AbortSignal | undefined
    chunkConcurrency?: number | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
    requestEvidence?: TtsRequestEvidenceScope | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const voiceSelection = resolveOpenAITtsVoiceForModel(
    options.model,
    options.voiceId?.trim() || OPENAI_DEFAULT_TTS_VOICE
  )
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.openai)

  if (chunks.length === 0) {
    throw ValidationError('OpenAI TTS input text is empty', { stage: 'tts:openai' })
  }

  const startTime = Date.now()
  const config = getOpenAIClientConfig()
  const voiceId = voiceSelection.voiceId
  const speaker = voiceId
  const speechVoice = voiceSelection.requestVoice

  const supportsInstructions = options.model === 'gpt-4o-mini-tts-2025-12-15'
  const includeInstructions = Boolean(options.instructions) && supportsInstructions

  logTtsConfig('OpenAI', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voiceId },
    ...(includeInstructions ? [{ label: 'instructions', value: 'configured' }] : []),
    ...(typeof options.speed === 'number' ? [{ label: 'speed', value: options.speed }] : []),
    { label: 'chunk count', value: chunks.length }
  ])

  return await runHostedTtsChunkPipeline({
    provider: 'openai',
    providerLabel: 'OpenAI',
    model: options.model,
    speaker,
    chunks,
    outputDir,
    chunkExtension: 'wav',
    startTime,
    abortSignal: options.abortSignal,
    chunkConcurrency: options.chunkConcurrency,
    chunkScheduler: options.chunkScheduler,
    requestEvidence: options.requestEvidence,
    fetchChunkAudio: async ({ chunk, chunkIndex, signal, requestAttempt, retryReasonCode }) => {
      const requestBody = {
        model: options.model,
        voice: speechVoice,
        input: chunk,
        response_format: 'wav' as const,
        ...(includeInstructions ? { instructions: options.instructions } : {}),
        ...(typeof options.speed === 'number' ? { speed: options.speed } : {})
      }
      return await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'openai.tts.phase-0-v1',
        serializedRequest: { path: '/audio/speech', body: requestBody },
        providerText: chunk,
        voiceField: 'voice',
        voices: [{ kind: 'provider-id', value: voiceId }],
        requestControls: {
          responseFormat: requestBody.response_format,
          ...(includeInstructions ? { instructions: options.instructions } : {}),
          ...(typeof options.speed === 'number' ? { speed: options.speed } : {})
        },
        continuation: { kind: 'none' }
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async () =>
        await createOpenAISpeech(config, requestBody, { signal }))
    }
  })
}
