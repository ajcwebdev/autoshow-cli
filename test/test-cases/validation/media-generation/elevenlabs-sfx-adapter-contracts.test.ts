import { describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { createElevenLabsSoundEffectAdapter, resolveSoundEffectTarget, serializeElevenLabsSoundEffectRequest } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import { createSoundEffectRenderPlan, executeSoundEffectRenderPlan, planSoundEffectResumePrice } from '~/cli/commands/process-steps/step-4-tts/soundscape/sound-effect-execution'
import { DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-planner'
import { hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import type { SoundscapePlan } from '~/types'

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

describe('ElevenLabs Phase 1 sound-effect adapter', () => {
  test('serializes every provider-affecting field and rejects unsupported targets locally', () => {
    const target = resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2')
    const plan = createSoundEffectRenderPlan({ plan: taskPlan('hatch slam'), target })
    expect(serializeElevenLabsSoundEffectRequest(plan.tasks[0]!, target)).toEqual({ path: '/v1/sound-generation', query: { output_format: 'mp3_44100_128' }, body: { text: 'hatch slam', model_id: 'eleven_text_to_sound_v2', duration_seconds: 1, prompt_influence: 0.3, loop: false } })
    expect(() => resolveSoundEffectTarget('cartesia=sonic-3')).toThrow(/Unsupported Phase 1/)
    expect(() => resolveSoundEffectTarget('elevenlabs=eleven_v3')).toThrow(/Unsupported ElevenLabs sound-effect model/)
  })

  test('executes through bounded mocked transport, retains evidence, and reuses the shared cache without another call', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-sfx-adapter-'))
    try {
      const prompt = `fixture hatch ${randomUUID()}`
      const renderPlan = createSoundEffectRenderPlan({ plan: taskPlan(prompt), target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2') })
      let calls = 0
      const adapter = createElevenLabsSoundEffectAdapter({ apiKey: 'fixture', request: async (request) => {
        calls++
        expect(request.path).toBe('/v1/sound-generation')
        return { status: 200, headers: { 'content-type': 'audio/wav', 'request-id': 'req_fixture', 'character-cost': '11' }, body: createSyntheticWavBytes({ durationSeconds: 1, amplitude: 0.2, frequencyHz: 440 }) }
      }, now: () => '2026-08-13T00:00:00.000Z' })
      const first = await executeSoundEffectRenderPlan({ rootDir: root, plan: renderPlan, adapter, concurrency: 1 })
      expect(first.result.status).toBe('succeeded')
      expect(first.result.entries[0]?.requestEvidence).toMatchObject({ providerRequestId: 'req_fixture', observedCharacterCost: 11 })
      expect(calls).toBe(1)
      const secondRoot = await mkdtemp(join(tmpdir(), 'autoshow-sfx-cache-'))
      try {
        const second = await executeSoundEffectRenderPlan({ rootDir: secondRoot, plan: renderPlan, adapter, concurrency: 1 })
        expect(second.result.entries[0]?.source).toBe('cache-materialization')
        expect(calls).toBe(1)
        expect((await planSoundEffectResumePrice(secondRoot, renderPlan)).unresolvedTaskCount).toBe(0)
      } finally { await rm(secondRoot, { recursive: true, force: true }) }
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  test('keeps no-call price planning read-only and reports the exact unresolved duration rate', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-sfx-price-'))
    try {
      const renderPlan = createSoundEffectRenderPlan({ plan: taskPlan(`price ${randomUUID()}`), target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2') })
      const estimate = await planSoundEffectResumePrice(root, renderPlan)
      expect(estimate).toMatchObject({ unresolvedTaskCount: 1, cachedTaskCount: 0, resumedTaskCount: 0, amount: 0.002, currency: 'USD' })
      expect(await readdir(root)).toEqual([])
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  test('bounds worker fan-out and distinguishes optional omission, required failure, and cancellation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-sfx-bounds-'))
    try {
      const prompts = Array.from({ length: 5 }, (_, index) => `bounded-${index}-${randomUUID()}`).join('|')
      const boundedPlan = createSoundEffectRenderPlan({ plan: taskPlan(prompts), target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2') })
      let active = 0
      let maximumActive = 0
      const boundedAdapter = createElevenLabsSoundEffectAdapter({ apiKey: 'fixture', request: async () => {
        active++
        maximumActive = Math.max(maximumActive, active)
        await new Promise(resolve => setTimeout(resolve, 5))
        active--
        return { status: 200, headers: { 'content-type': 'audio/wav' }, body: createSyntheticWavBytes({ durationSeconds: 1, amplitude: 0.2, frequencyHz: 440 }) }
      } })
      const bounded = await executeSoundEffectRenderPlan({ rootDir: root, plan: boundedPlan, adapter: boundedAdapter, concurrency: 2 })
      expect(bounded.result.status).toBe('succeeded')
      expect(maximumActive).toBe(2)

      const optionalRoot = await mkdtemp(join(tmpdir(), 'autoshow-sfx-optional-'))
      try {
        const optionalPlan = createSoundEffectRenderPlan({ plan: taskPlan(`optional-${randomUUID()}`, false), target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2') })
        const failing = createElevenLabsSoundEffectAdapter({ apiKey: 'fixture', request: async () => ({ status: 400, headers: {}, body: new Uint8Array() }) })
        const optional = await executeSoundEffectRenderPlan({ rootDir: optionalRoot, plan: optionalPlan, adapter: failing })
        expect(optional.result.status).toBe('succeeded')
        expect(optional.result.entries[0]).toMatchObject({ status: 'omitted', source: 'provider-dispatch' })
      } finally { await rm(optionalRoot, { recursive: true, force: true }) }

      const requiredRoot = await mkdtemp(join(tmpdir(), 'autoshow-sfx-required-'))
      try {
        const requiredPlan = createSoundEffectRenderPlan({ plan: taskPlan(`required-${randomUUID()}`), target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2') })
        const failing = createElevenLabsSoundEffectAdapter({ apiKey: 'fixture', request: async () => ({ status: 400, headers: {}, body: new Uint8Array() }) })
        expect((await executeSoundEffectRenderPlan({ rootDir: requiredRoot, plan: requiredPlan, adapter: failing })).result.status).toBe('failed')
      } finally { await rm(requiredRoot, { recursive: true, force: true }) }

      const canceledRoot = await mkdtemp(join(tmpdir(), 'autoshow-sfx-canceled-'))
      try {
        const canceledPlan = createSoundEffectRenderPlan({ plan: taskPlan(`canceled-${randomUUID()}|queued-${randomUUID()}`), target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2') })
        const controller = new AbortController()
        controller.abort()
        let canceledCalls = 0
        const canceled = await executeSoundEffectRenderPlan({ rootDir: canceledRoot, plan: canceledPlan, adapter: { generate: async () => { canceledCalls++; throw new Error('must not dispatch') } }, concurrency: 1, cancellation: controller.signal })
        expect(canceled.result.status).toBe('canceled')
        expect(canceledCalls).toBe(0)
      } finally { await rm(canceledRoot, { recursive: true, force: true }) }
    } finally { await rm(root, { recursive: true, force: true }) }
  })

  test('retries only explicit rejection and blocks ambiguous admission from automatic repurchase', async () => {
    const retryRoot = await mkdtemp(join(tmpdir(), 'autoshow-sfx-retry-'))
    try {
      const retryPlan = createSoundEffectRenderPlan({ plan: taskPlan(`retry-${randomUUID()}`), target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2') })
      let retryCalls = 0
      const retryAdapter = createElevenLabsSoundEffectAdapter({ apiKey: 'fixture', request: async () => {
        retryCalls++
        return retryCalls === 1
          ? { status: 429, headers: {}, body: new Uint8Array() }
          : { status: 200, headers: { 'content-type': 'audio/wav' }, body: createSyntheticWavBytes({ durationSeconds: 1, amplitude: 0.2, frequencyHz: 440 }) }
      } })
      expect((await executeSoundEffectRenderPlan({ rootDir: retryRoot, plan: retryPlan, adapter: retryAdapter, maxAttempts: 3 })).result.status).toBe('succeeded')
      expect(retryCalls).toBe(2)
    } finally { await rm(retryRoot, { recursive: true, force: true }) }

    const ambiguousRoot = await mkdtemp(join(tmpdir(), 'autoshow-sfx-ambiguous-'))
    try {
      const ambiguousPlan = createSoundEffectRenderPlan({ plan: taskPlan(`ambiguous-${randomUUID()}`), target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2') })
      let calls = 0
      const ambiguousAdapter = { generate: async () => { calls++; throw new Error('transport disconnected after request write') } }
      expect((await executeSoundEffectRenderPlan({ rootDir: ambiguousRoot, plan: ambiguousPlan, adapter: ambiguousAdapter })).result.status).toBe('failed')
      expect((await executeSoundEffectRenderPlan({ rootDir: ambiguousRoot, plan: ambiguousPlan, adapter: ambiguousAdapter })).result.status).toBe('failed')
      expect(calls).toBe(1)
      await expect(planSoundEffectResumePrice(ambiguousRoot, ambiguousPlan)).rejects.toThrow(/ambiguous provider admission/iu)
    } finally { await rm(ambiguousRoot, { recursive: true, force: true }) }
  })
})
