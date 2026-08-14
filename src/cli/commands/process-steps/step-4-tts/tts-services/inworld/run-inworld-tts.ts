import type { HostedTtsChunkScheduler, InworldTtsModel, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { INWORLD_DEFAULT_TTS_VOICE, validateInworldTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ValidationError } from '~/utils/error-handler'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'

const generateSimpleWavBuffer = (durationSeconds = 1.0, sampleRate = 44100): Uint8Array => {
  const numSamples = Math.floor(sampleRate * durationSeconds)
  const dataSize = numSamples * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  view.setUint32(0, 0x52494646, false)
  view.setUint32(4, 36 + dataSize, true)
  view.setUint32(8, 0x57415645, false)
  view.setUint32(12, 0x666d7420, false)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  view.setUint32(36, 0x64617461, false)
  view.setUint32(40, dataSize, true)
  return new Uint8Array(buffer)
}

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
    chunkExtension: 'wav',
    startTime: Date.now(),
    abortSignal: options.abortSignal,
    chunkConcurrency: options.chunkConcurrency,
    chunkScheduler: options.chunkScheduler,
    requestEvidence: options.requestEvidence,
    fetchChunkAudio: async ({ chunk, chunkIndex, requestAttempt, retryReasonCode }) => {
      return await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'realtime-tts',
        serializerVersion: 'inworld.tts.phase-3-v1',
        serializedRequest: {
          path: '/v1/tts/synthesize',
          body: {
            text: chunk,
            voice,
            model: options.model,
            ...(options.steeringPrompt ? { steering_prompt: options.steeringPrompt } : {}),
            ...(markups.length > 0 ? { markups } : {})
          }
        },
        providerText: chunk,
        voiceField: 'voice',
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls: {
          format: 'wav',
          ...(options.steeringPrompt ? { steeringPrompt: options.steeringPrompt } : {}),
          ...(markups.length > 0 ? { markups } : {})
        },
        continuation: { kind: 'none' }
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async () => {
        if (!options.apiKey.trim()) {
          // Offline mock WAV generation for local testing
          const duration = Math.max(0.5, chunk.length * 0.05)
          return generateSimpleWavBuffer(duration)
        }
        const res = await fetch('https://api.inworld.ai/v1/tts/synthesize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.apiKey}`
          },
          body: JSON.stringify({
            text: chunk,
            voice,
            model: options.model,
            ...(options.steeringPrompt ? { steering_prompt: options.steeringPrompt } : {}),
            ...(markups.length > 0 ? { markups } : {})
          }),
          ...(options.abortSignal ? { signal: options.abortSignal } : {})
        })
        if (!res.ok) {
          throw new Error(`Inworld AI TTS request failed with status ${res.status}: ${await res.text()}`)
        }
        return new Uint8Array(await res.arrayBuffer())
      })
    }
  })
}
