import { describe, expect, test } from 'bun:test'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { planCurrentTtsResumePrice } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { buildCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { createInlineTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { resolveTtsOutputLayout } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/tts-output-layout'
import { createElevenLabsSoundEffectAdapter, resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import { SOUND_EFFECT_ARCHIVE_PATH, createSoundEffectRenderPlan, executeSoundEffectRenderPlan, loadCompactSfx, planSoundEffectResumePrice, soundEffectSourcePath, soundEffectWorkingRoot } from '~/cli/commands/process-steps/step-4-tts/soundscape/sound-effect-execution'
import { DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-planner'
import { PRESENTATION_ARCHIVE_PATH, loadCompactPresentation } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-presentation-renderer'
import { hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import type { CanonicalAudioProviderProjection, CompactTargetRender, FinalTimeline, SoundscapePlan, TtsTarget } from '~/types'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { requireDefined } from '../../../test-utils/value-assertions'

const MODEL = 'fixture-compact-archive-model'

const relativeNames = async (root: string): Promise<string[]> =>
  (await readdir(root, { recursive: true })).map(String).map(name => name.replaceAll('\\', '/'))

const createFixtureTarget = (calls: number[]): TtsTarget => {
  const operation = 'tts-synthesis' as const
  const transport = 'hosted-api'
  const targetKey = canonicalTargetKey(operation, 'openai', MODEL, transport)
  return {
    service: 'openai',
    model: MODEL,
    operation,
    transport,
    targetKey,
    voice: 'alloy',
    run: async (text, outputDir, _opts, _invocation, requestEvidence) => {
      calls.push(calls.length)
      const audioPath = join(outputDir, 'speech.wav')
      const bytes = createSyntheticWavBytes({ durationSeconds: 0.2, amplitude: 0.25, frequencyHz: 440 })
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
        await accepted({ providerRequestId: `compact-archive-${calls.length}` })
        await Bun.write(audioPath, bytes)
      })
      if (!requestEvidence) await Bun.write(audioPath, bytes)
      await requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
      await requestEvidence?.complete({ chunkIndex: 1 })
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
  }
}

const sfxPlan = (prompt: string): SoundscapePlan => {
  const cueId = hashCanonicalTtsValue({ prompt })
  const generationIdentity = hashCanonicalTtsValue({ schemaVersion: 1, operation: 'sound-effect-generation', kind: 'action-sfx', prompt, durationSeconds: 1, loop: false })
  return {
    schemaVersion: 1,
    soundscapePlanId: hashCanonicalTtsValue({ prompt, plan: 1 }),
    sceneRunIdentity: 'a'.repeat(64),
    sourceIdentity: { schemaVersion: 1, canonicalPath: 'input/x.md', scriptSlug: 'x', contentSha256: 'b'.repeat(64), identityHash: 'c'.repeat(64) },
    structuredScript: { path: 'metadata/structured-script.json', artifactSchemaVersion: 5, sha256: 'd'.repeat(64) },
    structuredScriptHash: 'd'.repeat(64),
    dialoguePlanId: 'e'.repeat(64),
    timingPolicy: 'strict',
    cues: [{ cueId, kind: 'action-sfx', prompt, required: true, anchor: { kind: 'scene-clock', positionMs: 0 }, sourceSpan: { kind: 'sound-effect', start: 0, end: 1, indexUnit: 'unicode-scalar-value', text: 'x' }, durationSeconds: 1 }],
    ambientBeds: [],
    synthesisTasks: [{ taskId: hashCanonicalTtsValue({ cueId, generationIdentity }), generationIdentity, cueId, kind: 'action-sfx', prompt, required: true, durationSeconds: 1, loop: false }],
    mixProfile: DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE,
    mixProfileHash: hashCanonicalTtsValue(DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE),
    mixIdentity: hashCanonicalTtsValue({ prompt, mix: 1 }),
    createdAt: '2026-08-13T00:00:00.000Z',
  }
}

describe('ADR-013 compact archive contracts', () => {
  test('layout helper never writes or resumes through the retired audio/providers tree', () => {
    const targetKey = canonicalTargetKey('comic-audio', 'openai', MODEL, 'hosted-api')
    const comic = resolveTtsOutputLayout('audio/providers', targetKey, 'f'.repeat(64))
    const standalone = resolveTtsOutputLayout('providers', targetKey, 'f'.repeat(64))
    const paths = [
      comic.workDir, comic.slotsDir, comic.archiveRenderPath, comic.archiveTimelinePath, comic.slotWavPath('ab'.repeat(32)),
      standalone.workDir, standalone.slotsDir, standalone.archiveRenderPath, standalone.archiveTimelinePath,
    ]
    expect(paths.some(path => path.includes('audio/providers') || path.startsWith('providers/'))).toBe(false)
    expect(comic.slotsDir).toBe('audio/slots')
    expect(comic.archiveRenderPath).toBe(`audio/${targetKey}/render.json`)
    expect(comic.workDir).toBe(`audio/work/${targetKey}/${'f'.repeat(64)}`)
    expect(standalone.slotsDir).toBe('slots')
  })

  test('comic TTS compact writes the archive tree, deletes the working tree, and resumes from slots', async () => {
    await withTempDir('autoshow-compact-archive-tts-', async (dir) => {
      const sourceText = 'A compact archive fixture line.'
      const sourceIdentity = createInlineTtsSourceIdentity(sourceText)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, sourceText)
      const firstCalls: number[] = []
      const target = createFixtureTarget(firstCalls)
      const targetKey = target.targetKey as string
      const publicationBoundaries: Array<{ archiveReady: boolean }> = []
      const first = await runTtsForTargets(sourceText, dir, {}, [target], {
        sourceIdentity,
        dialoguePlan,
        artifactRoot: 'audio/providers',
        resolveReportedOutput: () => ({ path: join(dir, 'audio', 'final', `${targetKey}.wav`), fileName: `audio/final/${targetKey}.wav` }),
        onProviderState: async (state) => {
          if (state.status !== 'succeeded') return
          const projection = state.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
          const archive = projection?.archive
          publicationBoundaries.push({
            archiveReady: Boolean(
              archive
              && await Bun.file(join(dir, archive.renderRef.path)).exists()
              && await Bun.file(join(dir, archive.timelineRef.path)).exists()
              && await Bun.file(join(dir, archive.finalRef.path)).exists()
            ),
          })
        },
      })
      const archive = requireDefined(first.metadata[0]?.ttsAudio?.archive, 'compact TTS archive')
      const compactRender = await Bun.file(join(dir, archive.renderRef.path)).json() as CompactTargetRender
      const { renderId, ...compactRenderBase } = compactRender
      expect(renderId).toBe(hashCanonicalTtsValue(compactRenderBase))
      expect(compactRender.cost).toEqual({
        currentComposition: { planned: expect.any(Object), observed: [] },
        closingAttempt: { planned: expect.any(Object), observed: [] },
        cumulativeRenderHistory: { planned: expect.any(Object), observed: [] },
      })
      const timeline = await Bun.file(join(dir, archive.timelineRef.path)).json() as FinalTimeline
      const { timelineId, ...timelineBase } = timeline
      expect(timelineId).toBe(hashCanonicalTtsValue(timelineBase))
      const slotHash = requireDefined(compactRender.slots[0]?.slotHash, 'compact slot hash')
      const names = await relativeNames(dir)
      expect(names.some(name => name === `audio/${targetKey}/render.json`)).toBe(true)
      expect(names.some(name => name === `audio/${targetKey}/timeline.json`)).toBe(true)
      expect(names.some(name => name === `audio/slots/${slotHash}.wav`)).toBe(true)
      expect(names.some(name => name === `audio/final/${targetKey}.wav`)).toBe(true)
      expect(names.some(name => name.includes('audio/providers'))).toBe(false)
      expect(names.some(name => name.includes('journal.jsonl') || name.includes('cache-materializations'))).toBe(false)
      expect(names.some(name => name.startsWith(`audio/work/${targetKey}/`))).toBe(false)
      expect(first.metadata[0]?.ttsAudio?.activeWork).toBeUndefined()
      expect(archive.slotCount).toBe(1)
      expect(publicationBoundaries).toEqual([{ archiveReady: true }])

      const retained = buildCurrentTtsProviderState(first.metadata[0]!)
      const price = await planCurrentTtsResumePrice({
        rootDir: dir,
        state: retained,
        target,
        sourceText,
        ttsOptions: {},
        sourceIdentity,
        dialoguePlan,
      })
      expect(price).toMatchObject({ recoveryKind: 'complete-render', recoveredSlotCount: 1, unresolvedSlotCount: 0, plannedSlotCount: 0, plannedCost: { amounts: [] } })

      const resumeCalls: number[] = []
      await runTtsForTargets(sourceText, dir, {}, [createFixtureTarget(resumeCalls)], {
        sourceIdentity,
        dialoguePlan,
        artifactRoot: 'audio/providers',
        retainedProviderStates: [retained],
        recoveryRootDir: dir,
        resolveReportedOutput: () => ({ path: join(dir, 'audio', 'final', `${targetKey}.wav`), fileName: `audio/final/${targetKey}.wav` }),
      })
      expect(firstCalls).toEqual([0])
      expect(resumeCalls).toEqual([])
      expect(await Bun.file(join(dir, 'audio', 'slots', `${slotHash}.wav`)).exists()).toBe(true)
      expect(await Bun.file(join(dir, 'cache-materializations')).exists()).toBe(false)
    })
  })

  test('a leftover audio/providers tree cannot satisfy a current generation slot', async () => {
    await withTempDir('autoshow-compact-archive-legacy-', async (dir) => {
      const sourceText = 'Legacy providers must not resume.'
      const sourceIdentity = createInlineTtsSourceIdentity(sourceText)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, sourceText)
      const firstCalls: number[] = []
      const target = createFixtureTarget(firstCalls)
      const targetKey = target.targetKey as string
      const first = await runTtsForTargets(sourceText, dir, {}, [target], {
        sourceIdentity,
        dialoguePlan,
        artifactRoot: 'audio/providers',
        resolveReportedOutput: () => ({ path: join(dir, 'audio', 'final', `${targetKey}.wav`), fileName: `audio/final/${targetKey}.wav` }),
      })
      const archive = requireDefined(first.metadata[0]?.ttsAudio?.archive, 'compact TTS archive')
      const compactRender = await Bun.file(join(dir, archive.renderRef.path)).json() as { slots: Array<{ slotHash: string }> }
      const slotHash = requireDefined(compactRender.slots[0]?.slotHash, 'compact slot hash')
      const slotBytes = new Uint8Array(await Bun.file(join(dir, 'audio', 'slots', `${slotHash}.wav`)).arrayBuffer())
      await mkdir(join(dir, 'audio', 'providers', targetKey, 'slots'), { recursive: true })
      await Bun.write(join(dir, 'audio', 'providers', targetKey, 'slots', `${slotHash}.wav`), slotBytes)
      await rm(join(dir, 'audio', 'slots', `${slotHash}.wav`), { force: true })

      const projection = structuredClone(first.metadata[0]!.ttsAudio!)
      delete projection.archive
      const retained = {
        ...buildCurrentTtsProviderState(first.metadata[0]!),
        metadata: { ttsAudio: projection },
        result: { ttsAudio: projection },
      }
      const price = await planCurrentTtsResumePrice({
        rootDir: dir,
        state: retained,
        target,
        sourceText,
        ttsOptions: {},
        sourceIdentity,
        dialoguePlan,
      })
      expect(price.unresolvedSlotCount).toBeGreaterThan(0)
      expect(price.recoveryKind).not.toBe('complete-render')

      const resumeCalls: number[] = []
      await runTtsForTargets(sourceText, dir, {}, [createFixtureTarget(resumeCalls)], {
        sourceIdentity,
        dialoguePlan,
        artifactRoot: 'audio/providers',
        retainedProviderStates: [retained],
        recoveryRootDir: dir,
        resolveReportedOutput: () => ({ path: join(dir, 'audio', 'final', `${targetKey}.wav`), fileName: `audio/final/${targetKey}.wav` }),
      })
      expect(resumeCalls).toEqual([0])
      expect(await Bun.file(join(dir, 'audio', 'slots', `${slotHash}.wav`)).exists()).toBe(true)
    })
  })

  test('SFX compact keeps sfx.json plus one source file and deletes admissions', async () => {
    await withTempDir('autoshow-compact-archive-sfx-', async (dir) => {
      const renderPlan = createSoundEffectRenderPlan({
        plan: sfxPlan(`archive-sfx-${randomUUID()}`),
        target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2'),
      })
      const adapter = createElevenLabsSoundEffectAdapter({
        apiKey: 'fixture',
        request: async () => ({ status: 200, headers: { 'content-type': 'audio/wav', 'request-id': 'sfx-archive' }, body: createSyntheticWavBytes({ durationSeconds: 1, amplitude: 0.2, frequencyHz: 220 }) }),
        now: () => '2026-08-13T00:00:00.000Z',
      })
      const executed = await executeSoundEffectRenderPlan({ rootDir: dir, plan: renderPlan, adapter, concurrency: 1 })
      expect(executed.result.status).toBe('succeeded')
      const compact = await loadCompactSfx(dir, renderPlan)
      expect(compact?.ref.path).toBe(SOUND_EFFECT_ARCHIVE_PATH)
      const requestIdentity = renderPlan.tasks[0]?.requestIdentity as string
      const names = await relativeNames(dir)
      expect(names).toContain(SOUND_EFFECT_ARCHIVE_PATH)
      expect(names).toContain(soundEffectSourcePath(requestIdentity))
      expect(names.some(name => name.startsWith(soundEffectWorkingRoot(renderPlan.renderPlanId)))).toBe(false)
      expect(names.some(name => name.includes('/admissions/'))).toBe(false)
      expect((await planSoundEffectResumePrice(dir, renderPlan)).unresolvedTaskCount).toBe(0)
    })
  })

  test('presentation compact archive is presentation.json, not a runs/ tree', async () => {
    await withTempDir('autoshow-compact-archive-presentation-', async (dir) => {
      await mkdir(join(dir, 'presentation', 'runs', 'a'.repeat(64)), { recursive: true })
      await Bun.write(join(dir, 'presentation', 'runs', 'a'.repeat(64), 'comic-presentation-run.json'), '{}\n')
      expect(await loadCompactPresentation(dir)).toBeUndefined()
      expect(PRESENTATION_ARCHIVE_PATH).toBe('presentation/presentation.json')
    })
  })
})
