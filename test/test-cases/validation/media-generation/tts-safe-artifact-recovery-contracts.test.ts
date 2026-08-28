import { describe,expect,test } from 'bun:test'
import { mkdir,readFile,symlink,writeFile } from 'node:fs/promises'
import { dirname,join } from 'node:path'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { buildCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { createInlineTtsSourceIdentity,createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import type { CanonicalAudioProviderProjection,PipelineProviderState,ProviderBatchResult,RenderAdmissionJournalSnapshot,TtsSerializedRequestObservation,TtsTarget } from '~/types'
import { unlinkPath as unlink } from '~/utils/bun-file-io'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { requireDefined } from '../../../test-utils/value-assertions'

const FIXED_TIME = new Date(0).toISOString()
const MODEL = 'gpt-4o-mini-tts-2025-12-15'

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
  const render = requireDefined(projection.renderHistory[0], 'completed safe-artifact fixture render')
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
  const batchReference = requireDefined(journal.recordedBatchResults[0], 'retained provider batch result reference')
  const batchResultPath = join(dirname(journalPath), batchReference.batchResultRef)
  const batchResult = JSON.parse(await readFile(batchResultPath, 'utf8')) as ProviderBatchResult
  const output = requireDefined(batchResult.outputs[0], 'retained provider batch audio reference')
  return {
    batchResultPath,
    audioPath: join(dirname(batchResultPath), output.artifactRef)
  }
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
