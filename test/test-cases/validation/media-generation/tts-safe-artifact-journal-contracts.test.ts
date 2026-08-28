import { describe,expect,test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createCurrentTtsRenderAttempt } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { createInlineTtsSourceIdentity,createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import type { CanonicalAudioProviderProjection,PipelineProviderState,TtsSerializedRequestObservation,TtsTarget } from '~/types'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { requireDefined } from '../../../test-utils/value-assertions'

const FIXED_TIME = new Date(0).toISOString()
const MODEL = 'gpt-4o-mini-tts-2025-12-15'

const createOpenAiFixture = (onRun: () => void = () => {}): TtsTarget => ({
  service: 'openai',
  model: MODEL,
  voice: 'alloy',
  operation: 'tts-synthesis',
  transport: 'hosted-api',
  targetKey: canonicalTargetKey('tts-synthesis', 'openai', MODEL, 'hosted-api'),
  run: async () => {
    onRun()
    throw new Error('Safe-artifact lifecycle fixture must not invoke the target runner.')
  }
})

const sourceContextFor = (text: string) => {
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  return {
    sourceIdentity,
    dialoguePlan: createSingleTurnTtsDialoguePlan(sourceIdentity, text, FIXED_TIME)
  }
}

const observationFor = (text: string): TtsSerializedRequestObservation => ({
  chunkIndex: 1,
  endpointKind: 'speech-synthesis',
  serializerVersion: 'openai.tts.phase-0-v1',
  serializedRequest: {
    body: {
      input: text,
      voice: 'alloy',
      response_format: 'wav'
    }
  },
  providerText: text,
  voiceField: 'voice',
  voices: [{ kind: 'provider-id', value: 'alloy' }],
  requestControls: { responseFormat: 'wav' },
  continuation: { kind: 'none' }
})

const projectionFor = (state: PipelineProviderState): CanonicalAudioProviderProjection =>
  state.result?.['ttsAudio'] as CanonicalAudioProviderProjection

const attemptsDirectoryFor = (outputDir: string, state: PipelineProviderState): string => {
  const render = requireDefined(projectionFor(state).renderHistory[0], 'prepared render fixture')
  return join(outputDir, state.artifactDir, render.renderDir, 'attempts')
}

describe('safe artifact integration in the TTS lifecycle', () => {

  test('a durable dispatch-started journal keeps ordinal ownership when publication fails', async () => {
    await withTempDir('autoshow-tts-dispatch-started-claim-lifecycle-', async (outputDir) => {
      const text = 'Dispatch-started evidence keeps its exclusive claim.'
      const target = createOpenAiFixture()
      const sourceContext = sourceContextFor(text)
      let runningPublications = 0
      const interrupted = await createCurrentTtsRenderAttempt({
        outputDir,
        target,
        sourceText: text,
        ttsOptions: {},
        ...sourceContext,
        now: () => FIXED_TIME,
        onProviderState: async (state) => {
          if (state.status !== 'running') return
          runningPublications += 1
          if (runningPublications === 2) {
            throw new Error('fixture callback failure after dispatch-started commit')
          }
        }
      })
      let interruptedOperations = 0
      await expect(interrupted.requestEvidence.dispatch(
        observationFor(text),
        { attempt: 1 },
        async () => { interruptedOperations += 1 }
      )).rejects.toThrow('fixture callback failure after dispatch-started commit')
      expect(interruptedOperations).toBe(0)

      const retry = await createCurrentTtsRenderAttempt({
        outputDir,
        target,
        sourceText: text,
        ttsOptions: {},
        ...sourceContext,
        priorAttemptCount: 0,
        now: () => FIXED_TIME
      })
      let retryOperations = 0
      await expect(retry.requestEvidence.dispatch(
        observationFor(text),
        { attempt: 1 },
        async () => { retryOperations += 1 }
      )).rejects.toThrow(/already reserved/i)

      expect(retryOperations).toBe(0)
      const attemptDirectories = (await readdir(attemptsDirectoryFor(outputDir, retry.preparedState)))
        .filter((name) => name.startsWith('attempt-'))
      expect(attemptDirectories).toHaveLength(1)
      expect(attemptDirectories[0]).toMatch(/^attempt-001-invocation-/)
    })
  })
})
