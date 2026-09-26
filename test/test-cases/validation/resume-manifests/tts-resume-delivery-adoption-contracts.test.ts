import { setupTtsFixtureCredentials } from '../../../test-utils/tts-fixture-credentials'
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { createManifest, createManifestItem, updateManifest, writeManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { runTtsForTargets } from '~/cli/commands/audio/tts/run-tts'
import { createFileTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/audio/tts/script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/audio/tts/script-to-audio/item-dialogue-plan-artifact'
import { getCurrentTtsJournalAttemptKey } from '~/cli/commands/audio/tts/script-to-audio/current-render-artifacts'
import { ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import { resolveTtsDeliveryOptions } from '~/cli/options/option-resolution/tts-delivery-options'
import { inspectSoundscapeAudio } from '~/cli/commands/audio/tts/soundscape/soundscape-audio'
import { splitTextIntoChunks } from '~/cli/commands/audio/tts/tts-utils/audio-utils'
import { planTtsChunks } from '~/cli/commands/audio/tts/tts-utils/tts-chunk-planner'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/audio/tts/tts-utils/tts-chunking'
import type { PipelineProviderState, TtsOptions } from '~/types'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { canonicalFileInput, successfulTarget, ttsTarget } from './tts-resume-fixtures'

const TEXT = 'x'.repeat(120) + ' Dr. Morgan returns. '.repeat(320)

// An output directory from before delivery mastering: legacy chunking, no delivery profile, and
// one purchased chunk retained before the run was interrupted.
const createInterruptedLegacyRun = async (dir: string, replay: 'legacy-v0' | 'smart-v1' = 'legacy-v0') => {
  const inputPath = join(dir, 'source.txt')
  await Bun.write(inputPath, TEXT)
  const sourceIdentity = await createFileTtsSourceIdentity(inputPath, TEXT)
  const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, TEXT)
  const target = { ...ttsTarget(), voice: 'alloy' }
  const chunks = planTtsChunks(TEXT, TTS_CHUNK_CHARACTER_LIMITS.openai, { boundary: 'smart', replay }).map(chunk => chunk.text)
  const bytes = createSyntheticWavBytes({ durationSeconds: 0.05, amplitude: 0.2, frequencyHz: 440 })
  const states: PipelineProviderState[] = []
  const interruptedTarget = {
    ...target,
    run: async (_text: string, outputDir: string, _opts: TtsOptions, _invocation: Parameters<typeof target.run>[3], requestEvidence: Parameters<typeof target.run>[4]) => {
      if (!requestEvidence) throw new Error('Missing request evidence')
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
          await accepted({ providerRequestId: `legacy-fixture-${chunkIndex}` })
          if (index === 1) throw new Error('fixture interruption after one completed chunk')
          await Bun.write(audioPath, bytes)
        })
        await requestEvidence.recordOutput({ chunkIndex, path: audioPath })
        await requestEvidence.complete({ chunkIndex })
      }
      throw new Error('fixture unexpectedly completed')
    }
  }
  await expect(runTtsForTargets(TEXT, dir, { ttsChunking: { boundary: 'smart', replay } }, [interruptedTarget], {
    sourceIdentity,
    dialoguePlan,
    onProviderState: async (state) => { states.push(structuredClone(state)) }
  })).rejects.toThrow()
  const retained = states.find((state) => getCurrentTtsJournalAttemptKey(state) !== undefined)
  if (!retained) throw new Error('Missing journal-backed legacy fixture state')
  const retainedWithDialogue = bindTtsDialoguePlanArtifact(retained, await materializeTtsDialoguePlanArtifact(dir, dialoguePlan))
  await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
    input: canonicalFileInput(sourceIdentity),
    status: 'incomplete',
    metadata: { tts: [] },
    providers: [retainedWithDialogue]
  })]))
  return { target, chunks, retainedWithDialogue }
}

const resume = async (dir: string, fixture: Awaited<ReturnType<typeof createInterruptedLegacyRun>>, options: TtsOptions, onRun: () => void) => {
  const candidate = successfulTarget(fixture.target, onRun)
  return await ttsResumeConfig.runMissingTargets([candidate], TEXT, dir, options, {
    outputDir: dir,
    runtimeOptions: options,
    targets: [candidate],
    existingEntries: [],
    currentManifestMetadata: {},
    currentProviderStates: [fixture.retainedWithDialogue],
    manifestUpdater: async (update) => await updateManifest(dir, update)
  })
}

describe('TTS resume adopts retained chunking and delivery settings', () => {
  test('the fixture is only resumable under legacy settings: smart chunking plans different slot texts', () => {
    const legacy = splitTextIntoChunks(TEXT, TTS_CHUNK_CHARACTER_LIMITS.openai)
    const smart = planTtsChunks(TEXT, TTS_CHUNK_CHARACTER_LIMITS.openai, { boundary: 'smart' }).map((chunk) => chunk.text)
    expect(smart).not.toEqual(legacy)
  })

  test('transport: resume with default delivery flags adopts the legacy plan and purchases only the missing chunks', async () => {
    await withTempDir('autoshow-tts-resume-delivery-adopt-', async (dir) => {
      const fixture = await createInterruptedLegacyRun(dir)
      let providerCalls = 0
      const options: TtsOptions = { ...resolveTtsDeliveryOptions({}), ttsDeliveryFallbackAllowed: true, ttsAllowAmbiguousRedispatch: true }
      const metadata = await resume(dir, fixture, options, () => { providerCalls += 1 })
      expect(providerCalls).toBe(fixture.chunks.length - 1)
      expect(options.ttsChunking).toEqual({ boundary: 'smart', replay: 'legacy-v0' })
      expect(options.ttsDelivery).toBeUndefined()
      const observed = await inspectSoundscapeAudio(join(dir, metadata[0]?.audioFileName as string))
      expect(observed.format).toEqual({ codec: 'pcm_s16le', container: 'wav', sampleRate: 16000, channels: 1 })
    })
  }, 20_000)

  test('transport: older smart plans retain their exact paid text after sentence recognition changes', async () => {
    await withTempDir('autoshow-tts-resume-old-smart-', async (dir) => {
      const fixture = await createInterruptedLegacyRun(dir, 'smart-v1')
      expect(fixture.chunks).not.toEqual(planTtsChunks(TEXT, 2000).map(chunk => chunk.text))
      // Simulate an older saved state without the new shared settings snapshot.
      delete fixture.retainedWithDialogue.settings
      let calls = 0
      const options: TtsOptions = { ...resolveTtsDeliveryOptions({}), ttsDeliveryFallbackAllowed: true, ttsAllowAmbiguousRedispatch: true }
      await resume(dir, fixture, options, () => { calls += 1 })
      expect(options.ttsChunking).toEqual({ boundary: 'smart', replay: 'smart-v1' })
      expect(calls).toBe(fixture.chunks.length - 1)
    })
  }, 20_000)

  test('transport: explicit delivery flags disable adoption, so a mismatched resume fails closed with zero provider requests', async () => {
    await withTempDir('autoshow-tts-resume-delivery-explicit-', async (dir) => {
      const fixture = await createInterruptedLegacyRun(dir)
      let providerCalls = 0
      const options: TtsOptions = { ...resolveTtsDeliveryOptions({ 'tts-audio-profile': 'audiobook' }), ttsDeliveryFallbackAllowed: false, ttsAllowAmbiguousRedispatch: true }
      await expect(resume(dir, fixture, options, () => { providerCalls += 1 })).rejects.toThrow('resume will not silently rebind or repurchase it')
      expect(providerCalls).toBe(0)
      expect(options.ttsDelivery?.preset).toBe('audiobook')
    })
  }, 20_000)
})

setupTtsFixtureCredentials()
