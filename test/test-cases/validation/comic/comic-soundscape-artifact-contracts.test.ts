import { describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CharacterCatalogService } from '~/types'
import type { LocationReferenceCatalog } from '~/cli/commands/process-steps/step-8-comic/comic-utils/location-reference'
import { createStructuredScriptArtifactRef, computeSceneRunIdentity } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-dialogue-plan'
import { updateComicAudioManifest, writeInitialComicStructureManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-manifest'
import { createLocalSilentDialogueRun, runComicSoundscape } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-soundscape-workflow'
import { parseScriptMarkdownToStructuredData } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/structured-script-parser'
import { createElevenLabsSoundEffectAdapter, resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import { createSoundEffectRenderPlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/sound-effect-execution'
import { createSoundscapePlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-planner'
import { sha256Bytes } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { createHostedConcurrencyCoordinator } from '~/cli/commands/process-steps/hosted-concurrency-coordinator'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'

const characters = {
  characterKeys: [], resolve: () => undefined, detectMentions: () => [],
} as unknown as CharacterCatalogService

const locations: LocationReferenceCatalog = {
  schemaVersion: 1,
  styleImage: 'style.png',
  locations: [{ key: 'hangar', name: 'Hangar', aliases: [], specification: 'Hangar.', sourceScripts: [] }],
}

describe('ADR-018 canonical soundscape artifact workflow', () => {
  test('reuses one mocked ElevenLabs generation result across dialogue targets and resumes without redispatch', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-soundscape-artifacts-'))
    try {
      const unique = randomUUID()
      const source = ['# Episode', '', '## Scene: "Hangar"', '', '**INT. HANGAR**', '', '**AMBIENCE:**', '', `OPTIONAL ventilation ${unique}`, '', '**SFX:**', '', `airlock closes ${unique}`].join('\n')
      const provisional = parseScriptMarkdownToStructuredData(source, 'input/soundscape-only.md', { characterCatalog: characters, locationCatalog: locations })
      const structured = parseScriptMarkdownToStructuredData(source, 'input/soundscape-only.md', { sourceIdentity: provisional.sourceIdentity, characterCatalog: characters, locationCatalog: locations })
      const structuredRef = createStructuredScriptArtifactRef(`${JSON.stringify(structured)}\n`)
      await mkdir(join(root, 'metadata'), { recursive: true })
      await Bun.write(join(root, structuredRef.path), `${JSON.stringify(structured)}\n`)
      const sceneRunIdentity = computeSceneRunIdentity(structured.sourceIdentity, structuredRef)
      const dialoguePlan = createComicDialoguePlan({ structuredScript: structured, sourceIdentity: structured.sourceIdentity, structuredScriptRef: structuredRef, sceneRunIdentity, createdAt: '2026-08-13T00:00:00.000Z' })
      const soundscapePlan = createSoundscapePlan({ structuredScript: structured, structuredScriptRef: structuredRef, dialoguePlan, sceneRunIdentity, createdAt: '2026-08-13T00:00:00.000Z' })
      const renderPlan = createSoundEffectRenderPlan({ plan: soundscapePlan, target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2') })
      const firstDialogue = await createLocalSilentDialogueRun({ rootDir: root, plan: soundscapePlan, target: { service: 'fixture-a', model: 'dialogue-a', transport: 'local-process' } })
      const secondDialogue = await createLocalSilentDialogueRun({ rootDir: root, plan: soundscapePlan, target: { service: 'fixture-b', model: 'dialogue-b', transport: 'local-process' } })
      await mkdir(join(root, 'audio', 'final'), { recursive: true })
      let calls = 0
      const adapter = createElevenLabsSoundEffectAdapter({ apiKey: 'fixture', request: async () => {
        calls++
        return { status: 200, headers: { 'content-type': 'audio/wav', 'request-id': `fixture-${calls}` }, body: createSyntheticWavBytes({ durationSeconds: 0.5, amplitude: 0.2, frequencyHz: 220 + calls * 110 }) }
      }, now: () => '2026-08-13T00:00:00.000Z' })
      const hostedConcurrencyCoordinator = createHostedConcurrencyCoordinator({ mode: 'immediate' })
      const first = await runComicSoundscape({ rootDir: root, plan: soundscapePlan, renderPlan, dialoguePlan, dialogueRuns: [firstDialogue.binding, secondDialogue.binding], adapter, concurrency: 2, hostedConcurrencyCoordinator })
      expect(first.providerState.status).toBe('succeeded')
      expect(first.soundscapeRuns).toHaveLength(2)
      expect(calls).toBe(renderPlan.tasks.length)
      const soundEffectLane = hostedConcurrencyCoordinator.snapshot().lanes[0]
      expect(soundEffectLane?.classes.some(entry => entry.workClass === 'sound-effect')).toBe(true)
      expect(soundEffectLane?.activePeak).toBeLessThanOrEqual(2)
      for (const run of first.soundscapeRuns) {
        const published = new Uint8Array(await Bun.file(join(root, run.binding.reportedOutputPath)).arrayBuffer())
        expect(sha256Bytes(published)).toBe(run.audioRun.master.sha256)
        expect(run.audioRun.stems.map(stem => stem.bus)).toEqual(['dialogue', 'action-sfx', 'ambience'])
      }
      await writeInitialComicStructureManifest({ sceneRunDir: root, createdAt: soundscapePlan.createdAt, sourceIdentity: structured.sourceIdentity, structuredScript: structuredRef })
      const selectedSoundscapeRuns = first.soundscapeRuns.map(run => ({ targetKey: run.binding.targetKey, dialogueAudioRunId: run.binding.audioRunId, soundscapeAudioRunId: run.audioRun.audioRunId, audioRunRef: run.ref.path, audioRunSha256: run.ref.sha256, masterRef: { path: run.audioRun.master.path, sha256: run.audioRun.master.sha256 } }))
      const artifactRefs = [structuredRef, first.planRef, first.renderPlanRef, first.renderResultRef, ...firstDialogue.refs, ...secondDialogue.refs, ...first.soundscapeRuns.flatMap(run => [run.ref, run.audioRun.resolvedTimeline, run.audioRun.transformLedger, ...run.audioRun.stems, run.audioRun.master])].map(ref => ({ path: ref.path, sha256: ref.sha256 }))
      await updateComicAudioManifest({
        sceneRunDir: root, sourceIdentity: structured.sourceIdentity,
        stage: { requirement: 'required', status: 'full', execution: { kind: 'provider-targets' }, targetKeys: [renderPlan.target.targetKey], artifactRefs },
        audio: {
          sceneRunIdentity, structuredScript: structuredRef, dialoguePlanId: dialoguePlan.dialoguePlanId,
          soundscapePlanId: soundscapePlan.soundscapePlanId, soundscapePlanRef: first.planRef, soundEffectRenderPlanRef: first.renderPlanRef, soundEffectRenderResultRef: first.renderResultRef,
          selectedAudioRuns: [firstDialogue.binding, secondDialogue.binding].map(binding => ({ targetKey: binding.targetKey, renderIdentity: binding.renderIdentity, audioRunId: binding.audioRunId, audioRunRef: binding.audioRunRef, audioRunSha256: binding.audioRunSha256 })),
          selectedSoundscapeRuns, publishedAudioRunId: selectedSoundscapeRuns[0]?.soundscapeAudioRunId,
          finalOutputRefs: first.soundscapeRuns.map(run => ({ path: run.binding.reportedOutputPath, sha256: run.audioRun.master.sha256 })),
        },
        providers: [first.providerState],
      })
      const manifest = await readManifest(root)
      const comic = manifest?.items[0]?.metadata['comic'] as { audio?: { selectedSoundscapeRuns?: unknown[] } } | undefined
      expect(manifest?.items[0]?.status).toBe('full')
      expect(comic?.audio?.selectedSoundscapeRuns).toHaveLength(2)
      const resumed = await runComicSoundscape({ rootDir: root, plan: soundscapePlan, renderPlan, dialoguePlan, dialogueRuns: [firstDialogue.binding, secondDialogue.binding], adapter, concurrency: 2, hostedConcurrencyCoordinator })
      expect(resumed.soundscapeRuns.map(run => run.audioRun.audioRunId)).toEqual(first.soundscapeRuns.map(run => run.audioRun.audioRunId))
      expect(calls).toBe(renderPlan.tasks.length)
      const names = (await readdir(root, { recursive: true })).map(String)
      expect(names.filter(name => name.endsWith('manifest.json'))).toEqual(['manifest.json'])
      expect(names.filter(name => name.endsWith('/result.json') || name === 'result.json')).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
