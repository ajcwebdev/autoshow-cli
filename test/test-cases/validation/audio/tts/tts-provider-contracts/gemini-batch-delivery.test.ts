import { afterEach, expect, test } from 'bun:test'
import { join } from 'node:path'
import { runGeminiRemoteBatch } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-batch-workflow'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { dispatchResume } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import { resolveTtsDeliveryOptions } from '~/cli/options/option-resolution/tts-delivery-options'
import { readObservedAudio } from '~/cli/commands/audio/tts/script-to-audio/attempt-io'
import type { GeminiProviderJobRun } from '~/types/tts-workflow/gemini-provider-job-types'
import { createSyntheticWavBytes } from '../../../../../test-utils/media-fixtures'
import { jsonResponse } from '../../../../../test-utils/rest-contract-helpers'
import { setupTtsContractLifecycle, installMockFetch } from './shared'
import { LITE, batchAudio } from './gemini-fixtures'

const { makeTempDir } = setupTtsContractLifecycle()
afterEach(resetPinnedRunDir)

const tone = createSyntheticWavBytes({ sampleRate: 24000, durationSeconds: 0.1, frequencyHz: 440, amplitude: 0.2 })
const first = 'Alpha words keep this paragraph comfortably below the requested limit'
const second = 'Bravo words keep this paragraph comfortably below the requested limit.'
const paragraphs = `${first}.\n\n${second}`

const prepareBatch = async (text: string, flags: Record<string, unknown>, invalid = false) => {
  const root = await makeTempDir('gemini-batch-delivery-'), input = join(root, 'source.txt'), output = join(root, 'output')
  await Bun.write(input, text)
  configurePinnedRunDir(output)
  process.env['GEMINI_API_KEY'] = 'delivery-fixture-key'
  let requests: Array<{ metadata: { key: string } }> = []
  const calls = installMockFetch(call => {
    if (call.method === 'POST' && call.url.endsWith(`/models/${LITE}:batchGenerateContent`)) {
      const body = call.bodyJson as { batch: { inputConfig: { requests: { requests: typeof requests } } } }
      requests = body.batch.inputConfig.requests.requests
      return jsonResponse({ name: 'batches/delivery', metadata: { state: 'BATCH_STATE_PENDING' } })
    }
    if (call.method === 'GET' && call.url.endsWith('/batches/delivery')) {
      return jsonResponse({ name: 'batches/delivery', done: true, response: { inlinedResponses: { inlinedResponses: [...requests].reverse().map(request => ({
        metadata: request.metadata,
        response: batchAudio((invalid ? Buffer.from('invalid WAV') : tone).toString('base64')),
      })) } } })
    }
    throw Error(`Unexpected fixture request: ${call.method} ${call.url}`)
  })
  const options = { geminiTtsModels: [LITE], geminiTtsMode: 'batch' as const, ...resolveTtsDeliveryOptions({ 'tts-chunk-size': '100', ...flags }) }
  return { output, calls, run: () => runGeminiRemoteBatch(input, options, collectTtsTargets(options)) }
}

for (const [label, flags, sampleRate] of [
  ['default', {}, 24000],
  ['legacy', { 'tts-audio-profile': 'legacy-16k' }, 16000],
  ['sample-rate override', { 'tts-sample-rate': '48000', 'tts-channels': '2' }, 48000],
  ['explicit native reset', { 'tts-audio-profile': 'native' }, 24000],
] as const) test(`decoded artifact integrity: Batch ${label} profile survives resume without redispatch`, async () => {
  const fixture = await prepareBatch(paragraphs, flags)
  await fixture.run()
  const run = await Bun.file(join(fixture.output, 'gemini-provider-jobs.json')).json() as GeminiProviderJobRun
  expect(run.slots).toHaveLength(2)
  const path = join(fixture.output, run.outputs[0]!.path)
  const audio = await readObservedAudio(fixture.output, path)
  expect(audio.format.sampleRate).toBe(sampleRate)
  expect(audio.format.channels).toBe(label === 'sample-rate override' ? 2 : 1)
  expect(audio.durationMs).toBe(200)
  expect(run.delivery.ttsDelivery?.sampleRate).toBe(label === 'sample-rate override' ? 48000 : undefined)
  expect(run.delivery.ttsDelivery?.preset).toBe(label === 'legacy' ? undefined : 'native')
  const callsBefore = fixture.calls.length
  await dispatchResume(fixture.output, { 'provider-job-action': 'wait' })
  expect(fixture.calls).toHaveLength(callsBefore)
  expect((await readObservedAudio(fixture.output, path)).bytes).toEqual(audio.bytes)
}, 20000)

for (const [boundary, text, pauseMs] of [
  ['paragraph', paragraphs, 1000],
  ['sentence', `${first}. ${second}`, 250],
  ['clause', `${first}; ${second}`, 0],
  ['word', `${first} ${second}`, 0],
  ['hard', 'a'.repeat(150), 0],
] as const) test(`decoded artifact integrity: Batch persists the resolved ${boundary} seam and pause through resume`, async () => {
  const fixture = await prepareBatch(text, { 'tts-paragraph-pause': '1000', 'tts-sentence-pause': '250' })
  await fixture.run()
  const run = await Bun.file(join(fixture.output, 'gemini-provider-jobs.json')).json() as GeminiProviderJobRun
  expect(run.slots.map(slot => slot.boundaryAfter)).toEqual([boundary, 'end'])
  const audioPath = join(fixture.output, run.outputs[0]!.path)
  const audio = await readObservedAudio(fixture.output, audioPath)
  expect(audio.durationMs).toBe(200 + pauseMs)
  const callsBefore = fixture.calls.length
  await dispatchResume(fixture.output, { 'provider-job-action': 'wait' })
  expect(fixture.calls).toHaveLength(callsBefore)
  expect((await readObservedAudio(fixture.output, audioPath)).bytes).toEqual(audio.bytes)
}, 20000)

test('decoded artifact integrity: a paragraph pause of zero adds no silence', async () => {
  const fixture = await prepareBatch(paragraphs, { 'tts-paragraph-pause': '0', 'tts-sentence-pause': '250' })
  await fixture.run()
  const run = await Bun.file(join(fixture.output, 'gemini-provider-jobs.json')).json() as GeminiProviderJobRun
  expect(run.slots.map(slot => slot.boundaryAfter)).toEqual(['paragraph', 'end'])
  expect((await readObservedAudio(fixture.output, join(fixture.output, run.outputs[0]!.path))).durationMs).toBe(200)
})

test('decoded artifact integrity: successful Batch transport with invalid WAVs cannot produce an assembled output', async () => {
  const fixture = await prepareBatch(paragraphs, { 'tts-audio-profile': 'legacy-16k' }, true)
  await expect(fixture.run()).rejects.toThrow('failed or missing slots')
  const run = await Bun.file(join(fixture.output, 'gemini-provider-jobs.json')).json() as GeminiProviderJobRun
  expect(run.outputs).toEqual([])
  expect(run.slots.map(slot => slot.error)).toEqual(['invalid-or-incomplete-audio', 'invalid-or-incomplete-audio'])
  await expect(dispatchResume(fixture.output, { 'provider-job-action': 'wait' })).rejects.toThrow('incomplete')
  expect(fixture.calls.filter(call => call.method === 'POST')).toHaveLength(1)
})

test('Batch resume rejects delivery overrides before provider dispatch', async () => {
  const fixture = await prepareBatch(paragraphs, {})
  await fixture.run()
  const callsBefore = fixture.calls.length
  await expect(dispatchResume(fixture.output, { 'tts-audio-profile': 'legacy-16k' })).rejects.toThrow('overrides')
  expect(fixture.calls).toHaveLength(callsBefore)
})
