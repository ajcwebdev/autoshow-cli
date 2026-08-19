import { describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { StructuredScriptData } from '~/types'
import { canonicalTtsJson, hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import {
  AUDIOGEN_NONCOMMERCIAL_LICENSE_USE,
  REPLICATE_AUDIOGEN_MODEL_ID,
  REPLICATE_AUDIOGEN_PINNED_VERSION,
  REPLICATE_AUDIOGEN_SELECTOR,
  createReplicateAudioGenAdapter,
  createSoundEffectLicenseUse,
  readAudioGenCapabilityFixture,
  registerHistoricalAudioGenFixture,
  withAudioGenDispatchAvailability,
  REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE,
} from '~/cli/commands/process-steps/step-4-tts/soundscape/replicate-audiogen-adapter'
import { createSoundEffectRenderPlan, executeSoundEffectRenderPlan, loadSoundEffectRenderPlan, loadSoundEffectRenderResult, writeSoundEffectRenderPlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/sound-effect-execution'
import { createSoundscapePlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-planner'
import { createComicSourceIdentity, createStructuredScriptArtifactRef, computeSceneRunIdentity } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-dialogue-plan'
import { createLocalSilentDialogueRun, planComicSoundscapePrice, resolveSoundEffectPlan, runComicSoundscape } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-soundscape-workflow'
import { createHostedConcurrencyCoordinator } from '~/cli/commands/process-steps/hosted-concurrency-coordinator'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const CREATED_AT = '2026-08-14T00:00:00.000Z'
const POLL_URL = 'https://api.replicate.com/v1/predictions/prediction-audiogen-mix'
const OUTPUT_URL = 'https://replicate.delivery/audiogen-mix.wav'
const tempDirs = setupContractSuiteLifecycle({ envKeys: ['REPLICATE_API_TOKEN', 'ELEVENLABS_API_KEY'], tempPrefix: 'autoshow-audiogen-soundscape-' })

const fixture = async (root: string) => {
  const sfxPrompt = `Hatch slams ${randomUUID()}.`
  const ambiencePrompt = `Engine hum ${randomUUID()}.`
  const source = `# Episode\n\n## Bridge\n\n**PILOT**\nReady?\n\n**NAVIGATOR**\nReady.\n\n**SFX:**\n${sfxPrompt}\n\n**AMBIENCE:**\n${ambiencePrompt}\n`
  const sourcePath = join(root, 'scene.md')
  await Bun.write(sourcePath, source)
  const sourceIdentity = await createComicSourceIdentity(sourcePath, source)
  const dialogueStart = [...source.slice(0, source.indexOf('Ready?'))].length
  const answerStart = [...source.slice(0, source.indexOf('Ready.'))].length
  const sfxStart = [...source.slice(0, source.indexOf(sfxPrompt))].length
  const ambienceStart = [...source.slice(0, source.indexOf(ambiencePrompt))].length
  const structured: StructuredScriptData = {
    schemaVersion: 5,
    scriptSlug: sourceIdentity.scriptSlug,
    sourceFile: sourceIdentity.canonicalPath,
    sourceIdentity,
    document: { heading: 'Episode', title: 'Episode', metadata: [] },
    scene: {
      heading: 'Bridge', title: 'Bridge', location: { key: 'bridge', raw: 'INT. BRIDGE' },
      soundscape: {
        cues: [{ cueId: hashCanonicalTtsValue({ kind: 'action-sfx', sfxStart }), kind: 'action-sfx', prompt: sfxPrompt, required: true, anchor: { kind: 'scene-clock', positionMs: 100 }, sourceSpan: { kind: 'sound-effect', start: sfxStart, end: sfxStart + [...sfxPrompt].length, indexUnit: 'unicode-scalar-value', text: sfxPrompt }, durationSeconds: 1 }],
        ambientBeds: [{ cueId: hashCanonicalTtsValue({ kind: 'ambience', ambienceStart }), kind: 'ambience', prompt: ambiencePrompt, required: true, range: { kind: 'full-scene' }, sourceSpan: { kind: 'sound-effect', start: ambienceStart, end: ambienceStart + [...ambiencePrompt].length, indexUnit: 'unicode-scalar-value', text: ambiencePrompt }, durationSeconds: 2 }],
      },
    },
    characterKeys: ['pilot', 'navigator'],
    beats: [],
    sourceSegments: [
      { id: 'beat-0001', type: 'dialogue', text: 'Ready?', beatIndex: 1, speakerKey: 'pilot', speakerKeys: ['pilot'], speakerLabel: 'PILOT', sourceSpans: [{ kind: 'spoken-text', start: dialogueStart, end: dialogueStart + 6, indexUnit: 'unicode-scalar-value', text: 'Ready?' }], location: { key: 'bridge', raw: 'INT. BRIDGE' } },
      { id: 'beat-0002', type: 'dialogue', text: 'Ready.', beatIndex: 2, speakerKey: 'navigator', speakerKeys: ['navigator'], speakerLabel: 'NAVIGATOR', sourceSpans: [{ kind: 'spoken-text', start: answerStart, end: answerStart + 6, indexUnit: 'unicode-scalar-value', text: 'Ready.' }], location: { key: 'bridge', raw: 'INT. BRIDGE' } },
    ],
  }
  const structuredRef = createStructuredScriptArtifactRef(`${canonicalTtsJson(structured)}\n`)
  const sceneRunIdentity = computeSceneRunIdentity(sourceIdentity, structuredRef)
  const dialoguePlan = createComicDialoguePlan({ structuredScript: structured, sourceIdentity, structuredScriptRef: structuredRef, sceneRunIdentity, createdAt: CREATED_AT })
  const soundscapePlan = createSoundscapePlan({ structuredScript: structured, structuredScriptRef: structuredRef, dialoguePlan, sceneRunIdentity, createdAt: CREATED_AT })
  return { structured, structuredRef, dialoguePlan, soundscapePlan }
}

describe('ADR-017 Phase 7E Replicate AudioGen soundscape acceptance', () => {
  test('keeps AudioGen opt-in, license-gated, and exclusive of ElevenLabs fallback', async () => {
    const root = await tempDirs.make()
    const { soundscapePlan } = await fixture(root)
    expect(() => resolveSoundEffectTarget(`replicate=${REPLICATE_AUDIOGEN_MODEL_ID}@wrong`)).toThrow(/Unreviewed Replicate AudioGen version/)
    expect(resolveSoundEffectTarget(REPLICATE_AUDIOGEN_SELECTOR)).toMatchObject({ provider: 'replicate', model: REPLICATE_AUDIOGEN_MODEL_ID })
    expect(resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2').provider).toBe('elevenlabs')
    await expect(resolveSoundEffectPlan({ rootDir: root, soundscapePlan, selector: REPLICATE_AUDIOGEN_SELECTOR })).rejects.toThrow(/requires explicit --sfx-license-use noncommercial/)
    await expect(resolveSoundEffectPlan({ rootDir: root, soundscapePlan, selector: REPLICATE_AUDIOGEN_SELECTOR, licenseUseClassification: 'commercial' })).rejects.toThrow(/commercial intended use is ineligible/)
    const price = await planComicSoundscapePrice({ rootDir: root, plan: soundscapePlan, selector: REPLICATE_AUDIOGEN_SELECTOR, licenseUseClassification: 'noncommercial' })
    expect(price.renderPlan?.target.model).toBe(REPLICATE_AUDIOGEN_MODEL_ID)
    expect(price.renderPlan?.licenseUse).toEqual(AUDIOGEN_NONCOMMERCIAL_LICENSE_USE)
    expect(price.summary).toMatch(/replicate\/sepal\/audiogen/)
    expect(price.renderPlan?.tasks.map(task => ({ kind: task.kind, loop: task.loop }))).toEqual([{ kind: 'action-sfx', loop: false }, { kind: 'ambience', loop: true }])
  })

  test('publishes a local four-bus mix from mocked AudioGen action and ambience sources', async () => {
    const root = await tempDirs.make()
    const { dialoguePlan, soundscapePlan } = await fixture(root)
    const calls = installMockFetch(call => {
      if (call.url.endsWith('/v1/predictions') && call.method === 'POST') {
        return Response.json({ id: 'prediction-audiogen-mix', status: 'starting', urls: { get: POLL_URL } })
      }
      if (call.url === POLL_URL) {
        return Response.json({ id: 'prediction-audiogen-mix', status: 'succeeded', output: OUTPUT_URL, version: REPLICATE_AUDIOGEN_PINNED_VERSION })
      }
      if (call.url === OUTPUT_URL) {
        return new Response(createSyntheticWavBytes({ durationSeconds: 1, amplitude: 0.2, frequencyHz: 180 }), { headers: { 'content-type': 'audio/wav' } })
      }
      throw new Error(`Unexpected network call: ${call.method} ${call.url}`)
    })
    const renderPlan = createSoundEffectRenderPlan({
      plan: soundscapePlan,
      target: resolveSoundEffectTarget(REPLICATE_AUDIOGEN_SELECTOR),
      licenseUse: AUDIOGEN_NONCOMMERCIAL_LICENSE_USE,
    })
    const adapter = createReplicateAudioGenAdapter({ apiToken: 'fixture-token', now: () => CREATED_AT })
    await mkdir(join(root, 'audio', 'final'), { recursive: true })
    const dialogue = await createLocalSilentDialogueRun({ rootDir: root, plan: soundscapePlan, target: { service: 'local', model: 'silence-v1', transport: 'local-process' } })
    const mixed = await runComicSoundscape({
      rootDir: root,
      plan: soundscapePlan,
      renderPlan,
      dialoguePlan,
      dialogueRuns: [dialogue.binding],
      adapter,
      concurrency: 2,
      hostedConcurrencyCoordinator: createHostedConcurrencyCoordinator({ mode: 'immediate' }),
    })
    const soundscapeRun = mixed.soundscapeRuns[0]
    expect(calls.some(call => call.method === 'POST' && call.url.endsWith('/v1/predictions'))).toBe(true)
    expect(calls.some(call => call.url === OUTPUT_URL)).toBe(true)
    expect(soundscapeRun?.mix.stems.map(stem => stem.bus)).toEqual(['dialogue', 'action-sfx', 'ambience'])
    expect(await Bun.file(join(root, soundscapeRun?.ref.path as string)).exists()).toBe(true)
    expect(await Bun.file(join(root, soundscapeRun?.mix.master.path as string)).exists()).toBe(true)
    expect(await Bun.file(join(root, soundscapeRun?.binding.reportedOutputPath as string)).exists()).toBe(true)
    const resumed = await loadSoundEffectRenderResult(root, renderPlan)
    expect(resumed?.status).toBe('succeeded')
    const second = await executeSoundEffectRenderPlan({ rootDir: await tempDirs.make(), plan: renderPlan, adapter, concurrency: 1 })
    expect(second.result.entries.every(entry => entry.source === 'cache-materialization')).toBe(true)
  }, 20_000)

  test('retired AudioGen fixtures remain readable and never fall back to ElevenLabs', async () => {
    const root = await tempDirs.make()
    const { soundscapePlan } = await fixture(root)
    const retired = registerHistoricalAudioGenFixture(withAudioGenDispatchAvailability(REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE, 'unavailable'))
    expect(readAudioGenCapabilityFixture(retired.capabilityFixtureHash)).toEqual(retired)
    const historicalPlan = createSoundEffectRenderPlan({
      plan: soundscapePlan,
      target: { ...resolveSoundEffectTarget(REPLICATE_AUDIOGEN_SELECTOR), capabilityFixture: retired },
      licenseUse: createSoundEffectLicenseUse({ classification: 'noncommercial', fixture: retired }),
      allowUnavailable: true,
    })
    const written = await writeSoundEffectRenderPlan(root, historicalPlan)
    const loaded = await loadSoundEffectRenderPlan(root, written)
    expect(loaded.renderPlanId).toBe(historicalPlan.renderPlanId)
    expect(loaded.target.capabilityFixture.dispatchAvailability).toBe('unavailable')
    const executed = await executeSoundEffectRenderPlan({
      rootDir: root,
      plan: loaded,
      adapter: { generate: async () => { throw new Error('ElevenLabs must not substitute for unavailable AudioGen') } },
    })
    expect(executed.result.status).toBe('failed')
    expect(executed.result.entries[0]?.omissionReason).toMatch(/cannot dispatch new predictions/)
    expect(resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2').provider).toBe('elevenlabs')
  })
})
