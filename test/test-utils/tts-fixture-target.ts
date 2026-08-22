import { join } from 'node:path'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import type { TtsFixtureTargetOptions, TtsTarget } from '~/types'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { ProviderError } from '~/utils/error-handler'
import { createSyntheticWavBytes } from './media-fixtures'

const DEFAULT_VOICE = 'alloy'

const defaultAudioBytes = (): Uint8Array =>
  createSyntheticWavBytes({ durationSeconds: 0.1, amplitude: 0.2, frequencyHz: 440 })

const rejectedRequestError = (): Error => {
  const error = new Error('fixture provider rejected request')
  Object.defineProperty(error, 'status', { value: 400, configurable: true })
  return error
}

export const createTtsFixtureTarget = (options: TtsFixtureTargetOptions): TtsTarget => {
  const service = options.service ?? 'openai'
  const transport = options.transport ?? 'hosted-api'
  const operation = 'tts-synthesis' as const
  const model = options.model
  const requestShape = options.requestShape ?? 'nested'
  const audioBytes = options.audioBytes ?? defaultAudioBytes
  const providerRequestId = options.providerRequestId ?? (() => 'local-contract-fixture')

  return {
    service,
    model,
    operation,
    transport,
    targetKey: canonicalTargetKey(operation, service, model, transport),
    ...(options.voice === undefined ? {} : { voice: options.voice }),
    ...(options.multiSpeakerStrategy === undefined ? {} : { multiSpeakerStrategy: options.multiSpeakerStrategy }),
    run: async (text, outputDir, _opts, invocation, requestEvidence) => {
      const sourceIndex = invocation?.sourceIndex ?? (options.multiSpeakerStrategy ? -1 : 0)
      const voice = invocation?.voice.value ?? options.voice ?? DEFAULT_VOICE
      options.onRun?.(sourceIndex)

      if (options.mode.kind === 'failBeforeDispatch') {
        throw new Error('fixture failure before provider dispatch')
      }

      const audioPath = join(outputDir, 'speech.wav')
      const bytes = audioBytes(sourceIndex)
      const evidence = {
        chunkIndex: 1,
        endpointKind: 'speech-synthesis' as const,
        serializerVersion: 'openai.tts.phase-0-v1',
        serializedRequest: requestShape === 'nested'
          ? { body: { input: text, voice, response_format: 'wav' } }
          : { text, voice },
        providerText: text,
        voiceField: 'voice',
        voices: [{ kind: 'provider-id' as const, value: voice }],
        requestControls: { responseFormat: 'wav' },
        continuation: { kind: 'none' as const }
      }

      if (options.mode.kind === 'ambiguousRetry') {
        const mode = options.mode
        if (!requestEvidence) throw new Error('Missing retry fixture request evidence')
        await withHostedTtsRetry({
          operationName: 'fixture-ambiguous-admission',
          policy: { maxAttempts: mode.maxAttempts, baseDelayMs: 0, maxDelayMs: 0, jitter: false, exponential: false }
        }, async (_signal, requestAttempt) => await requestEvidence.dispatch(
          evidence,
          requestAttempt,
          async ({ accepted }) => {
            mode.attempts.push(requestAttempt.attempt)
            await accepted({ providerRequestId: providerRequestId(sourceIndex, requestAttempt.attempt) })
            if (requestAttempt.attempt < mode.succeedOnAttempt) {
              throw ProviderError('fixture inference failed', { status: 500, retryable: true })
            }
            await Bun.write(audioPath, bytes)
          }
        ))
      } else {
        await requestEvidence?.dispatch(evidence, { attempt: 1 }, async ({ accepted }) => {
          if (options.mode.kind === 'reject') throw rejectedRequestError()
          await accepted({ providerRequestId: providerRequestId(sourceIndex, 1) })
          if (
            options.mode.kind === 'failAfterAdmission'
            && (options.mode.sourceIndex === undefined || options.mode.sourceIndex === sourceIndex)
          ) {
            throw new Error(options.mode.sourceIndex === undefined
              ? 'fixture failed after provider acceptance'
              : `fixture failed after accepting source ${sourceIndex}`)
          }
          await Bun.write(audioPath, bytes)
        })
        if (options.mode.kind === 'reject') throw new Error('fixture rejection unexpectedly returned')
        if (!requestEvidence) await Bun.write(audioPath, bytes)
      }

      await requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
      await requestEvidence?.complete({ chunkIndex: 1 })
      return {
        audioPath,
        metadata: {
          ttsService: service,
          ttsModel: model,
          speaker: voice,
          processingTime: 1,
          audioFileName: 'speech.wav',
          audioFileSize: bytes.byteLength,
          chunkCount: 1
        }
      }
    }
  }
}
