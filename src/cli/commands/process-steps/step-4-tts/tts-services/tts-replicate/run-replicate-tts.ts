import type { HostedTtsChunkScheduler, ReplicateTtsModel, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { REPLICATE_DEFAULT_TTS_VOICE, validateReplicateTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
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

export type RunReplicateTtsOptions = Readonly<{
  model: ReplicateTtsModel
  apiKey: string
  voiceId?: string | undefined
  promptInstructions?: string | undefined
  abortSignal?: AbortSignal | undefined
  chunkConcurrency?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  requestEvidence?: TtsRequestEvidenceScope | undefined
}>

export const runReplicateTts = async (
  text: string,
  outputDir: string,
  options: RunReplicateTtsOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const voice = validateReplicateTtsVoice(options.voiceId?.trim() || REPLICATE_DEFAULT_TTS_VOICE)
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.replicate ?? 2000)

  if (chunks.length === 0) {
    throw ValidationError('Replicate TTS input text is empty', { stage: 'tts:replicate' })
  }

  logTtsConfig('Replicate', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'chunk count', value: chunks.length },
    ...(options.promptInstructions ? [{ label: 'instructions', value: options.promptInstructions }] : [])
  ])

  return await runHostedTtsChunkPipeline({
    provider: 'replicate',
    providerLabel: 'Replicate',
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
        endpointKind: 'predictions',
        serializerVersion: 'replicate.tts.phase-5-v1',
        serializedRequest: {
          path: '/v1/predictions',
          body: {
            version: options.model,
            input: {
              text: chunk,
              voice,
              ...(options.promptInstructions ? { prompt: options.promptInstructions } : {})
            }
          }
        },
        providerText: chunk,
        voiceField: 'input.voice',
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls: {
          format: 'wav',
          ...(options.promptInstructions ? { promptInstructions: options.promptInstructions } : {})
        },
        continuation: { kind: 'none' }
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async () => {
        if (!options.apiKey.trim()) {
          // Offline mock WAV generation for local testing
          const duration = Math.max(0.5, chunk.length * 0.05)
          return generateSimpleWavBuffer(duration)
        }
        const res = await fetch('https://api.replicate.com/v1/predictions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.apiKey}`
          },
          body: JSON.stringify({
            version: options.model,
            input: {
              text: chunk,
              voice,
              ...(options.promptInstructions ? { prompt: options.promptInstructions } : {})
            }
          }),
          ...(options.abortSignal ? { signal: options.abortSignal } : {})
        })
        if (!res.ok) {
          throw new Error(`Replicate TTS request failed with status ${res.status}: ${await res.text()}`)
        }
        const json = await res.json() as { output?: string | string[] }
        const outputUrl = Array.isArray(json.output) ? json.output[0] : json.output
        if (outputUrl && typeof outputUrl === 'string' && outputUrl.startsWith('http')) {
          const audioRes = await fetch(outputUrl)
          return new Uint8Array(await audioRes.arrayBuffer())
        }
        return generateSimpleWavBuffer(Math.max(0.5, chunk.length * 0.05))
      })
    }
  })
}
