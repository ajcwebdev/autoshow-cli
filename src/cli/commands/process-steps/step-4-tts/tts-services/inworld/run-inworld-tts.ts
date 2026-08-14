import type { HostedTtsChunkScheduler, InworldTtsModel, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { INWORLD_DEFAULT_TTS_VOICE, validateInworldTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ProviderError, ValidationError } from '~/utils/error-handler'
import { extractRestErrorMessage, isRecord, parseJsonOrText, readJsonResponse, readRestResponseText } from '~/utils/rest-client'
import { isRetryableStatus } from '~/utils/retries'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'
import { buildInworldTtsRequestBody, INWORLD_TTS_SERIALIZER_VERSION } from './inworld-tts-request'

export type RunInworldTtsOptions = Readonly<{
  model: InworldTtsModel
  apiKey: string
  voiceId?: string | undefined
  steeringPrompt?: string | undefined
  abortSignal?: AbortSignal | undefined
  chunkConcurrency?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  requestEvidence?: TtsRequestEvidenceScope | undefined
}>

export const parseInworldMarkups = (text: string): { sanitizedText: string, markups: string[] } => {
  const markupRegex = /\[(happy|sad|angry|fearful|disgusted|surprised|calm|whisper|breathe|cough|sigh|laugh)\]/gi
  const markups: string[] = []
  const sanitizedText = text.replace(markupRegex, (_match, markup) => {
    markups.push(markup.toLowerCase())
    return ''
  }).trim()
  return { sanitizedText: sanitizedText || text, markups }
}

export const runInworldTts = async (
  text: string,
  outputDir: string,
  options: RunInworldTtsOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  if (!options.apiKey.trim()) {
    throw ValidationError('Inworld AI API key is required', { stage: 'tts:inworld' })
  }
  const voice = validateInworldTtsVoice(options.voiceId?.trim() || INWORLD_DEFAULT_TTS_VOICE)
  const { sanitizedText, markups } = parseInworldMarkups(text)
  const chunks = splitTextIntoChunks(sanitizedText, TTS_CHUNK_CHARACTER_LIMITS.inworld ?? 2000)

  if (chunks.length === 0) {
    throw ValidationError('Inworld AI TTS input text is empty', { stage: 'tts:inworld' })
  }

  logTtsConfig('Inworld AI', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'chunk count', value: chunks.length },
    ...(options.steeringPrompt ? [{ label: 'steering', value: options.steeringPrompt }] : []),
    ...(markups.length > 0 ? [{ label: 'markups', value: markups.join(', ') }] : [])
  ])

  return await runHostedTtsChunkPipeline({
    provider: 'inworld',
    providerLabel: 'Inworld AI',
    model: options.model,
    speaker: voice,
    chunks,
    outputDir,
    chunkExtension: 'mp3',
    startTime: Date.now(),
    abortSignal: options.abortSignal,
    chunkConcurrency: options.chunkConcurrency,
    chunkScheduler: options.chunkScheduler,
    requestEvidence: options.requestEvidence,
    fetchChunkAudio: async ({ chunk, chunkIndex, requestAttempt, retryReasonCode, signal }) => {
      const resolvedVoice = voice === 'voice_inworld_standard_en' ? 'Dennis' : voice
      const body = buildInworldTtsRequestBody({
        model: options.model,
        text: chunk,
        voiceId: resolvedVoice,
        steeringPrompt: options.steeringPrompt,
        markups
      })
      return await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'realtime-tts',
        serializerVersion: INWORLD_TTS_SERIALIZER_VERSION,
        serializedRequest: {
          path: '/tts/v1/voice',
          body
        },
        providerText: chunk,
        voiceField: 'voiceId',
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls: {
          format: 'mp3',
          ...(options.steeringPrompt ? { steeringPrompt: options.steeringPrompt } : {}),
          ...(markups.length > 0 ? { markups } : {})
        },
        continuation: { kind: 'none' }
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async ({ accepted }) => {
        const authHeader = options.apiKey.startsWith('Basic ') ? options.apiKey : `Basic ${options.apiKey}`
        const res = await fetch('https://api.inworld.ai/tts/v1/voice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify(body),
          ...(signal ? { signal } : {})
        })
        if (!res.ok) {
          const captured = await readRestResponseText(res)
          const payload = captured.truncated ? captured.sanitizedPreview : parseJsonOrText(captured.text)
          throw ProviderError(`Inworld AI TTS failed (${res.status}): ${extractRestErrorMessage(payload, captured.text, res.status)}`, {
            status: res.status,
            headers: res.headers,
            stage: 'tts:inworld:create',
            retryable: isRetryableStatus(res.status)
          })
        }
        await accepted({
          providerRequestId: res.headers.get('x-request-id') ?? undefined,
          fields: { httpStatus: res.status }
        })
        const data = await readJsonResponse(res, 'Inworld AI TTS response')
        const audioContent = isRecord(data) ? data['audioContent'] : undefined
        if (typeof audioContent !== 'string' || audioContent.trim().length === 0) {
          throw ValidationError('Inworld AI TTS response missing audioContent', { stage: 'tts:inworld:response' })
        }
        const audio = new Uint8Array(Buffer.from(audioContent, 'base64'))
        if (audio.byteLength === 0) {
          throw ValidationError('Inworld AI TTS response contained empty audioContent', { stage: 'tts:inworld:response' })
        }
        return audio
      })
    }
  })
}
