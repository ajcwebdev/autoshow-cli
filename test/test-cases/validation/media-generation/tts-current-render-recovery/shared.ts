import { join } from 'node:path'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import type {
  CanonicalAudioProviderProjection,
  PipelineProviderState,
  RenderAdmissionJournalSnapshot,
  TtsOptions,
  TtsTarget
} from '~/types'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { ProviderError } from '~/utils/error-handler'
import { createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import { requireDefined } from '../../../../test-utils/value-assertions'

export const DIALOGUE_OPTIONS: TtsOptions = {
  ttsDialogueFormat: 'labeled',
  ttsSpeakers: ['Host=alloy', 'Guest=echo'],
  ttsChunkConcurrency: 1
}

export const syntheticRecoveryAudio = (
  sourceIndex = 0,
  durationSeconds = 0.1
): Uint8Array => createSyntheticWavBytes({
  durationSeconds,
  amplitude: 0.2,
  frequencyHz: sourceIndex === 0 ? 280 : 420
})

export const createFixtureTarget = (
  onRun: () => void,
  mode: 'success' | 'accepted-error'
): TtsTarget => {
  const operation = 'tts-synthesis' as const
  const transport = 'hosted-api'
  const model = 'fixture-recovery-model'
  return {
    service: 'openai',
    model,
    operation,
    transport,
    targetKey: canonicalTargetKey(operation, 'openai', model, transport),
    voice: 'alloy',
    run: async (text, outputDir, _options, _invocation, requestEvidence) => {
      onRun()
      const audioPath = join(outputDir, 'speech.wav')
      const bytes = syntheticRecoveryAudio(0, 0.15)
      await requestEvidence?.dispatch({
        chunkIndex: 1,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'openai.tts.phase-0-v1',
        serializedRequest: { body: { input: text, voice: 'alloy', response_format: 'wav' } },
        providerText: text,
        voiceField: 'voice',
        voices: [{ kind: 'provider-id', value: 'alloy' }],
        requestControls: { responseFormat: 'wav' },
        continuation: { kind: 'none' }
      }, { attempt: 1 }, async ({ accepted }) => {
        await accepted({ providerRequestId: 'local-recovery-fixture' })
        if (mode === 'accepted-error') throw new Error('fixture failed after provider acceptance')
        await Bun.write(audioPath, bytes)
      })
      if (!requestEvidence) await Bun.write(audioPath, bytes)
      await requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
      await requestEvidence?.complete({ chunkIndex: 1 })
      return {
        audioPath,
        metadata: {
          ttsService: 'openai',
          ttsModel: model,
          speaker: 'alloy',
          processingTime: 1,
          audioFileName: 'speech.wav',
          audioFileSize: bytes.byteLength,
          chunkCount: 1
        }
      }
    }
  }
}

export const createAuthorizedRetryFixtureTarget = (attempts: number[]): TtsTarget => {
  const operation = 'tts-synthesis' as const
  const transport = 'hosted-api'
  const model = 'fixture-authorized-retry-model'
  return {
    service: 'openai',
    model,
    operation,
    transport,
    targetKey: canonicalTargetKey(operation, 'openai', model, transport),
    voice: 'alloy',
    run: async (text, outputDir, options, _invocation, requestEvidence) => {
      if (!requestEvidence) throw new Error('Missing retry fixture request evidence')
      const audioPath = join(outputDir, 'speech.wav')
      const bytes = syntheticRecoveryAudio(0, 0.15)
      await withHostedTtsRetry({
        operationName: 'fixture-authorized-ambiguous-retry',
        allowAmbiguousRedispatch: options.ttsAllowAmbiguousRedispatch,
        policy: { maxAttempts: 4, baseDelayMs: 0, maxDelayMs: 0, jitter: false, exponential: false }
      }, async (_signal, requestAttempt) => await requestEvidence.dispatch({
        chunkIndex: 1,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'openai.tts.phase-0-v1',
        serializedRequest: { body: { input: text, voice: 'alloy', response_format: 'wav' } },
        providerText: text,
        voiceField: 'voice',
        voices: [{ kind: 'provider-id', value: 'alloy' }],
        requestControls: { responseFormat: 'wav' },
        continuation: { kind: 'none' }
      }, requestAttempt, async ({ accepted }) => {
        attempts.push(requestAttempt.attempt)
        await accepted({ providerRequestId: `authorized-retry-${requestAttempt.attempt}` })
        if (requestAttempt.attempt < 3) {
          throw ProviderError('fixture inference failed', { status: 500, retryable: true })
        }
        await Bun.write(audioPath, bytes)
      }))
      await requestEvidence.recordOutput({ chunkIndex: 1, path: audioPath })
      await requestEvidence.complete({ chunkIndex: 1 })
      return {
        audioPath,
        metadata: {
          ttsService: 'openai',
          ttsModel: model,
          speaker: 'alloy',
          processingTime: 1,
          audioFileName: 'speech.wav',
          audioFileSize: bytes.byteLength,
          chunkCount: 1
        }
      }
    }
  }
}

export const createDialogueFixtureTarget = (
  calls: number[],
  model = 'fixture-dialogue-recovery-model',
  acceptedErrorSourceIndex?: number
): TtsTarget => {
  const operation = 'tts-synthesis' as const
  const transport = 'hosted-api'
  return {
    service: 'openai',
    model,
    operation,
    transport,
    targetKey: canonicalTargetKey(operation, 'openai', model, transport),
    multiSpeakerStrategy: 'segment-and-concat',
    run: async (text, outputDir, _options, invocation, requestEvidence) => {
      const sourceIndex = invocation?.sourceIndex ?? -1
      const voice = invocation?.voice.value ?? 'alloy'
      const audioPath = join(outputDir, 'speech.wav')
      const bytes = syntheticRecoveryAudio(sourceIndex)
      calls.push(sourceIndex)
      await requestEvidence?.dispatch({
        chunkIndex: 1,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'openai.tts.phase-0-v1',
        serializedRequest: { body: { input: text, voice, response_format: 'wav' } },
        providerText: text,
        voiceField: 'voice',
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls: { responseFormat: 'wav' },
        continuation: { kind: 'none' }
      }, { attempt: 1 }, async ({ accepted }) => {
        await accepted({ providerRequestId: `dialogue-${sourceIndex}` })
        if (sourceIndex === acceptedErrorSourceIndex) throw new Error(`fixture failed after accepting source ${sourceIndex}`)
        await Bun.write(audioPath, bytes)
      })
      if (!requestEvidence) await Bun.write(audioPath, bytes)
      await requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
      await requestEvidence?.complete({ chunkIndex: 1 })
      return {
        audioPath,
        metadata: {
          ttsService: 'openai',
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

export const createRejectedDialogueFixtureTarget = (
  calls: number[],
  model = 'fixture-dialogue-recovery-model'
): TtsTarget => ({
  service: 'openai',
  model,
  operation: 'tts-synthesis',
  transport: 'hosted-api',
  targetKey: canonicalTargetKey('tts-synthesis', 'openai', model, 'hosted-api'),
  multiSpeakerStrategy: 'segment-and-concat',
  run: async (text, _outputDir, _options, invocation, requestEvidence) => {
    const sourceIndex = invocation?.sourceIndex ?? -1
    const voice = invocation?.voice.value ?? 'alloy'
    calls.push(sourceIndex)
    await requestEvidence?.dispatch({
      chunkIndex: 1,
      endpointKind: 'speech-synthesis',
      serializerVersion: 'openai.tts.phase-0-v1',
      serializedRequest: { body: { input: text, voice, response_format: 'wav' } },
      providerText: text,
      voiceField: 'voice',
      voices: [{ kind: 'provider-id', value: voice }],
      requestControls: { responseFormat: 'wav' },
      continuation: { kind: 'none' }
    }, { attempt: 1 }, async () => {
      const error = new Error('fixture provider rejected request')
      Object.defineProperty(error, 'status', { value: 400, configurable: true })
      throw error
    })
    throw new Error('fixture rejection unexpectedly returned')
  }
})

export const crashAfterPromotedResult = (state: PipelineProviderState): PipelineProviderState => {
  const projection = structuredClone(state.result?.['ttsAudio']) as CanonicalAudioProviderProjection
  const render = requireDefined(projection.renderHistory[0], 'recovery fixture render')
  const running = [...render.events].reverse().find((event) => event.status === 'running' && event.providerRenderResultRef === undefined)
  const promoted = [...render.events].reverse().find((event) => event.status === 'running' && event.admissionJournalRef)
  const selected = requireDefined(promoted ?? running, 'recovery fixture running event')
  render.events = render.events.filter((event) => event.sequence <= selected.sequence)
  projection.activeWork = { kind: 'render', renderIdentity: render.renderIdentity, eventSequence: selected.sequence }
  delete projection.selectedSuccess
  projection.pointerEvents = projection.pointerEvents.filter((event) =>
    event.action !== 'select-success'
    && (event.action !== 'activate-render' || event.renderIdentity !== render.renderIdentity || event.eventSequence <= selected.sequence))
  return {
    ...state,
    status: 'running',
    attempts: selected.attempt,
    metadata: { ...state.metadata, ttsAudio: projection },
    result: { ttsAudio: projection },
    error: undefined
  }
}

export const journalEventForState = (state: PipelineProviderState) => {
  const projection = state.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
  const pointer = projection?.activeWork?.kind === 'render' ? projection.activeWork : projection?.selectedSuccess
  if (!projection || !pointer) return undefined
  const render = projection.renderHistory.find((entry) => entry.renderIdentity === pointer.renderIdentity)
  return render?.events.find((entry) => entry.sequence === pointer.eventSequence)
}

export const latestJournalForState = async (
  rootDir: string,
  state: PipelineProviderState
): Promise<RenderAdmissionJournalSnapshot | undefined> => {
  const event = journalEventForState(state)
  if (!event?.admissionJournalRef) return undefined
  return await Bun.file(join(rootDir, state.artifactDir, event.admissionJournalRef)).json()
}
