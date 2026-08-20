import { describe, expect, test } from 'bun:test'
import { ProviderError } from '~/utils/error-handler'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle, unexpectedCall } from '../../../test-utils/rest-contract-helpers'
import { resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import {
  AUDIOGEN_NONCOMMERCIAL_LICENSE_USE,
  REPLICATE_AUDIOGEN_MODEL_ID,
  REPLICATE_AUDIOGEN_PINNED_VERSION,
  REPLICATE_AUDIOGEN_SELECTOR,
  REPLICATE_AUDIOGEN_SERIALIZER_VERSION,
  REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE,
  assertAudioGenLicenseEligible,
  createReplicateAudioGenAdapter,
  createSoundEffectLicenseUse,
  hashSoundEffectCapabilityFixture,
  readAudioGenCapabilityFixture,
  registerHistoricalAudioGenFixture,
  resolveReplicateAudioGenTarget,
  serializeReplicateAudioGenRequest,
  validateReplicateAudioGenTask,
  withAudioGenDispatchAvailability,
} from '~/cli/commands/process-steps/step-4-tts/soundscape/replicate-audiogen-adapter'
import { createSoundEffectRenderPlan, executeSoundEffectRenderPlan, planSoundEffectResumePrice } from '~/cli/commands/process-steps/step-4-tts/soundscape/sound-effect-execution'
import { DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-planner'
import { hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import type { SoundEffectRenderTask, SoundscapePlan } from '~/types'
import { isAppError, normalizeExitCode } from '~/utils/error-handler'

const POLL_URL = 'https://api.replicate.com/v1/predictions/prediction-audiogen'
const CANCEL_URL = 'https://api.replicate.com/v1/predictions/prediction-audiogen/cancel'
const OUTPUT_URL = 'https://replicate.delivery/audiogen-output.wav'
const tempDirs = setupContractSuiteLifecycle({ envKeys: ['REPLICATE_API_TOKEN'], tempPrefix: 'autoshow-audiogen-adapter-' })

const taskPlan = (prompt: string, options: { required?: boolean, durationSeconds?: number | undefined, kind?: 'action-sfx' | 'vocal-reaction' | 'ambience', loop?: boolean } = {}): SoundscapePlan => {
  const required = options.required ?? true
  const durationSeconds = options.durationSeconds
  const kind = options.kind ?? 'action-sfx'
  const loop = options.loop ?? kind === 'ambience'
  const cue = {
    cueId: hashCanonicalTtsValue({ prompt, kind }),
    kind: kind === 'ambience' ? 'action-sfx' as const : kind,
    prompt,
    required,
    anchor: { kind: 'scene-clock' as const, positionMs: 0 },
    sourceSpan: { kind: 'sound-effect' as const, start: 0, end: 1, indexUnit: 'unicode-scalar-value' as const, text: 'x' },
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
  }
  const generationIdentity = hashCanonicalTtsValue({ schemaVersion: 1, operation: 'sound-effect-generation', kind, prompt, ...(durationSeconds !== undefined ? { durationSeconds } : {}), loop })
  const synthesisTasks = [{
    taskId: hashCanonicalTtsValue({ cueId: cue.cueId, generationIdentity }),
    generationIdentity,
    cueId: cue.cueId,
    kind,
    prompt,
    required,
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    loop,
  }]
  return {
    schemaVersion: 1,
    soundscapePlanId: hashCanonicalTtsValue({ prompt, kind, plan: 1 }),
    sceneRunIdentity: 'a'.repeat(64),
    sourceIdentity: { schemaVersion: 1, canonicalPath: 'input/x.md', scriptSlug: 'x', contentSha256: 'b'.repeat(64), identityHash: 'c'.repeat(64) },
    structuredScript: { path: 'metadata/structured-script.json', artifactSchemaVersion: 5, sha256: 'd'.repeat(64) },
    structuredScriptHash: 'd'.repeat(64),
    dialoguePlanId: 'e'.repeat(64),
    timingPolicy: 'strict',
    cues: kind === 'ambience' ? [] : [cue],
    ambientBeds: kind === 'ambience' ? [{ cueId: cue.cueId, kind: 'ambience' as const, prompt, required, range: { kind: 'full-scene' as const }, sourceSpan: cue.sourceSpan, ...(durationSeconds !== undefined ? { durationSeconds } : {}) }] : [],
    synthesisTasks,
    mixProfile: DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE,
    mixProfileHash: hashCanonicalTtsValue(DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE),
    mixIdentity: hashCanonicalTtsValue({ prompt, mix: 1 }),
    createdAt: '2026-08-14T00:00:00.000Z',
  }
}

const validTask = (overrides: Partial<SoundEffectRenderTask> = {}): SoundEffectRenderTask => ({
  taskId: 'task-1',
  cueId: 'cue-1',
  kind: 'action-sfx',
  required: true,
  generationIdentity: 'gen-1',
  requestIdentity: 'req-1',
  prompt: 'laser blast echoing down ship corridor',
  durationSeconds: 3,
  loop: false,
  outputFormat: 'wav',
  promptInfluence: 1,
  ...overrides,
})

const audiogenTarget = () => resolveSoundEffectTarget(REPLICATE_AUDIOGEN_SELECTOR)

const createAudiogenPlan = (prompt: string, options?: Parameters<typeof taskPlan>[1]) =>
  createSoundEffectRenderPlan({
    plan: taskPlan(prompt, { durationSeconds: 3, ...options }),
    target: audiogenTarget(),
    licenseUse: AUDIOGEN_NONCOMMERCIAL_LICENSE_USE,
  })

describe('ADR-017 Phase 7 Replicate AudioGen contracts', () => {
  test('capability fixture pins owner, version, schemas, hardware, license, and community lifecycle', () => {
    const fixture = REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE
    expect(fixture).toMatchObject({
      provider: 'replicate',
      owner: 'sepal',
      model: REPLICATE_AUDIOGEN_MODEL_ID,
      pinnedVersion: REPLICATE_AUDIOGEN_PINNED_VERSION,
      serializerVersion: REPLICATE_AUDIOGEN_SERIALIZER_VERSION,
      communityLifecycle: 'community-unofficial',
      licenseProvenance: 'CC BY-NC 4.0',
      permittedUse: 'noncommercial',
      dispatchAvailability: 'available',
      hardwareObservation: { accelerator: 'nvidia-l40s', typicalPredictSeconds: 14, observedAt: '2026-08-14' },
      upstreamSource: 'https://github.com/facebookresearch/audiocraft',
    })
    expect(fixture.inputSchema).toMatchObject({ prompt: 'string', duration: 'number-1-10-default-3' })
    expect(fixture.outputSchema).toMatchObject({ format: 'uri', type: 'string' })
    expect(fixture.constraints.sampling).toEqual({ topK: 250, topP: 0, temperature: 1, classifierFreeGuidance: 3 })
    expect(fixture.pricing).toMatchObject({ typicalPerPrediction: 0.013, inputDependent: true })
    expect(fixture.capabilityFixtureHash).toBe(hashSoundEffectCapabilityFixture((({ capabilityFixtureHash: _hash, ...rest }) => rest)(fixture)))
    const licenseChanged = hashSoundEffectCapabilityFixture({ ...(({ capabilityFixtureHash: _hash, ...rest }) => rest)(fixture), licenseProvenance: 'CC BY 4.0' })
    const versionChanged = hashSoundEffectCapabilityFixture({ ...(({ capabilityFixtureHash: _hash, ...rest }) => rest)(fixture), pinnedVersion: '0'.repeat(64) })
    expect(licenseChanged).not.toBe(fixture.capabilityFixtureHash)
    expect(versionChanged).not.toBe(fixture.capabilityFixtureHash)
    expect(readAudioGenCapabilityFixture(fixture.capabilityFixtureHash)).toEqual(fixture)
  })

  test('rejects aliases, unreviewed versions, and unsupported speech models before credentials', () => {
    expect(() => resolveReplicateAudioGenTarget('audiogen')).toThrow(/Aliases are rejected/)
    expect(() => resolveReplicateAudioGenTarget('sepal/audiogen@unreviewed_version_hash')).toThrow(/Unreviewed Replicate AudioGen version/)
    expect(() => resolveSoundEffectTarget('replicate=jaaari/kokoro-82m')).toThrow(/Unsupported Replicate sound-effect model jaaari\/kokoro-82m/)
    expect(resolveSoundEffectTarget(`replicate=${REPLICATE_AUDIOGEN_MODEL_ID}`).model).toBe(REPLICATE_AUDIOGEN_MODEL_ID)
    expect(resolveSoundEffectTarget(REPLICATE_AUDIOGEN_SELECTOR).capabilityFixture.pinnedVersion).toBe(REPLICATE_AUDIOGEN_PINNED_VERSION)
  })

  test('serializes every default explicitly and rejects vocal reactions and invalid durations', () => {
    const target = audiogenTarget()
    const serialized = serializeReplicateAudioGenRequest(validTask(), target)
    expect(serialized).toEqual({
      path: '/v1/predictions',
      body: {
        version: `${REPLICATE_AUDIOGEN_MODEL_ID}:${REPLICATE_AUDIOGEN_PINNED_VERSION}`,
        input: {
          prompt: 'laser blast echoing down ship corridor',
          duration: 3,
          top_k: 250,
          top_p: 0,
          temperature: 1,
          classifier_free_guidance: 3,
          output_format: 'wav',
        },
      },
    })
    expect(() => validateReplicateAudioGenTask(validTask({ durationSeconds: 15 }), target)).toThrow(/duration must be 1-10 seconds/)
    expect(() => validateReplicateAudioGenTask(validTask({ kind: 'vocal-reaction', prompt: 'gasp' }), target)).toThrow(/cannot render vocal reactions/)
    expect(() => createAudiogenPlan('gasp', { kind: 'vocal-reaction', durationSeconds: 2 })).toThrow(/cannot render VOCAL SFX/)
    const optionalVocal = createAudiogenPlan('optional-gasp', { kind: 'vocal-reaction', required: false, durationSeconds: 2 })
    expect(optionalVocal.tasks).toEqual([])
    expect(optionalVocal.routingDecisions).toEqual([expect.objectContaining({ kind: 'vocal-reaction', required: false, route: 'unsupported' })])
    expect(serializeReplicateAudioGenRequest(validTask({ kind: 'ambience', loop: true, durationSeconds: 4 }), target).body.input.duration).toBe(4)
  })

  test('static license and price planning distinguish supported, prohibited, unknown, and missing use without writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-audiogen-price-'))
    try {
      const target = audiogenTarget()
      expect(() => createSoundEffectRenderPlan({ plan: taskPlan('needs-license', { durationSeconds: 3 }), target })).toThrow(/requires explicit --sfx-license-use noncommercial/)
      expect(() => assertAudioGenLicenseEligible(createSoundEffectLicenseUse({ classification: 'commercial', fixture: target.capabilityFixture }), target.capabilityFixture)).toThrow(/commercial intended use is ineligible/)
      expect(() => assertAudioGenLicenseEligible(createSoundEffectLicenseUse({ classification: 'unknown', fixture: target.capabilityFixture }), target.capabilityFixture)).toThrow(/unknown intended use is ineligible/)
      const priced = createSoundEffectRenderPlan({ plan: taskPlan(`priced-${randomUUID()}`, { durationSeconds: 10 }), target, licenseUse: AUDIOGEN_NONCOMMERCIAL_LICENSE_USE })
      expect(priced.licenseUse?.classification).toBe('noncommercial')
      expect(priced.plannedCost.currency).toBe('USD')
      expect(priced.plannedCost.amount).toBeCloseTo(0.013)
      expect(priced.plannedCost.basis).toContain('typical per-prediction')
      const defaulted = createSoundEffectRenderPlan({ plan: taskPlan(`unknown-${randomUUID()}`), target, licenseUse: AUDIOGEN_NONCOMMERCIAL_LICENSE_USE })
      expect(defaulted.plannedCost.amount).toBeCloseTo(0.013)
      expect(defaulted.plannedCost.basis).toContain('typical per-prediction')
      const estimate = await planSoundEffectResumePrice(root, priced)
      expect(estimate).toMatchObject({ unresolvedTaskCount: 1, cachedTaskCount: 0, resumedTaskCount: 0, currency: 'USD' })
      expect(estimate.amount).toBeCloseTo(0.013)
      expect(await readdir(root)).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('createReplicateAudioGenAdapter requires an API token', () => {
    // Reports the missing credential through the single gate, so the message, exit code,
    // and hints match every other provider rather than being adapter-specific.
    expect(() => createReplicateAudioGenAdapter({ apiToken: '' }))
      .toThrow(/REPLICATE_API_TOKEN environment variable is required/)
    try {
      createReplicateAudioGenAdapter({ apiToken: '' })
    } catch (error) {
      expect(isAppError(error) && error.kind).toBe('usage')
      expect(normalizeExitCode(error)).toBe(2)
      return
    }
    expect.unreachable('Expected a missing-credential usage error')
  })

  test('mocked prediction create/poll/download retains evidence and reuses the shared cache', async () => {
    const root = await tempDirs.make()
    const prompt = `hatch slam ${randomUUID()}`
    const renderPlan = createAudiogenPlan(prompt)
    const calls = installMockFetch(call => {
      if (call.url.endsWith('/v1/predictions') && call.method === 'POST') {
        expect(call.bodyJson).toMatchObject({
          version: `${REPLICATE_AUDIOGEN_MODEL_ID}:${REPLICATE_AUDIOGEN_PINNED_VERSION}`,
          input: { prompt, duration: 3, top_k: 250, output_format: 'wav' },
        })
        return Response.json({ id: 'prediction-audiogen', status: 'starting', urls: { get: POLL_URL, cancel: CANCEL_URL } })
      }
      if (call.url === POLL_URL) {
        return Response.json({ id: 'prediction-audiogen', status: 'succeeded', output: OUTPUT_URL, version: REPLICATE_AUDIOGEN_PINNED_VERSION })
      }
      if (call.url === OUTPUT_URL) {
        return new Response(createSyntheticWavBytes({ durationSeconds: 1, amplitude: 0.2, frequencyHz: 220 }), { headers: { 'content-type': 'audio/wav' } })
      }
      throw new Error(`Unexpected network call: ${call.method} ${call.url}`)
    })
    const adapter = createReplicateAudioGenAdapter({ apiToken: 'fixture-token', now: () => '2026-08-14T00:00:00.000Z' })
    const first = await executeSoundEffectRenderPlan({ rootDir: root, plan: renderPlan, adapter, concurrency: 1 })
    expect(first.result.status).toBe('succeeded')
    expect(first.result.entries[0]?.requestEvidence?.providerRequestId).toBe('prediction-audiogen')
    expect(calls.map(call => `${call.method} ${call.url}`)).toEqual([
      'POST https://api.replicate.com/v1/predictions',
      `GET ${POLL_URL}`,
      `GET ${OUTPUT_URL}`,
    ])
    const secondRoot = await tempDirs.make()
    const second = await executeSoundEffectRenderPlan({ rootDir: secondRoot, plan: renderPlan, adapter, concurrency: 1 })
    expect(second.result.entries[0]?.source).toBe('cache-materialization')
    expect(calls).toHaveLength(3)
    expect((await planSoundEffectResumePrice(secondRoot, renderPlan)).unresolvedTaskCount).toBe(0)
  })

  test('classifies failed, canceled, timed-out, empty-download, and ambiguous-admission paths', async () => {
    const target = audiogenTarget()
    const failedAdapter = createReplicateAudioGenAdapter({
      apiToken: 'fixture-token',
      runPrediction: async () => {
        throw ProviderError('status failed', { status: 422 })
      },
    })
    await expect(failedAdapter.generate(validTask(), target, 1, new AbortController().signal)).rejects.toThrow(/prediction failed/)

    const timedOutAdapter = createReplicateAudioGenAdapter({
      apiToken: 'fixture-token',
      runPrediction: async () => {
        throw ProviderError('prediction timed out', { status: 504 })
      },
    })
    await expect(timedOutAdapter.generate(validTask(), target, 1, new AbortController().signal)).rejects.toMatchObject({ admissionDisposition: 'ambiguous' })

    let canceled = 0
    const cancelController = new AbortController()
    const cancelAdapter = createReplicateAudioGenAdapter({
      apiToken: 'fixture-token',
      runPrediction: async (input) => {
        await input.onCreated?.({ id: 'prediction-audiogen', status: 'processing', urls: { get: POLL_URL, cancel: CANCEL_URL } })
        cancelController.abort()
        input.abortSignal.throwIfAborted()
        return { id: 'prediction-audiogen', status: 'canceled' }
      },
    })
    installMockFetch(call => {
      if (call.url === CANCEL_URL && call.method === 'POST') {
        canceled++
        return Response.json({ id: 'prediction-audiogen', status: 'canceled' })
      }
      throw new Error(`Unexpected network call: ${call.method} ${call.url}`)
    })
    await expect(cancelAdapter.generate(validTask(), target, 1, cancelController.signal)).rejects.toThrow()
    expect(canceled).toBe(1)

    const emptyAdapter = createReplicateAudioGenAdapter({
      apiToken: 'fixture-token',
      runPrediction: async () => ({ id: 'prediction-audiogen', status: 'succeeded', output: OUTPUT_URL }),
      fetchImpl: async () => new Response(new Uint8Array(), { headers: { 'content-type': 'audio/wav' } }),
    })
    await expect(emptyAdapter.generate(validTask(), target, 1, new AbortController().signal)).rejects.toThrow(/download was empty/)

    const root = await tempDirs.make()
    const ambiguousPlan = createAudiogenPlan(`ambiguous-${randomUUID()}`)
    let calls = 0
    const ambiguousAdapter = { generate: async () => { calls++; throw new Error('transport disconnected after request write') } }
    expect((await executeSoundEffectRenderPlan({ rootDir: root, plan: ambiguousPlan, adapter: ambiguousAdapter })).result.status).toBe('failed')
    expect((await executeSoundEffectRenderPlan({ rootDir: root, plan: ambiguousPlan, adapter: ambiguousAdapter })).result.status).toBe('failed')
    expect(calls).toBe(1)
    await expect(planSoundEffectResumePrice(root, ambiguousPlan)).rejects.toThrow(/ambiguous provider admission/iu)
  })

  test('keeps AudioGen request identity distinct from ElevenLabs and blocks unavailable dispatch', async () => {
    const prompt = `identity-${randomUUID()}`
    const audiogen = createAudiogenPlan(prompt)
    const elevenlabs = createSoundEffectRenderPlan({ plan: taskPlan(prompt, { durationSeconds: 3 }), target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2') })
    expect(audiogen.tasks[0]?.requestIdentity).not.toBe(elevenlabs.tasks[0]?.requestIdentity)
    const retired = registerHistoricalAudioGenFixture(withAudioGenDispatchAvailability(REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE, 'retired'))
    expect(retired.capabilityFixtureHash).not.toBe(REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE.capabilityFixtureHash)
    expect(readAudioGenCapabilityFixture(retired.capabilityFixtureHash)).toEqual(retired)
    const retiredTarget = { ...audiogenTarget(), capabilityFixture: retired }
    expect(() => createSoundEffectRenderPlan({
      plan: taskPlan(prompt, { durationSeconds: 3 }),
      target: retiredTarget,
      licenseUse: createSoundEffectLicenseUse({ classification: 'noncommercial', fixture: retired }),
    })).toThrow(/cannot dispatch new predictions/)
    const historical = createSoundEffectRenderPlan({
      plan: taskPlan(`historical-${randomUUID()}`, { durationSeconds: 3 }),
      target: retiredTarget,
      licenseUse: createSoundEffectLicenseUse({ classification: 'noncommercial', fixture: retired }),
      allowUnavailable: true,
    })
    const historicalRoot = await tempDirs.make()
    const executed = await executeSoundEffectRenderPlan({
      rootDir: historicalRoot,
      plan: historical,
      adapter: { generate: unexpectedCall('retired AudioGen dispatch') },
    })
    expect(executed.result.status).toBe('failed')
    expect(executed.result.entries[0]?.omissionReason).toMatch(/cannot dispatch new predictions/)
  })
})
