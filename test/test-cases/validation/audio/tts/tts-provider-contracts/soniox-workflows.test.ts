import { afterEach, expect, test } from 'bun:test'
import { join } from 'node:path'
import { mkdir, readdir } from 'node:fs/promises'
import { runSingleTtsInput } from '~/cli/commands/audio/tts/tts-single-run'
import { runTtsDirectoryBatch } from '~/cli/commands/audio/tts/tts-batch-run'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { dispatchResume } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { verifyManifestProjectionArtifacts } from '~/cli/commands/command-shared/pipeline-manifest/projection-artifact-graph'
import { buildPureCurrentTtsRenderPlan } from '~/cli/commands/audio/tts/script-to-audio/attempt-planning'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { readContainedArtifactFile } from '~/cli/commands/audio/tts/script-to-audio/safe-artifact-store'
import { parseRootCli } from '../../../../../test-utils/cli-assertions'
import { jsonResponse } from '../../../../../test-utils/rest-contract-helpers'
import { createSyntheticWavBytes } from '../../../../../test-utils/media-fixtures'
import { setupTtsContractLifecycle, installMockFetch } from './shared'
import type { CliCommandContext, StandaloneTtsCommandOptions } from '~/types'

const { makeTempDir } = setupTtsContractLifecycle()
afterEach(resetPinnedRunDir)
const audio = () => createSyntheticWavBytes({ sampleRate: 24000, durationSeconds: 0.2, amplitude: 0.2, frequencyHz: 440 })
const options = (extra: Partial<StandaloneTtsCommandOptions> = {}): StandaloneTtsCommandOptions => ({ batchConcurrency: 1, price: false, allowOverBudget: false, sonioxTtsModels: ['tts-rt-v2'], ttsChunkConcurrency: 1, ...extra })

test('file dispatch preserves planned chunks; resume reuses paid audio and restores case-sensitive voice/language/speed', async () => {
  const root = await makeTempDir('soniox-resume-'), input = join(root, 'source.txt'), output = join(root, 'output')
  const text = '[warm] This sentence retains the same words and tags. '.repeat(24)
  await Bun.write(input, text); configurePinnedRunDir(output); process.env['SONIOX_API_KEY'] = 'soniox-workflow-key'
  let rejectSecond = true
  const calls = installMockFetch(() => rejectSecond && calls.length === 2 ? jsonResponse({ error_type: 'invalid_request', request_id: 'rejected-2' }, { status: 400 }) : new Response(audio()))
  const opts = options({ sonioxTtsVoice: 'Clone_AbC', sonioxTtsLanguage: 'fr', sonioxTtsSpeed: 0.8 })
  await expect(runSingleTtsInput(input, opts, collectTtsTargets(opts), undefined)).rejects.toThrow()
  const retained = (await readdir(join(output, 'slots'))).filter(path => path.endsWith('.wav'))
  expect(retained).toHaveLength(1)
  const firstBytes = (await readContainedArtifactFile(output, `slots/${retained[0]!}`)).bytes
  await expect(dispatchResume(output, { 'tts-speed': ['soniox=1.2'] }, [], [{ name: 'tts-speed', raw: '--tts-speed', value: 'soniox=1.2', known: true }])).rejects.toThrow('differs')
  expect(calls).toHaveLength(2)
  rejectSecond = false
  await dispatchResume(output, { price: true })
  expect(calls).toHaveLength(2)
  await dispatchResume(output, {})
  const manifest = await readManifest(output)
  expect(manifest?.items[0]?.status).toBe('full')
  expect(await Bun.file(join(output, 'slots/audio.zip')).exists()).toBe(true)
  expect((await readContainedArtifactFile(output, `slots/${retained[0]!}`)).bytes).toEqual(firstBytes)
  expect(calls.slice(2).every(call => call.bodyJson?.['voice'] === 'Clone_AbC' && call.bodyJson?.['speed'] === 0.8 && call.bodyJson?.['language'] === 'fr')).toBe(true)
  const successfulTexts = calls.filter((_, index) => index !== 1).map(call => call.bodyJson!['text'] as string)
  expect(successfulTexts.join(' ')).toBe(text.trim())
  const before = calls.length
  await dispatchResume(output, {})
  expect(calls).toHaveLength(before)
  const serialized = JSON.stringify(manifest)
  expect(serialized).toContain('sonioxProviderAudioSeconds')
  expect(serialized).toContain('heuristic')
}, 20000)

for (const kind of ['corrupt', 'near-limit', 'interrupted'] as const) test(`${kind} successful transport never completes a slot and blocks automatic repurchase`, async () => {
  const root = await makeTempDir('soniox-ambiguous-'), input = join(root, 'source.txt'), output = join(root, 'output')
  await Bun.write(input, 'Do not repurchase this ambiguous request.'); configurePinnedRunDir(output); process.env['SONIOX_API_KEY'] = 'soniox-workflow-key'
  const calls = installMockFetch(() => kind === 'interrupted'
    ? new Response(new ReadableStream({ start(controller) { controller.enqueue(audio().subarray(0, 40)); controller.error(new Error('Interrupted response body')) } }))
    : new Response(kind === 'corrupt' ? Buffer.from('not WAV') : createSyntheticWavBytes({ sampleRate: 24000, durationSeconds: 119, amplitude: 0.2, frequencyHz: 440 })))
  const opts = options()
  await expect(runSingleTtsInput(input, opts, collectTtsTargets(opts), undefined)).rejects.toThrow()
  expect(calls).toHaveLength(1)
  await expect(dispatchResume(output, {})).rejects.toThrow('automatic redispatch is blocked')
  expect(calls).toHaveLength(1)
  const files = (await readdir(output, { recursive: true })).filter(path => path.endsWith('soniox-response-chunk-001.wav'))
  if (kind !== 'interrupted') expect(files.length).toBeGreaterThan(0)
  expect((await readManifest(output))?.items[0]?.providers[0]?.status).toBe('failed')
}, 20000)

test('segmented dialogue serializes speaker IDs, per-turn controls and defaults after reset', async () => {
  const root = await makeTempDir('soniox-dialogue-'), input = join(root, 'source.txt'), output = join(root, 'output')
  await Bun.write(input, 'Host: [warm] Welcome.\nGuest: [slowly] Thank you.'); configurePinnedRunDir(output); process.env['SONIOX_API_KEY'] = 'soniox-workflow-key'
  const calls = installMockFetch(() => new Response(audio()))
  const opts = options({ ttsDialogueFormat: 'labeled', ttsSpeakers: ['Host=Adrian', 'Guest=Clone_Case'], sonioxTtsSpeed: 0.8, sonioxTtsLanguage: 'fr', ttsTurnControls: { 'dialogue-turn-001': { soniox: { language: 'es', speed: 1.3 } }, 'dialogue-turn-002': { soniox: { language: null, speed: null } } } })
  const planned = buildPureCurrentTtsRenderPlan({ target: collectTtsTargets(opts)[0]!, sourceText: await Bun.file(input).text(), ttsOptions: opts })
  const resetSlot = planned.planned.slots[1]!
  // Reset restores native speed 1, including cost planning; it does not inherit the 0.8 default.
  expect(resetSlot.plannedCost.amounts[0]!.amount * 100).toBeCloseTo([...resetSlot.providerText].length * 0.00141)
  await runSingleTtsInput(input, opts, collectTtsTargets(opts), undefined)
  expect(calls.map(call => call.bodyJson)).toEqual([
    { model: 'tts-rt-v2', voice: 'Adrian', text: '[warm] Welcome.', language: 'es', speed: 1.3, audio_format: 'wav', sample_rate: 24000 },
    { model: 'tts-rt-v2', voice: 'Clone_Case', text: '[slowly] Thank you.', language: 'en', speed: 1, audio_format: 'wav', sample_rate: 24000 },
  ])
  const manifest = await readManifest(output)
  expect(manifest?.items[0]?.status).toBe('full')
  expect(JSON.stringify(manifest)).toContain('segment')
  expect(JSON.stringify(manifest)).toContain('"sonioxProviderAudioSeconds":0.4')
  await dispatchResume(output, {})
  expect(calls).toHaveLength(2)
}, 20000)

test('directory batching preserves order and reuses each complete file on resume', async () => {
  const root = await makeTempDir('soniox-batch-'), input = join(root, 'input'), output = join(root, 'output')
  await mkdir(input); await Bun.write(join(input, '02.txt'), 'Second file.'); await Bun.write(join(input, '01.txt'), 'First file.')
  configurePinnedRunDir(output); process.env['SONIOX_API_KEY'] = 'soniox-workflow-key'
  const calls = installMockFetch(() => new Response(audio()))
  const opts = options()
  await runTtsDirectoryBatch(input, opts, collectTtsTargets(opts), undefined)
  expect((await readManifest(output))?.items.map(item => item.status)).toEqual(['full', 'full'])
  expect(calls.map(call => call.bodyJson?.['text'])).toEqual(['First file.', 'Second file.'])
  await dispatchResume(output, {})
  expect(calls).toHaveLength(2)
}, 20000)

test('adding one provider to a retained batch uses the model filename and preserves the existing provider audio', async () => {
  const root = await makeTempDir('soniox-batch-backfill-name-'), input = join(root, 'input'), output = join(root, 'output')
  await mkdir(input); await Bun.write(join(input, 'chapter.txt'), 'Backfill filename fixture.')
  configurePinnedRunDir(output)
  process.env['OPENAI_API_KEY'] = 'openai-workflow-key'; process.env['SONIOX_API_KEY'] = 'soniox-workflow-key'
  const calls = installMockFetch(() => new Response(audio()))
  const opts = options({ sonioxTtsModels: [], openaiTtsModels: ['gpt-4o-mini-tts-2025-12-15'] })
  await runTtsDirectoryBatch(input, opts, collectTtsTargets(opts), undefined)
  const original = await Bun.file(join(output, 'chapter.wav')).bytes()
  expect(calls).toHaveLength(1)
  const occurrences = [{ name: 'provider', raw: '--provider', value: 'soniox=tts-rt-v2', known: true }]
  await dispatchResume(output, { provider: ['soniox=tts-rt-v2'] }, [], occurrences)
  expect(calls).toHaveLength(2)
  expect(await Bun.file(join(output, 'chapter.wav')).bytes()).toEqual(original)
  expect(await Bun.file(join(output, 'chapter-soniox-tts-rt-v2.wav')).exists()).toBe(true)
  const manifest = (await readManifest(output))!
  expect(manifest.items[0]!.providers).toHaveLength(2)
  expect(manifest.items[0]!.metadata['tts']).toEqual(expect.arrayContaining([expect.objectContaining({ ttsService: 'soniox', audioFileName: 'chapter-soniox-tts-rt-v2.wav' })]))
  expect(await verifyManifestProjectionArtifacts(output, manifest)).toBe(true)
  await dispatchResume(output, { provider: ['soniox=tts-rt-v2'] }, [], occurrences)
  expect(calls).toHaveLength(2)
}, 20000)

test('benchmark output naming reaches the audio, metadata and compact archive without changing synthesis identity', async () => {
  const root = await makeTempDir('soniox-benchmark-name-'), input = join(root, 'source.txt'), output = join(root, 'output')
  await Bun.write(input, 'Narrator: [calm] I sound calm. All is well.')
  configurePinnedRunDir(output); process.env['SONIOX_API_KEY'] = 'soniox-workflow-key'
  const calls = installMockFetch(() => new Response(audio()))
  const opts = options({ ttsDialogueFormat: 'labeled', ttsSpeakers: ['Narrator=Adrian'] })
  const fileName = 'soniox-tts-rt-v2-emotion-tags.wav'
  await runSingleTtsInput(input, opts, collectTtsTargets(opts), undefined, {
    resolveReportedOutput: () => ({ path: join(output, fileName), fileName })
  })
  const manifest = (await readManifest(output))!
  expect(await Bun.file(join(output, fileName)).exists()).toBe(true)
  expect(await Bun.file(join(output, 'speech.wav')).exists()).toBe(false)
  expect(manifest.items[0]!.metadata['tts']).toEqual(expect.arrayContaining([expect.objectContaining({ audioFileName: fileName })]))
  expect(await verifyManifestProjectionArtifacts(output, manifest)).toBe(true)
  await dispatchResume(output, {})
  expect(calls).toHaveLength(1)
}, 20000)

test('public provider/model controls and price execute without credentials, network or output files', async () => {
  const root = await makeTempDir('soniox-price-'), input = join(root, 'source.txt'), output = join(root, 'output')
  await Bun.write(input, 'A price-only request.'); configurePinnedRunDir(output)
  const calls = installMockFetch(() => { throw Error('Unexpected network') })
  const parsed = parseRootCli(['tts', input, '--provider', 'soniox', '--model', 'tts-rt-v2', '--tts-voice', 'Clone_AbC', '--tts-language', 'fr', '--tts-speed', '0.7', '--price'])
  expect(parsed.rawParsed.unknown).toEqual({})
  const context: CliCommandContext = { argv: parsed.argv, command: parsed.command!, parameters: parsed.parameters, flags: parsed.flags, rawParsed: parsed.rawParsed, store: {} }
  await parsed.command!.handler(context)
  expect(calls).toHaveLength(0)
  expect(await readdir(root)).toEqual(['source.txt'])
  for (const argv of [
    ['--provider', 'soniox', '--model', 'tts-rt-v1'],
    ['--provider', 'soniox', '--provider', 'grok', '--model', 'tts-rt-v2'],
    ['--provider', 'soniox=tts-rt-v2', '--model', 'tts-rt-v1'],
    ['--model', 'tts-rt-v2'],
  ]) {
    const invalid = parseRootCli(['tts', input, ...argv, '--price'])
    await expect(invalid.command!.handler({ argv: invalid.argv, command: invalid.command!, parameters: invalid.parameters, flags: invalid.flags, rawParsed: invalid.rawParsed, store: {} })).rejects.toThrow()
  }
  expect(calls).toHaveLength(0)
})

test('immutable request identity includes controls and safe chunk boundaries', () => {
  const text = 'A sentence for immutable planning. '.repeat(30)
  const plan = (extra = {}) => {
    const opts = { ...buildOptsFromFlags({ 'soniox-tts': true }), ...extra }
    return buildPureCurrentTtsRenderPlan({ target: collectTtsTargets(opts)[0]!, sourceText: text, ttsOptions: opts })
  }
  const initial = plan(), different = plan({ sonioxTtsSpeed: 1.2 })
  expect(initial.renderIdentity).not.toBe(different.renderIdentity)
  expect(initial.planned.slots.every(slot => slot.providerText.length <= 500)).toBe(true)
  expect(initial.planned.slots[0]!.expectedSerializerVersion).toBe('soniox.tts.rest.v1')
  expect(initial.planned.slots[0]!.expectedRequestControlsHash).not.toBe(different.planned.slots[0]!.expectedRequestControlsHash)
})
