import { describe, expect, test } from 'bun:test'
import { mkdir, readFile, readdir, symlink, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { appendCurrentTtsProviderState, buildCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { createCurrentTtsRenderAttempt } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { createInlineTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import type { CanonicalAudioProviderProjection, PipelineProviderState, ProviderBatchResult, RenderAdmissionJournalSnapshot, TtsSerializedRequestObservation, TtsTarget } from '~/types'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { withTempDir } from '../../../test-utils/temp-dirs'

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

const crashAfterPromotedResult = (state: PipelineProviderState): PipelineProviderState => {
  const projection = structuredClone(projectionFor(state))
  const render = projection.renderHistory[0]
  if (!render) throw new Error('Missing completed safe-artifact fixture render')
  const selectedRunning = [...render.events].reverse().find((event) =>
    event.status === 'running' && event.admissionJournalRef !== undefined)
  if (!selectedRunning) throw new Error('Missing retained running event with promoted result evidence')
  render.events = render.events.filter((event) => event.sequence <= selectedRunning.sequence)
  projection.activeWork = {
    kind: 'render',
    renderIdentity: render.renderIdentity,
    eventSequence: selectedRunning.sequence
  }
  delete projection.selectedSuccess
  projection.pointerEvents = projection.pointerEvents.filter((event) =>
    event.action !== 'select-success'
    && (event.action !== 'activate-render'
      || event.renderIdentity !== render.renderIdentity
      || event.eventSequence <= selectedRunning.sequence))
  return {
    ...state,
    status: 'running',
    attempts: selectedRunning.attempt,
    metadata: { ...state.metadata, ttsAudio: projection },
    result: { ttsAudio: projection },
    error: undefined
  }
}

const createSuccessfulOpenAiFixture = (onRun: () => void): TtsTarget => ({
  service: 'openai',
  model: MODEL,
  voice: 'alloy',
  operation: 'tts-synthesis',
  transport: 'hosted-api',
  targetKey: canonicalTargetKey('tts-synthesis', 'openai', MODEL, 'hosted-api'),
  run: async (text, outputDir, _options, _invocation, requestEvidence) => {
    onRun()
    const audioPath = join(outputDir, 'speech.wav')
    const bytes = createSyntheticWavBytes({ durationSeconds: 0.1, amplitude: 0.2, frequencyHz: 330 })
    if (!requestEvidence) throw new Error('Missing request evidence for successful safe-artifact fixture')
    await requestEvidence.dispatch(observationFor(text), { attempt: 1 }, async ({ accepted }) => {
      await accepted({ providerRequestId: 'safe-artifact-local-fixture' })
      await Bun.write(audioPath, bytes)
    })
    await requestEvidence.recordOutput({ chunkIndex: 1, path: audioPath })
    await requestEvidence.complete({ chunkIndex: 1 })
    return {
      audioPath,
      metadata: {
        ttsService: 'openai',
        ttsModel: MODEL,
        speaker: 'alloy',
        processingTime: 1,
        audioFileName: 'speech.wav',
        audioFileSize: bytes.byteLength,
        chunkCount: 1
      }
    }
  }
})

const retainedBatchAndAudioPaths = async (
  rootDir: string,
  state: PipelineProviderState
): Promise<{ batchResultPath: string, audioPath: string }> => {
  const projection = projectionFor(state)
  const active = projection.activeWork
  if (active?.kind !== 'render') throw new Error('Missing retained render pointer')
  const render = projection.renderHistory.find((entry) => entry.renderIdentity === active.renderIdentity)
  const event = render?.events.find((entry) => entry.sequence === active.eventSequence)
  if (!event?.admissionJournalRef) throw new Error('Missing retained admission journal reference')
  const journalPath = join(rootDir, state.artifactDir, event.admissionJournalRef)
  const journal = JSON.parse(await readFile(journalPath, 'utf8')) as RenderAdmissionJournalSnapshot
  const batchReference = journal.recordedBatchResults[0]
  if (!batchReference) throw new Error('Missing retained provider batch result reference')
  const batchResultPath = join(dirname(journalPath), batchReference.batchResultRef)
  const batchResult = JSON.parse(await readFile(batchResultPath, 'utf8')) as ProviderBatchResult
  const output = batchResult.outputs[0]
  if (!output) throw new Error('Missing retained provider batch audio reference')
  return {
    batchResultPath,
    audioPath: join(dirname(batchResultPath), output.artifactRef)
  }
}

const attemptsDirectoryFor = (outputDir: string, state: PipelineProviderState): string => {
  const render = projectionFor(state).renderHistory[0]
  if (!render) throw new Error('Missing prepared render fixture')
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
  test('render preparation rejects a preexisting symbolic-link ancestor before outside writes or target calls', async () => {
    await withTempDir('autoshow-tts-render-link-lifecycle-', async (dir) => {
      const outputDir = join(dir, 'run')
      const outside = join(dir, 'outside-render')
      const text = 'Do not follow a render directory link.'
      let targetCalls = 0
      const target = createOpenAiFixture(() => { targetCalls += 1 })
      const targetDir = join(outputDir, 'providers', target.targetKey as string)
      await mkdir(targetDir, { recursive: true })
      await mkdir(outside)
      await symlink(outside, join(targetDir, 'renders'))

      await withOpenAiCredential(async () => {
        await expect(runTtsForTargets(
          text,
          outputDir,
          {},
          [target],
          sourceContextFor(text)
        )).rejects.toThrow(/symbolic link/i)
      })

      expect(targetCalls).toBe(0)
      expect(await readdir(outside)).toEqual([])
    })
  })

  test('branch-only readiness rejects a preexisting symbolic-link ancestor before outside writes or target calls', async () => {
    await withTempDir('autoshow-tts-branch-link-lifecycle-', async (dir) => {
      const outputDir = join(dir, 'run')
      const outside = join(dir, 'outside-branch')
      const text = 'Do not follow a branch directory link.'
      let targetCalls = 0
      const target = createOpenAiFixture(() => { targetCalls += 1 })
      const targetDir = join(outputDir, 'providers', target.targetKey as string)
      await mkdir(targetDir, { recursive: true })
      await mkdir(outside)
      await symlink(outside, join(targetDir, 'branches'))
      const sourceContext = sourceContextFor(text)

      await expect(runTtsForTargets(text, outputDir, {}, [target], {
        ...sourceContext,
        executionReadiness: [{
          targetKey: target.targetKey as string,
          accountState: 'not-configured',
          status: 'blocked',
          error: {
            phase: 'readiness',
            code: 'provider-credential-not-configured',
            message: 'Fixture readiness blocks synthesis.',
            retryable: false,
            blockedReason: 'provider-credential-not-configured'
          }
        }]
      })).rejects.toThrow(/symbolic link/i)

      expect(targetCalls).toBe(0)
      expect(await readdir(outside)).toEqual([])
    })
  })

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
      const winner = successes[0]?.value
      if (!winner) throw new Error('Missing winning same-render dispatch contender')
      expect(operations).toEqual([winner])
      const attemptsDirectory = attemptsDirectoryFor(outputDir, first.preparedState)
      const attemptDirectories = (await readdir(attemptsDirectory)).filter((name) => name.startsWith('attempt-'))
      expect(attemptDirectories).toHaveLength(1)
      expect(attemptDirectories[0]).toMatch(/^attempt-001-invocation-/)
      const evidenceFiles = await readdir(join(attemptsDirectory, attemptDirectories[0] as string), { recursive: true })
      const acceptanceRef = evidenceFiles.find((path) => path.endsWith('-acceptance.json'))
      if (!acceptanceRef) throw new Error('Missing winning immutable acceptance evidence')
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
      const retainedRender = retainedProjection.renderHistory.find((entry) => entry.renderIdentity === retainedActive.renderIdentity)
      const retainedEvent = retainedRender?.events.find((entry) => entry.sequence === retainedActive.eventSequence)
      if (!retainedEvent?.admissionJournalRef) throw new Error('Missing retained prepared journal reference')
      const retainedJournal = JSON.parse(await readFile(
        join(outputDir, retainedPreparedState.artifactDir, retainedEvent.admissionJournalRef),
        'utf8'
      )) as { invocationId?: string }
      if (!retainedJournal.invocationId) throw new Error('Missing retained prepared invocation identity')
      const attemptsDirectory = attemptsDirectoryFor(outputDir, retainedPreparedState)
      const staleClaim = join(attemptsDirectory, '.attempt-001.claim')
      const staleToken = '00000000-0000-4000-8000-000000000001'
      await mkdir(staleClaim)
      await writeFile(
        join(staleClaim, `owner-${staleToken}.lock`),
        `${retainedJournal.invocationId}\n${staleToken}\n`
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

  test('provider response text is excluded from retained evidence and the scheduler-facing failure', async () => {
    await withTempDir('autoshow-tts-provider-error-sanitization-', async (dir) => {
      const outputDir = join(dir, 'run')
      const text = 'Retain only a status-safe provider failure.'
      const canary = 'short-provider-body-canary@example.invalid'
      const sourceContext = sourceContextFor(text)
      const observedStates: PipelineProviderState[] = []
      const target: TtsTarget = {
        ...createOpenAiFixture(),
        run: async (sourceText, _workspaceDir, _options, _invocation, requestEvidence) => {
          if (!requestEvidence) throw new Error('Missing request evidence for provider-error sanitization fixture')
          return await requestEvidence.dispatch(
            observationFor(sourceText),
            { attempt: 1 },
            async () => {
              const providerError = new Error(`Provider response body: ${canary}`)
              Object.defineProperty(providerError, 'status', { value: 400, configurable: true })
              throw providerError
            }
          )
        }
      }
      await mkdir(outputDir)

      let schedulerError: unknown
      await withOpenAiCredential(async () => {
        try {
          await runTtsForTargets(text, outputDir, {}, [target], {
            ...sourceContext,
            onProviderState: async (state) => { observedStates.push(structuredClone(state)) }
          })
        } catch (error) {
          schedulerError = error
        }
      })

      expect(schedulerError).toBeInstanceOf(Error)
      const schedulerMessage = schedulerError instanceof Error ? schedulerError.message : String(schedulerError)
      expect(schedulerMessage).toContain('HTTP status 400')
      expect(schedulerMessage).not.toContain(canary)

      const failedState = observedStates.at(-1)
      if (!failedState) throw new Error('Missing retained provider-error state')
      expect(failedState.status).toBe('failed')
      expect(failedState.error?.['code']).toBe('http_400')
      expect(failedState.error?.['message']).toBe('TTS provider request failed with HTTP status 400.')
      expect(JSON.stringify(observedStates)).not.toContain(canary)

      const artifactNames = (await readdir(outputDir, { recursive: true }))
        .filter((name) => name.endsWith('.json'))
      expect(artifactNames.length).toBeGreaterThan(0)
      const retainedJson = await Promise.all(artifactNames.map(async (name) => ({
        name,
        text: await readFile(join(outputDir, name), 'utf8')
      })))
      expect(retainedJson.map((artifact) => artifact.text).join('\n')).not.toContain(canary)
      const rejectionArtifact = retainedJson.find((artifact) => artifact.name.endsWith('-rejection.json'))
      if (!rejectionArtifact) throw new Error('Missing sanitized provider rejection evidence')
      const rejection = JSON.parse(rejectionArtifact.text) as { fields?: { code?: string, retryable?: boolean } }
      expect(rejection.fields).toEqual({ code: 'http_400', retryable: false })
    })
  })

  test('completed recovery rejects retained batch-result and audio symbolic-link substitutions before another provider call', async () => {
    for (const substitutedArtifact of ['batch-result', 'audio'] as const) {
      await withTempDir(`autoshow-tts-retained-${substitutedArtifact}-link-`, async (dir) => {
        const outputDir = join(dir, 'run')
        const text = `Reject the retained ${substitutedArtifact} symbolic link.`
        const sourceContext = sourceContextFor(text)
        let providerCalls = 0
        const target = createSuccessfulOpenAiFixture(() => { providerCalls += 1 })
        await mkdir(outputDir)
        const first = await withOpenAiCredential(async () => await runTtsForTargets(
          text,
          outputDir,
          {},
          [target],
          sourceContext
        ))
        const retained = crashAfterPromotedResult(buildCurrentTtsProviderState(first.metadata[0]!))
        const paths = await retainedBatchAndAudioPaths(outputDir, retained)
        const substitutedPath = substitutedArtifact === 'batch-result' ? paths.batchResultPath : paths.audioPath
        const originalBytes = await readFile(substitutedPath)
        const outsidePath = join(dir, `${substitutedArtifact}-outside`)
        await writeFile(outsidePath, originalBytes)
        await unlink(substitutedPath)
        await symlink(outsidePath, substitutedPath)
        const callsBeforeRecovery = providerCalls

        await withOpenAiCredential(async () => {
          await expect(runTtsForTargets(text, outputDir, {}, [target], {
            ...sourceContext,
            retainedProviderStates: [retained],
            recoveryRootDir: outputDir,
            resolveReportedOutput: () => ({
              path: join(outputDir, `recovered-${substitutedArtifact}.wav`),
              fileName: `recovered-${substitutedArtifact}.wav`
            })
          })).rejects.toThrow(/symbolic link|non-symlink|contained regular artifact/i)
        })

        expect(providerCalls).toBe(callsBeforeRecovery)
      })
    }
  })
})
