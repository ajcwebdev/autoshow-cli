import { describe,expect,test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createManifest,createManifestItem,PIPELINE_MANIFEST_FILE,readManifest,updateManifest,writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { createFileTtsSourceIdentity,createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact,materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { priceGenerationTarget,resumeGenerationTarget } from '~/cli/commands/setup-and-utilities/resume/generation-resume'
import { ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import type { CanonicalAudioProviderProjection,PipelineProviderState,Step4Metadata,TtsOptions } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { canonicalFileInput,findRecoverableCompletedState,materializeFailedProviderState,resumeTarget,successfulTarget,ttsTarget } from './tts-resume-fixtures'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { appendCurrentTtsProviderState, getCurrentTtsJournalAttemptKey } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { createCurrentTtsRenderAttempt, resolveCurrentTtsPriorAdmittedAttemptCount } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'

describe('canonical TTS resume', () => {

  test('retains the admitted attempt count while a resumed preparation is active', async () => {
    await withTempDir('autoshow-tts-resume-prepared-attempt-count-', async (dir) => {
      const text = 'Prepared resume state keeps the prior admitted attempt ordinal.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = { ...ttsTarget(), voice: 'alloy' }
      const failed = await materializeFailedProviderState({
        rootDir: dir,
        target,
        text,
        sourceIdentity,
        dialoguePlan,
        admitted: true
      })
      const prepared = await createCurrentTtsRenderAttempt({
        outputDir: dir,
        target,
        sourceText: text,
        ttsOptions: {},
        sourceIdentity,
        dialoguePlan,
        priorAttemptCount: 1
      })
      const merged = appendCurrentTtsProviderState(failed, prepared.preparedState)

      expect(merged.attempts).toBe(0)
      expect(await resolveCurrentTtsPriorAdmittedAttemptCount({ rootDir: dir, state: merged })).toBe(1)

      const projection = merged.result?.['ttsAudio'] as CanonicalAudioProviderProjection
      const active = projection.activeWork
      if (active?.kind !== 'render') throw new Error('Missing active render for retained attempt fixture')
      const render = projection.renderHistory.find((entry) => entry.renderIdentity === active.renderIdentity)
      if (!render) throw new Error('Missing render history for retained attempt fixture')
      await mkdir(join(
        dir,
        merged.artifactDir,
        render.renderDir,
        'attempts',
        'attempt-002-invocation-interrupted-before-manifest-commit'
      ), { recursive: true })
      expect(await resolveCurrentTtsPriorAdmittedAttemptCount({ rootDir: dir, state: merged })).toBe(2)
    })
  })

  test('recovers a completed promoted result without a second provider call', async () => {
    await withTempDir('autoshow-tts-resume-recovery-', async (dir) => {
      const text = 'Recover these already promoted provider bytes.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = { ...ttsTarget(), voice: 'alloy' }
      const snapshots: PipelineProviderState[] = []
      const dialoguePlanArtifact = await materializeTtsDialoguePlanArtifact(dir, dialoguePlan)
      let initialProviderCalls = 0
      await runTtsForTargets(text, dir, {}, [successfulTarget(target, () => { initialProviderCalls += 1 })], {
        sourceIdentity,
        dialoguePlan,
        onProviderState: async (state) => {
          snapshots.push(structuredClone(bindTtsDialoguePlanArtifact(state, dialoguePlanArtifact)))
        }
      })
      expect(initialProviderCalls).toBe(1)
      const retained = await findRecoverableCompletedState(dir, snapshots)
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: canonicalFileInput(sourceIdentity),
        status: retained.status === 'failed' ? 'failed' : 'incomplete',
        metadata: { tts: [] },
        providers: [retained]
      })]))
      expect(await readManifest(dir)).toBeDefined()
      let resumedProviderCalls = 0
      const candidate = successfulTarget(target, () => { resumedProviderCalls += 1 })
      const beforePrice = await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()
      const recoveryEstimate = await priceGenerationTarget(
        resumeTarget(dir),
        { ...ttsResumeConfig, collectTargets: () => [candidate] },
        {} as TtsOptions
      )
      expect(recoveryEstimate.totalEstimatedCost).toBe(0)
      expect(resumedProviderCalls).toBe(0)
      expect(await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()).toBe(beforePrice)

      await resumeGenerationTarget(
        resumeTarget(dir),
        { ...ttsResumeConfig, collectTargets: () => [candidate] },
        {} as TtsOptions
      )

      const manifest = await readManifest(dir)
      expect(resumedProviderCalls).toBe(0)
      expect(manifest?.items[0]?.status).toBe('full')
      expect(manifest?.items[0]?.providers[0]?.status).toBe('succeeded')
      const metadata = manifest?.items[0]?.metadata['tts'] as Step4Metadata[]
      expect(metadata[0]?.audioFileName).toContain('-resume-')
      expect(await Bun.file(join(dir, metadata[0]?.audioFileName as string)).exists()).toBe(true)
    })
  })

  test('resumes only unresolved chunks in a partial single-speaker render', async () => {
    await withTempDir('autoshow-tts-resume-partial-single-speaker-', async (dir) => {
      const text = 'A sufficiently long recovery sentence. '.repeat(160)
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = { ...ttsTarget(), voice: 'alloy' }
      const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.openai)
      expect(chunks.length).toBeGreaterThan(2)
      const bytes = createSyntheticWavBytes({ durationSeconds: 0.05, amplitude: 0.2, frequencyHz: 440 })
      const interruptedStates: PipelineProviderState[] = []
      const interruptedTarget = {
        ...target,
        run: async (_text: string, outputDir: string, _opts: TtsOptions, _invocation: Parameters<typeof target.run>[3], requestEvidence: Parameters<typeof target.run>[4]) => {
          if (!requestEvidence) throw new Error('Missing partial recovery request evidence')
          const completedPaths: string[] = []
          for (const [index, chunk] of chunks.entries()) {
            const chunkIndex = index + 1
            const audioPath = join(outputDir, `chunk-${String(chunkIndex).padStart(3, '0')}.wav`)
            await requestEvidence.dispatch({
              chunkIndex,
              endpointKind: 'speech-synthesis',
              serializerVersion: 'openai.tts.phase-0-v1',
              serializedRequest: { text: chunk, voice: 'alloy' },
              providerText: chunk,
              voiceField: 'voice',
              voices: [{ kind: 'provider-id', value: 'alloy' }],
              requestControls: { responseFormat: 'wav' },
              continuation: { kind: 'none' }
            }, { attempt: 1 }, async ({ accepted }) => {
              await accepted({ providerRequestId: `partial-fixture-${chunkIndex}` })
              if (index === 1) throw new Error('fixture interruption after one completed chunk')
              await Bun.write(audioPath, bytes)
            })
            await requestEvidence.recordOutput({ chunkIndex, path: audioPath })
            await requestEvidence.complete({ chunkIndex })
            completedPaths.push(audioPath)
          }
          throw new Error(`fixture unexpectedly completed ${completedPaths.length} chunks`)
        }
      }

      await expect(runTtsForTargets(text, dir, {}, [interruptedTarget], {
        sourceIdentity,
        dialoguePlan,
        onProviderState: async (state) => { interruptedStates.push(structuredClone(state)) }
      })).rejects.toThrow()
      const retained = interruptedStates.find((state) => getCurrentTtsJournalAttemptKey(state) !== undefined)
      if (!retained || retained.status !== 'running') throw new Error('Missing first journal-backed partial recovery fixture state')
      const retainedWithDialogue = bindTtsDialoguePlanArtifact(
        retained,
        await materializeTtsDialoguePlanArtifact(dir, dialoguePlan)
      )
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: canonicalFileInput(sourceIdentity),
        status: 'incomplete',
        metadata: { tts: [] },
        providers: [retainedWithDialogue]
      })]))

      let resumedProviderCalls = 0
      let manifestCommits = 0
      const candidate = successfulTarget(target, () => { resumedProviderCalls += 1 })
      const metadata = await ttsResumeConfig.runMissingTargets(
        [candidate],
        text,
        dir,
        { ttsAllowAmbiguousRedispatch: true },
        {
          outputDir: dir,
          runtimeOptions: { ttsAllowAmbiguousRedispatch: true },
          targets: [candidate],
          existingEntries: [],
          currentManifestMetadata: {},
          currentProviderStates: [retainedWithDialogue],
          manifestUpdater: async (update) => {
            manifestCommits += 1
            return await updateManifest(dir, update)
          }
        }
      )

      expect(metadata).toHaveLength(1)
      expect(metadata[0]?.generationCheckpoint).toBeUndefined()
      expect(resumedProviderCalls).toBe(chunks.length - 1)
      expect(manifestCommits).toBe(3)
    })
  }, 10_000)
})
