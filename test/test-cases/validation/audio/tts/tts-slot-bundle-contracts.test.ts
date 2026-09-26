import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { mkdir, rm, symlink } from 'node:fs/promises'
import { runTtsForTargets } from '~/cli/commands/audio/tts/run-tts'
import { buildCurrentTtsProviderState } from '~/cli/commands/audio/tts/script-to-audio/current-render-artifacts'
import { planCurrentTtsResumePrice } from '~/cli/commands/audio/tts/script-to-audio/current-render-attempt'
import { createInlineTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/audio/tts/script-to-audio/generic-dialogue-plan'
import { compactTtsSlotDirectory, readBundledTtsSlot } from '~/cli/commands/audio/tts/script-to-audio/tts-slot-bundle'
import { readContainedArtifactFile } from '~/cli/commands/audio/tts/script-to-audio/safe-artifact-store'
import { verifyProviderProjectionArtifacts } from '~/cli/commands/command-shared/pipeline-manifest/projection-artifact-verifier'
import { resolveTtsDeliveryOptions } from '~/cli/options/option-resolution/tts-delivery-options'
import { createTtsFixtureTarget } from '../../../../test-utils/tts-fixture-target'
import { createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import { setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'
import { readManifest, writeManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/audio/tts/script-to-audio/item-dialogue-plan-artifact'
import { compactTtsBenchmarkRun, planTtsBenchmarkCompaction } from '~/tools/compact-tts-benchmarks'
import { readObservedAudio } from '~/cli/commands/audio/tts/script-to-audio/attempt-io'

const dirs = setupContractSuiteLifecycle({ envKeys: ['OPENAI_API_KEY'], tempPrefix: 'tts-slot-bundle-' })

test('compressed non-WAV provider audio is probed from memory without extraction', async () => {
  const root = await dirs.make('tts-bundle-mp3-')
  await mkdir(join(root, 'slots'))
  await Bun.write(join(root, 'source.wav'), createSyntheticWavBytes({ durationSeconds: 0.5, amplitude: 0.2, frequencyHz: 440 }))
  const path = join(root, 'slots', 'c'.repeat(64) + '.wav')
  const encode = Bun.spawnSync(['ffmpeg', '-v', 'error', '-i', join(root, 'source.wav'), '-f', 'mp3', path])
  expect(encode.exitCode).toBe(0)
  const before = await readObservedAudio(root, path)
  await compactTtsSlotDirectory(root, 'slots')
  const after = await readObservedAudio(root, path)
  expect(after.bytes).toEqual(before.bytes)
  expect(after.format.codec).toBe('mp3')
  expect(after.durationMs).toBeGreaterThanOrEqual(490)
  expect(after.durationMs).toBeLessThan(700)
  expect(await Bun.file(path).exists()).toBe(false)
})

test('compressed paid audio preserves hashes, price-only is read-only, and delivery override/reset need no dispatch', async () => {
  process.env['OPENAI_API_KEY'] = 'local-fixture'
  const root = await dirs.make('tts-compressed-reuse-'), text = 'A retained sentence for delivery changes.'
  const sourceIdentity = createInlineTtsSourceIdentity(text), dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
  let calls = 0
  const target = createTtsFixtureTarget({ mode: { kind: 'success' }, model: 'fixture-bundle', voice: 'alloy', onRun: () => { calls++ } })
  const initial = await runTtsForTargets(text, root, {}, [target], { sourceIdentity, dialoguePlan, compactArchive: true })
  const state = buildCurrentTtsProviderState(initial.metadata[0]!)
  const render = await Bun.file(join(root, initial.metadata[0]!.ttsAudio!.archive!.renderRef.path)).json()
  const slotPath = `slots/${render.slots[0].slotHash}.wav`
  const original = await readContainedArtifactFile(root, slotPath)
  expect((await compactTtsSlotDirectory(root, 'slots')).files).toBe(1)
  expect(await Bun.file(join(root, slotPath)).exists()).toBe(false)
  expect((await readContainedArtifactFile(root, slotPath)).bytes).toEqual(original.bytes)
  expect(await verifyProviderProjectionArtifacts(root, state)).toBe(true)
  const zipPath = join(root, 'slots/audio.zip'), zip = await Bun.file(zipPath).bytes()
  const corrupt = Uint8Array.from(zip); corrupt[100] = corrupt[100]! ^ 0xff
  await Bun.write(zipPath, corrupt)
  expect(await verifyProviderProjectionArtifacts(root, state)).toBe(false)
  await Bun.write(zipPath, zip)
  const price = await planCurrentTtsResumePrice({ rootDir: root, state, target, sourceText: text, ttsOptions: {}, sourceIdentity, dialoguePlan })
  expect(price).toMatchObject({ recoveryKind: 'complete-render', plannedSlotCount: 0, plannedCost: { amounts: [] } })
  expect(await Bun.file(join(root, slotPath)).exists()).toBe(false)
  const same = await runTtsForTargets(text, root, {}, [target], { sourceIdentity, dialoguePlan, compactArchive: true, retainedProviderStates: [state], recoveryRootDir: root })
  expect(same.metadata).toHaveLength(1)
  expect(calls).toBe(1)
  const override = { ttsDelivery: resolveTtsDeliveryOptions({ 'tts-audio-profile': 'native', 'tts-lead-in': '120' }).ttsDelivery }
  expect(override.ttsDelivery?.leadInMs).toBe(120)
  const changedPrice = await planCurrentTtsResumePrice({ rootDir: root, state, target, sourceText: text, ttsOptions: override, sourceIdentity, dialoguePlan })
  expect(changedPrice.plannedSlotCount).toBe(0)
  expect(await Bun.file(join(root, slotPath)).exists()).toBe(false)
  const changed = await runTtsForTargets(text, root, override, [target], { sourceIdentity, dialoguePlan, compactArchive: true, retainedProviderStates: [state], recoveryRootDir: root, resolveReportedOutput: () => ({ path: join(root, 'changed.wav'), fileName: 'changed.wav' }) })
  expect(changed.metadata).toHaveLength(1)
  expect(calls).toBe(1)
  const changedAudio = await readObservedAudio(root, join(root, 'changed.wav'))
  const firstAudio = await readObservedAudio(root, join(root, initial.metadata[0]!.audioFileName))
  expect(changedAudio.durationMs).toBe(firstAudio.durationMs + 120)
  await compactTtsSlotDirectory(root, 'slots')
  const reset = await runTtsForTargets(text, root, {}, [target], { sourceIdentity, dialoguePlan, compactArchive: true, retainedProviderStates: [buildCurrentTtsProviderState(changed.metadata[0]!)], recoveryRootDir: root, resolveReportedOutput: () => ({ path: join(root, 'reset.wav'), fileName: 'reset.wav' }) })
  expect(reset.metadata).toHaveLength(1)
  expect(calls).toBe(1)
  expect((await readObservedAudio(root, join(root, 'reset.wav'))).durationMs).toBe(firstAudio.durationMs)
  expect((await readContainedArtifactFile(root, slotPath)).sha256).toBe(original.sha256)
})

test('bundle append retains previous bytes and rejects corrupted archives before removing loose audio', async () => {
  const root = await dirs.make('tts-bundle-append-')
  await mkdir(join(root, 'slots'))
  const first = `${'a'.repeat(64)}.wav`, second = `${'b'.repeat(64)}.wav`
  const audio = createSyntheticWavBytes({ durationSeconds: 0.1, amplitude: 0.2, frequencyHz: 440 })
  await Bun.write(join(root, 'slots', first), audio)
  await compactTtsSlotDirectory(root, 'slots')
  const archive = join(root, 'slots/audio.zip'), valid = await Bun.file(archive).bytes()
  await Bun.write(join(root, 'slots', second), audio)
  await Bun.write(archive, valid.subarray(0, valid.length - 1))
  await expect(compactTtsSlotDirectory(root, 'slots')).rejects.toThrow()
  expect(await Bun.file(join(root, 'slots', second)).exists()).toBe(true)
  await expect(readBundledTtsSlot(join(root, 'slots'), first)).rejects.toThrow()
  await Bun.write(archive, valid)
  await compactTtsSlotDirectory(root, 'slots')
  expect(await readBundledTtsSlot(join(root, 'slots'), first)).toEqual(Buffer.from(audio))
  expect(await readBundledTtsSlot(join(root, 'slots'), second)).toEqual(Buffer.from(audio))
  const packed = await Bun.file(archive).bytes()
  expect((await compactTtsSlotDirectory(root, 'slots')).files).toBe(0)
  expect(await Bun.file(archive).bytes()).toEqual(packed)
  const tampered = Uint8Array.from(packed); tampered[100] = tampered[100]! ^ 0xff
  await Bun.write(archive, tampered)
  await expect(readBundledTtsSlot(join(root, 'slots'), first)).rejects.toThrow()
})

test('compressed slot lookup rejects archive symlinks and unsafe member names', async () => {
  const root = await dirs.make('tts-bundle-symlink-')
  await mkdir(join(root, 'slots'))
  await Bun.write(join(root, 'outside.zip'), 'outside')
  await symlink(join(root, 'outside.zip'), join(root, 'slots/audio.zip'))
  await expect(readContainedArtifactFile(root, `slots/${'a'.repeat(64)}.wav`)).rejects.toThrow()
  await expect(readBundledTtsSlot(join(root, 'slots'), '../outside.zip')).rejects.toThrow()
  await rm(join(root, 'slots/audio.zip'))
})

test('benchmark maintenance keeps selected evidence and unrelated notes, removes obsolete reports, and refuses corrupt selected audio', async () => {
  process.env['OPENAI_API_KEY'] = 'local-fixture'
  const root = await dirs.make('tts-benchmark-maintenance-'), text = 'Keep the selected benchmark evidence.'
  const sourceIdentity = createInlineTtsSourceIdentity(text), dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
  const target = createTtsFixtureTarget({ mode: { kind: 'success' }, model: 'fixture-maintenance', voice: 'alloy' })
  const result = await runTtsForTargets(text, root, {}, [target], { sourceIdentity, dialoguePlan, compactArchive: true })
  const state = bindTtsDialoguePlanArtifact(buildCurrentTtsProviderState(result.metadata[0]!), await materializeTtsDialoguePlanArtifact(root, dialoguePlan))
  await writeManifest(root, { command: 'tts', scope: 'single', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), items: [{ status: 'full', metadata: { measuredTime: 123, measuredCost: 4 }, providers: [state] }] })
  await Bun.write(join(root, 'provider-comparison-report.json'), '{"derived":true}')
  await Bun.write(join(root, 'listening-notes.txt'), 'Keep this assessment.')
  const manifest = await readManifest(root)
  const audioPath = join(root, result.metadata[0]!.audioFileName), bytes = await Bun.file(audioPath).bytes()
  await Bun.write(audioPath, 'invalid')
  await expect(planTtsBenchmarkCompaction(root)).rejects.toThrow()
  expect(await Bun.file(join(root, 'provider-comparison-report.json')).exists()).toBe(true)
  await Bun.write(audioPath, bytes)
  const plan = await planTtsBenchmarkCompaction(root)
  expect(plan.remove).toEqual(['provider-comparison-report.json'])
  await compactTtsBenchmarkRun(root)
  expect(await readManifest(root)).toEqual(manifest)
  expect(await Bun.file(audioPath).bytes()).toEqual(bytes)
  expect(await Bun.file(join(root, 'listening-notes.txt')).text()).toBe('Keep this assessment.')
  expect(await Bun.file(join(root, 'provider-comparison-report.json')).exists()).toBe(false)
  expect((await compactTtsBenchmarkRun(root)).removedFiles).toBe(0)
})
