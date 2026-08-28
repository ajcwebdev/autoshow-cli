import { describe,expect,test } from 'bun:test'
import { mkdir,readFile,readdir,writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { appendCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
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

const withOpenAiCredential = async <T>(operation: () => Promise<T>): Promise<T> => {
  const previous = process.env['OPENAI_API_KEY']
  process.env['OPENAI_API_KEY'] = 'safe-artifact-local-fixture'
  try {
    return await operation()
  } finally {
    if (previous === undefined) delete process.env['OPENAI_API_KEY']
    else process.env['OPENAI_API_KEY'] = previous
  }
}

describe('safe artifact integration in the TTS lifecycle', () => {

  test('two concurrent preparations race one render attempt without executing or overwriting a second operation', async () => {
    await withTempDir('autoshow-tts-attempt-race-lifecycle-', async (outputDir) => {
      const text = 'Only one contender may cross first dispatch.'
      const target = createOpenAiFixture()
      const sourceContext = sourceContextFor(text)
      const options = {
        outputDir,
        target,
        sourceText: text,
        ttsOptions: {},
        ...sourceContext,
        now: () => FIXED_TIME
      } as const
      const [first, second] = await Promise.all([
        createCurrentTtsRenderAttempt(options),
        createCurrentTtsRenderAttempt(options)
      ])
      const operations: string[] = []
      const dispatch = async (
        attempt: Awaited<ReturnType<typeof createCurrentTtsRenderAttempt>>,
        contender: string
      ): Promise<string> => await attempt.requestEvidence.dispatch(
        observationFor(text),
        { attempt: 1 },
        async ({ accepted }) => {
          operations.push(contender)
          await accepted({ fields: { contender } })
          return contender
        }
      )

      const outcomes = await Promise.allSettled([
        dispatch(first, 'first'),
        dispatch(second, 'second')
      ])
      const successes = outcomes.filter((outcome): outcome is PromiseFulfilledResult<string> => outcome.status === 'fulfilled')

      expect(successes).toHaveLength(1)
      const winner = requireDefined(successes[0]?.value, 'winning same-render dispatch contender')
      expect(operations).toEqual([winner])
      const attemptsDirectory = attemptsDirectoryFor(outputDir, first.preparedState)
      const attemptDirectories = (await readdir(attemptsDirectory)).filter((name) => name.startsWith('attempt-'))
      expect(attemptDirectories).toHaveLength(1)
      expect(attemptDirectories[0]).toMatch(/^attempt-001-invocation-/)
      const evidenceFiles = await readdir(join(attemptsDirectory, attemptDirectories[0] as string), { recursive: true })
      const acceptanceRef = requireDefined(evidenceFiles.find((path) => path.endsWith('-acceptance.json')), 'winning immutable acceptance evidence')
      const acceptance = JSON.parse(await readFile(
        join(attemptsDirectory, attemptDirectories[0] as string, acceptanceRef),
        'utf8'
      )) as { fields?: { contender?: string } }
      expect(acceptance.fields?.contender).toBe(winner)
    })
  })

  test('a zero-request failure after attempt one preserves the canonical provider-attempt count', async () => {
    await withTempDir('autoshow-tts-zero-request-count-lifecycle-', async (outputDir) => {
      const text = 'Retain the prior provider attempt count.'
      const target = createOpenAiFixture()
      const sourceContext = sourceContextFor(text)
      const first = await createCurrentTtsRenderAttempt({
        outputDir,
        target,
        sourceText: text,
        ttsOptions: {},
        ...sourceContext,
        now: () => FIXED_TIME
      })
      await expect(first.requestEvidence.dispatch(
        observationFor(text),
        { attempt: 1 },
        async ({ accepted }) => {
          await accepted({ fields: { fixture: 'accepted-before-failure' } })
          throw new Error('fixture failure after provider acceptance')
        }
      )).rejects.toThrow('fixture failure after provider acceptance')
      const firstState = await first.finalizeFailure(new Error('first provider attempt failed'))
      expect(firstState.attempts).toBe(1)

      const localFailure = await createCurrentTtsRenderAttempt({
        outputDir,
        target,
        sourceText: text,
        ttsOptions: {},
        ...sourceContext,
        priorAttemptCount: firstState.attempts,
        now: () => FIXED_TIME
      })
      const localFailureState = await localFailure.finalizeFailure(new Error('local failure before dispatch'))
      const retained = appendCurrentTtsProviderState(firstState, localFailureState)

      expect(localFailureState.attempts).toBe(1)
      expect(retained.attempts).toBe(1)
      expect(retained.status).toBe('failed')
    })
  })

  test('a prepared-only orphan does not consume attempt one for the next real dispatch', async () => {
    await withTempDir('autoshow-tts-prepared-only-count-lifecycle-', async (outputDir) => {
      const text = 'Prepared-only evidence is not provider admission.'
      const target = createOpenAiFixture()
      const sourceContext = sourceContextFor(text)
      let injected = false
      const orphan = await createCurrentTtsRenderAttempt({
        outputDir,
        target,
        sourceText: text,
        ttsOptions: {},
        ...sourceContext,
        now: () => FIXED_TIME,
        onProviderState: async (state) => {
          if (!injected && state.status === 'running') {
            injected = true
            throw new Error('fixture crash after prepared journal publication')
          }
        }
      })
      let orphanOperations = 0
      await expect(orphan.requestEvidence.dispatch(
        observationFor(text),
        { attempt: 1 },
        async () => { orphanOperations += 1 }
      )).rejects.toThrow('fixture crash after prepared journal publication')
      expect(orphanOperations).toBe(0)

      const observedStates: PipelineProviderState[] = []
      const retry = await createCurrentTtsRenderAttempt({
        outputDir,
        target,
        sourceText: text,
        ttsOptions: {},
        ...sourceContext,
        priorAttemptCount: 0,
        now: () => FIXED_TIME,
        onProviderState: async (state) => { observedStates.push(state) }
      })
      let retryOperations = 0
      await retry.requestEvidence.dispatch(
        observationFor(text),
        { attempt: 1 },
        async ({ accepted }) => {
          retryOperations += 1
          await accepted({ fields: { fixture: 'real-attempt-one' } })
        }
      )

      expect(retryOperations).toBe(1)
      expect(observedStates.some((state) => state.status === 'running' && state.attempts === 1)).toBe(true)
      expect(observedStates.some((state) => state.attempts > 1)).toBe(false)
      const attemptDirectories = (await readdir(attemptsDirectoryFor(outputDir, retry.preparedState)))
        .filter((name) => name.startsWith('attempt-'))
      expect(attemptDirectories).toHaveLength(2)
      expect(attemptDirectories.every((name) => /^attempt-001-invocation-/.test(name))).toBe(true)
      expect(attemptDirectories.some((name) => name.startsWith('attempt-002'))).toBe(false)
    })
  })

  test('a canonically retained prepared-only state does not inflate the first real provider attempt', async () => {
    await withTempDir('autoshow-tts-retained-prepared-count-lifecycle-', async (outputDir) => {
      const text = 'Retained prepared work is still zero admitted attempts.'
      const sourceContext = sourceContextFor(text)
      const planningTarget = createOpenAiFixture()
      let retainedPreparedState: PipelineProviderState | undefined
      const interrupted = await createCurrentTtsRenderAttempt({
        outputDir,
        target: planningTarget,
        sourceText: text,
        ttsOptions: {},
        ...sourceContext,
        now: () => FIXED_TIME,
        onProviderState: async (state) => {
          if (state.status === 'running' && !retainedPreparedState) {
            retainedPreparedState = structuredClone(state)
            throw new Error('fixture crash after canonical prepared-state commit')
          }
        }
      })
      await expect(interrupted.requestEvidence.dispatch(
        observationFor(text),
        { attempt: 1 },
        async () => { throw new Error('operation must not start before the injected crash') }
      )).rejects.toThrow('fixture crash after canonical prepared-state commit')
      if (!retainedPreparedState) throw new Error('Missing retained prepared-only fixture state')
      expect(retainedPreparedState.attempts).toBe(1)
      const retainedProjection = projectionFor(retainedPreparedState)
      const retainedActive = retainedProjection.activeWork
      if (retainedActive?.kind !== 'render') throw new Error('Missing retained prepared render pointer')
      const journalPath = requireDefined(retainedActive.journalPath, 'retained prepared journal reference')
      const journalLines = (await readFile(join(outputDir, journalPath), 'utf8')).split('\n').filter((line) => line.length > 0)
      const retainedJournal = JSON.parse(journalLines.at(-1) ?? '{}') as { snapshot?: { invocationId?: string } }
      if (!retainedJournal.snapshot?.invocationId) throw new Error('Missing retained prepared invocation identity')
      const attemptsDirectory = attemptsDirectoryFor(outputDir, retainedPreparedState)
      const staleClaim = join(attemptsDirectory, '.attempt-001.claim')
      const staleToken = '00000000-0000-4000-8000-000000000001'
      await mkdir(staleClaim)
      await writeFile(
        join(staleClaim, `owner-${staleToken}.lock`),
        `${retainedJournal.snapshot.invocationId}\n${staleToken}\n`
      )

      let realOperations = 0
      const dispatchingTarget: TtsTarget = {
        ...planningTarget,
        run: async (sourceText, _workspaceDir, _options, _invocation, requestEvidence) => {
          if (!requestEvidence) throw new Error('Missing request evidence for retained prepared retry')
          await requestEvidence.dispatch(
            observationFor(sourceText),
            { attempt: 1 },
            async ({ accepted }) => {
              realOperations += 1
              await accepted({ fields: { fixture: 'first-real-provider-attempt' } })
              throw new Error('fixture stops after the first real provider admission')
            }
          )
          throw new Error('Retained prepared retry unexpectedly returned from dispatch')
        }
      }
      const observedStates: PipelineProviderState[] = []
      await withOpenAiCredential(async () => {
        await expect(runTtsForTargets(text, outputDir, {}, [dispatchingTarget], {
          ...sourceContext,
          retainedProviderStates: [retainedPreparedState as PipelineProviderState],
          recoveryRootDir: outputDir,
          onProviderState: async (state) => { observedStates.push(state) }
        })).rejects.toThrow()
      })

      expect(realOperations).toBe(1)
      expect(observedStates.some((state) => state.attempts > 1)).toBe(false)
      expect(observedStates.some((state) => state.attempts === 1)).toBe(true)
      const attemptDirectories = (await readdir(attemptsDirectory))
        .filter((name) => name.startsWith('attempt-'))
      expect(attemptDirectories).toHaveLength(2)
      expect(attemptDirectories.every((name) => /^attempt-001-invocation-/.test(name))).toBe(true)
      expect(attemptDirectories.some((name) => name.startsWith('attempt-002'))).toBe(false)
    })
  })
})
