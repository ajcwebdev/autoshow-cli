import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import { runTtsForTargets } from '~/cli/commands/audio/tts/run-tts'
import { buildCurrentTtsProviderState } from '~/cli/commands/audio/tts/script-to-audio/current-render-artifacts'
import { buildPureCurrentTtsRenderPlan } from '~/cli/commands/audio/tts/script-to-audio/attempt-planning'
import { prepareCurrentTtsCompatibleSlotRecovery } from '~/cli/commands/audio/tts/script-to-audio/attempt-recovery'
import { createInlineTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/audio/tts/script-to-audio/generic-dialogue-plan'
import { hashCanonicalTtsValue, sha256Bytes } from '~/cli/commands/audio/tts/script-to-audio/contract-identity'
import { resolveTtsDeliveryOptions } from '~/cli/options/option-resolution/tts-delivery-options'
import { verifyProviderProjectionArtifacts } from '~/cli/commands/command-shared/pipeline-manifest/projection-artifact-verifier'
import type { CanonicalAudioProviderProjection, CompactTargetRender } from '~/types'
import { createTtsFixtureTarget } from '../../../../test-utils/tts-fixture-target'
import { setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

const dirs = setupContractSuiteLifecycle({ envKeys: ['OPENAI_API_KEY'], tempPrefix: 'tts-slot-model-identity-' })

test('legacy model-bound archives reuse verified audio across delivery changes; unbound or corrupted legacy slots cannot be reused', async () => {
  process.env['OPENAI_API_KEY'] = 'fixture-key'
  const root = await dirs.make('tts-legacy-slot-')
  const text = 'Retain this purchased sentence.'
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
  let calls = 0
  const target = createTtsFixtureTarget({ mode: { kind: 'success' }, model: 'fixture-slot-identity', voice: 'alloy', onRun: () => { calls++ } })
  const first = await runTtsForTargets(text, root, {}, [target], { sourceIdentity, dialoguePlan, compactArchive: true })
  const state = buildCurrentTtsProviderState(first.metadata[0]!)
  const projection = state.result!['ttsAudio'] as CanonicalAudioProviderProjection
  const archive = projection.archive!
  const path = join(root, archive.renderRef.path)
  const render = await Bun.file(path).json() as CompactTargetRender
  const pure = buildPureCurrentTtsRenderPlan({ target, sourceText: text, ttsOptions: {}, sourceIdentity, dialoguePlan })
  const slot = pure.planned.slots[0]!
  // Independent V1 fixture: provider and model were absent from this identity.
  const legacyHash = hashCanonicalTtsValue({ schemaVersion: 1, kind: 'paid-speech-slot', dialoguePlanId: dialoguePlan.dialoguePlanId, turnIds: slot.turnIds, providerText: slot.providerText, serializedVoiceHash: render.slots[0]!.voiceHash, requestControlsHash: slot.expectedRequestControlsHash, outputFormat: { codec: 'pcm_s16le', container: 'wav', sampleRate: 16000, channels: 1 }, endpointKind: slot.expectedEndpointKind, serializerVersion: slot.expectedSerializerVersion })
  const scopedHash = render.slots[0]!.slotHash
  const original = await Bun.file(join(root, 'slots', scopedHash + '.wav')).bytes()
  const legacyPath = join(root, 'slots', legacyHash + '.wav')
  await Bun.write(legacyPath, original)
  await rm(join(root, 'slots', scopedHash + '.wav'))
  render.slots[0]!.slotHash = legacyHash
  const { renderId: _id, ...base } = render
  render.renderId = hashCanonicalTtsValue(base)
  const bytes = JSON.stringify(render) + '\n'
  await Bun.write(path, bytes)
  archive.renderRef.sha256 = sha256Bytes(bytes)
  state.result = { ttsAudio: projection }; state.metadata = { ...state.metadata, ttsAudio: projection }
  expect(await verifyProviderProjectionArtifacts(root, state)).toBe(true)
  const ttsOptions = { ttsDelivery: resolveTtsDeliveryOptions({ 'tts-audio-profile': 'native' }).ttsDelivery }
  const options = { rootDir: root, outputDir: root, target, sourceText: text, ttsOptions, sourceIdentity, dialoguePlan, state, materialize: false }
  const priceRecovery = await prepareCurrentTtsCompatibleSlotRecovery(options)
  expect(priceRecovery?.kind).toBe('partial-slots')
  expect(await Bun.file(join(root, 'slots', scopedHash + '.wav')).exists()).toBe(false)
  const unbound = structuredClone(state)
  delete (unbound.result!['ttsAudio'] as CanonicalAudioProviderProjection).archive
  expect(await prepareCurrentTtsCompatibleSlotRecovery({ ...options, state: unbound })).toBeUndefined()
  await Bun.write(legacyPath, new Uint8Array(original.length))
  await expect(prepareCurrentTtsCompatibleSlotRecovery(options)).rejects.toThrow()
  await Bun.write(legacyPath, original)
  const second = await runTtsForTargets(text, root, ttsOptions, [target], { sourceIdentity, dialoguePlan, compactArchive: true, retainedProviderStates: [state], recoveryRootDir: root, resolveReportedOutput: () => ({ path: join(root, 'remastered.wav'), fileName: 'remastered.wav' }) })
  expect(calls).toBe(1)
  expect(await verifyProviderProjectionArtifacts(root, buildCurrentTtsProviderState(second.metadata[0]!))).toBe(true)
  expect(await Bun.file(join(root, 'slots', scopedHash + '.wav')).bytes()).toEqual(original)
  expect(await Bun.file(legacyPath).bytes()).toEqual(original)
})
