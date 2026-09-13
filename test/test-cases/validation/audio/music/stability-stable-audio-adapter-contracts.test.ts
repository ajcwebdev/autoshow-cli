import { describe, expect, test } from 'bun:test'
import { hashCanonicalTtsValue } from '~/cli/commands/audio/tts/script-to-audio/contract-identity'
import { resolveSoundEffectTarget } from '~/cli/commands/audio/tts/soundscape/elevenlabs-sfx-adapter'
import { createSoundEffectRenderPlan, executeSoundEffectRenderPlan, planSoundEffectResumePrice } from '~/cli/commands/audio/tts/soundscape/sound-effect-execution'
import { DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE } from '~/cli/commands/audio/tts/soundscape/soundscape-planner'
import {
  STABILITY_STABLE_AUDIO_MODEL_ID,
  STABILITY_STABLE_AUDIO_SELECTOR,
  createStabilitySoundEffectAdapter,
  serializeStabilitySoundEffectRequest,
  validateStabilitySoundEffectTask,
} from '~/cli/commands/audio/tts/soundscape/stability-stable-audio-adapter'
import type { SoundscapePlan } from '~/types'
import { createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import { setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'
const dirs = setupContractSuiteLifecycle({ envKeys: [], tempPrefix: 'autoshow-stable-audio-' })

describe('Stability Stable Audio 3 SFX contracts', () => {
  test('resolves the registered Stability SFX selector', () => {
    const target = resolveSoundEffectTarget(STABILITY_STABLE_AUDIO_SELECTOR)
    expect(target.provider).toBe('stability')
    expect(target.model).toBe(STABILITY_STABLE_AUDIO_MODEL_ID)
    expect(() => resolveSoundEffectTarget('stability=stable-audio-2')).toThrow(/Unsupported Stability sound-effect model/)
  })

  test('rejects vocal reactions and serializes action-SFX requests', () => {
    const target = resolveSoundEffectTarget(STABILITY_STABLE_AUDIO_SELECTOR)
    const task = {
      taskId: 'task-1',
      cueId: 'cue-1',
      kind: 'action-sfx' as const,
      prompt: 'glass shatter',
      durationSeconds: 4,
      requestIdentity: '',
      outputFormat: 'wav',
      promptInfluence: 1,
      generationIdentity: 'gen-1',
      required: true,
      loop: false,
    }
    expect(() => validateStabilitySoundEffectTask({ ...task, kind: 'vocal-reaction' }, target)).toThrow(/cannot render vocal reactions/)
    expect(serializeStabilitySoundEffectRequest(task, target)).toEqual({
      path: '/v2beta/audio/stable-audio/text-to-audio',
      body: { prompt: 'glass shatter', duration: 4, output_format: 'wav' },
    })
  })

  test('rejects a missing API key', () => {
    expect(() => createStabilitySoundEffectAdapter({ apiKey: '' })).toThrow(/STABILITY_API_KEY/)
  })
})

const taskPlan = (prompt: string, required = true): SoundscapePlan => {
  const specs = prompt.split('|').map((text, index) => ({ prompt: text, required: index === 0 ? required : true }))
  const cues = specs.map((spec, index) => ({ cueId: hashCanonicalTtsValue({ prompt: spec.prompt, index }), kind: 'action-sfx' as const, prompt: spec.prompt, required: spec.required, anchor: { kind: 'scene-clock' as const, positionMs: index * 100 }, sourceSpan: { kind: 'sound-effect' as const, start: index * 2, end: index * 2 + 1, indexUnit: 'unicode-scalar-value' as const, text: 'x' }, durationSeconds: 1 }))
  const synthesisTasks = cues.map((cue) => {
    const generationIdentity = hashCanonicalTtsValue({ schemaVersion: 1, operation: 'sound-effect-generation', kind: cue.kind, prompt: cue.prompt, durationSeconds: 1, loop: false })
    return { taskId: hashCanonicalTtsValue({ cueId: cue.cueId, generationIdentity }), generationIdentity, cueId: cue.cueId, kind: cue.kind, prompt: cue.prompt, required: cue.required, durationSeconds: 1, loop: false }
  })
  return {
    schemaVersion: 1, soundscapePlanId: hashCanonicalTtsValue({ prompt, required, plan: 1 }), sceneRunIdentity: 'a'.repeat(64), sourceIdentity: { schemaVersion: 1, canonicalPath: 'input/x.md', scriptSlug: 'x', contentSha256: 'b'.repeat(64), identityHash: 'c'.repeat(64) }, structuredScript: { path: 'metadata/structured-script.json', artifactSchemaVersion: 5, sha256: 'd'.repeat(64) }, structuredScriptHash: 'd'.repeat(64), dialoguePlanId: 'e'.repeat(64), timingPolicy: 'strict', cues, ambientBeds: [], synthesisTasks, mixProfile: DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE, mixProfileHash: hashCanonicalTtsValue(DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE), mixIdentity: hashCanonicalTtsValue({ prompt, mix: 1 }), createdAt: '2026-08-13T00:00:00.000Z',
  }
}


test('Stable Audio creates once, polls pending results, records flat billing, and reuses completed audio', async () => {
  const target = resolveSoundEffectTarget(STABILITY_STABLE_AUDIO_SELECTOR)
  const plan = createSoundEffectRenderPlan({ plan: taskPlan(`synthetic-${crypto.randomUUID()}`), target })
  expect(plan.plannedCost.amount).toBe(0.26)
  let creates = 0, polls = 0
  const adapter = createStabilitySoundEffectAdapter({ apiKey: 'synthetic', wait: async ms => { expect(ms).toBe(10000) }, request: async request => {
    if (request.method === 'POST') { creates++; return { status: 202, body: new TextEncoder().encode('{"id":"generation-1"}') } }
    expect(request.path).toBe('/v2beta/audio/results/generation-1')
    polls++
    return polls === 1 ? { status: 202, body: new Uint8Array() } : { status: 200, headers: { 'content-type': 'audio/wav' }, body: createSyntheticWavBytes({ durationSeconds: 1, amplitude: 0.2, frequencyHz: 440 }) }
  } })
  await dirs.withDir(async rootDir => {
    const first = await executeSoundEffectRenderPlan({ rootDir, plan, adapter })
    expect(first.result.status).toBe('succeeded')
    expect(first.compact?.cost.amount).toBe(0.26)
    expect(first.result.entries[0]?.requestEvidence?.billedCostUsd).toBe(0.26)
    await executeSoundEffectRenderPlan({ rootDir, plan, adapter })
    expect((await planSoundEffectResumePrice(rootDir, plan)).amount).toBe(0)
  })
  expect(creates).toBe(1); expect(polls).toBe(2)
})

test('ambiguous result polling never authorizes another create on resume', async () => {
  const target = resolveSoundEffectTarget(STABILITY_STABLE_AUDIO_SELECTOR)
  const plan = createSoundEffectRenderPlan({ plan: taskPlan(`ambiguous-${crypto.randomUUID()}`), target })
  let creates = 0
  const adapter = createStabilitySoundEffectAdapter({ apiKey: 'synthetic', maxPolls: 1, wait: async () => {}, request: async request => {
    if (request.method === 'POST') { creates++; return { status: 202, body: new TextEncoder().encode('{"id":"accepted-1"}') } }
    return { status: 503, body: new Uint8Array() }
  } })
  await dirs.withDir(async rootDir => {
    expect((await executeSoundEffectRenderPlan({ rootDir, plan, adapter })).result.status).toBe('failed')
    expect((await executeSoundEffectRenderPlan({ rootDir, plan, adapter })).result.status).toBe('failed')
  })
  expect(creates).toBe(1)
})

test('rejected creates, invalid durations, and retained serializer identity stay distinct', async () => {
  const target = resolveSoundEffectTarget(STABILITY_STABLE_AUDIO_SELECTOR)
  const plan = createSoundEffectRenderPlan({ plan: taskPlan('synthetic'), target })
  const task = { ...plan.tasks[0]!, durationSeconds: 380 }
  expect(serializeStabilitySoundEffectRequest(task, target).body.duration).toBe(380)
  expect(() => serializeStabilitySoundEffectRequest({ ...task, durationSeconds: NaN }, target)).toThrow()
  const oldTarget = { ...target, capabilityFixture: { ...target.capabilityFixture, endpoint: '/v2beta/audio/stable-audio-3/text-to-audio', serializerVersion: 'stability.stable-audio-3.v1' } }
  expect(serializeStabilitySoundEffectRequest({ ...task, durationSeconds: 4.4 }, oldTarget)).toMatchObject({ path: oldTarget.capabilityFixture.endpoint, body: { duration: 4 } })
  const adapter = createStabilitySoundEffectAdapter({ apiKey: 'synthetic', request: async () => ({ status: 400, body: new Uint8Array() }) })
  await expect(adapter.generate(task, target, 1, new AbortController().signal)).rejects.toMatchObject({ admissionDisposition: 'rejected', retryable: false })
  await expect(adapter.generate(task, oldTarget, 1, new AbortController().signal)).rejects.toThrow('obsolete contract')
})

test('an optional accepted generation with a lost result keeps total billing unknown', async () => {
  const target = resolveSoundEffectTarget(STABILITY_STABLE_AUDIO_SELECTOR)
  const plan = createSoundEffectRenderPlan({ plan: taskPlan(`optional-${crypto.randomUUID()}`, false), target })
  const adapter = createStabilitySoundEffectAdapter({ apiKey: 'synthetic', maxPolls: 1, wait: async () => {}, request: async request => request.method === 'POST' ? { status: 202, body: new TextEncoder().encode('{"id":"accepted-optional"}') } : { status: 503, body: new Uint8Array() } })
  await dirs.withDir(async rootDir => {
    const result = await executeSoundEffectRenderPlan({ rootDir, plan, adapter })
    expect(result.result.status).toBe('succeeded')
    expect(result.compact?.cost.amount).toBeNull()
  })
})
